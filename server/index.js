import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";
import {
  initDatabase,
  getDbMode,
  findUserByUsername,
  createUser,
  createSessionStore,
  getSessionRecord,
  setSessionRecord,
  deleteSessionRecord,
} from "./db.js";
import {
  analyzeFrameWithGemini,
  answerVoiceQueryWithGemini,
  readOcrWithGemini,
} from "./gemini.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const GUEST_LIMIT_SECONDS = 300;
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const IS_PROD = process.env.NODE_ENV === "production";

async function startServer() {
  await initDatabase();

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  const sessionSecret =
    process.env.SESSION_SECRET ||
    process.env.DJANGO_SECRET_KEY ||
    crypto.randomBytes(32).toString("hex");

  app.use(
    session({
      secret: sessionSecret,
      store: createSessionStore(session),
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  // Adapt cookie attributes for HTTPS iframes vs local HTTP
  app.use((req, _res, next) => {
    const isHttps =
      req.secure || req.headers["x-forwarded-proto"] === "https";
    if (req.session && req.session.cookie) {
      req.session.cookie.secure = isHttps;
      req.session.cookie.sameSite = isHttps ? "none" : "lax";
    }
    next();
  });

  // Bearer token fallback for cross-origin iframes where third-party cookies may be blocked
  app.use(async (req, _res, next) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
      if (token && !req.session?.username && !req.session?.isGuest) {
        const stored = await getSessionRecord(token);
        if (stored) {
          req.irisToken = token;
          req.irisSessionData = stored;
        }
      }
    } catch (err) {
      console.warn("[IRIS Session token lookup error]:", err.message);
    }
    next();
  });

  // Auth JSON API

  app.get(["/api/auth/me", "/api/auth/me/"], async (req, res) => {
    const sess =
      req.session?.username || req.session?.isGuest
        ? req.session
        : req.irisSessionData || {};

    if (sess.username) {
      return res.json({
        authenticated: true,
        isGuest: false,
        username: sess.username,
        guestRemainingSeconds: 0,
      });
    }

    if (sess.isGuest) {
      const startTime = sess.guestStartTime || Date.now();
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const remaining = Math.max(
        0,
        Math.floor(GUEST_LIMIT_SECONDS - elapsedSeconds)
      );

      if (remaining <= 0) {
        if (req.session) {
          req.session.isGuest = false;
          req.session.guestStartTime = undefined;
        }
        if (req.irisToken) {
          await deleteSessionRecord(req.irisToken);
        }
        return res.json({
          authenticated: false,
          isGuest: false,
          expired: true,
          username: null,
          guestRemainingSeconds: 0,
          message:
            "Your 5-minute guest preview has expired. Please sign up or log in to continue.",
        });
      }

      return res.json({
        authenticated: true,
        isGuest: true,
        username: "Guest User",
        guestRemainingSeconds: remaining,
      });
    }

    return res.json({
      authenticated: false,
      isGuest: false,
      username: null,
      guestRemainingSeconds: 0,
    });
  });

  app.post(["/api/auth/login", "/api/auth/login/"], async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "").trim();

      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username and password are required." });
      }

      const user = await findUserByUsername(username);
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res
          .status(401)
          .json({ error: "Invalid username or password." });
      }

      req.session.username = user.username;
      req.session.isGuest = false;
      req.session.guestStartTime = undefined;
      await new Promise((resolve) => req.session.save(() => resolve()));
      await setSessionRecord(req.sessionID, req.session);

      return res.json({
        ok: true,
        authenticated: true,
        token: req.sessionID,
        username: user.username,
        isGuest: false,
        guestRemainingSeconds: 0,
      });
    } catch (err) {
      console.error("[IRIS Auth login error]:", err);
      return res.status(500).json({ error: "Login failed. Please try again." });
    }
  });

  app.post(["/api/auth/signup", "/api/auth/signup/"], async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "").trim();
      const confirmPassword = String(req.body?.confirmPassword || "").trim();

      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username and password are required." });
      }
      if (password !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match." });
      }

      const existing = await findUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "Username already taken." });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      await createUser({ username, email, passwordHash });

      req.session.username = username;
      req.session.isGuest = false;
      req.session.guestStartTime = undefined;
      await new Promise((resolve) => req.session.save(() => resolve()));
      await setSessionRecord(req.sessionID, req.session);

      return res.status(201).json({
        ok: true,
        authenticated: true,
        token: req.sessionID,
        username,
        isGuest: false,
        guestRemainingSeconds: 0,
        message: "Account created successfully!",
      });
    } catch (err) {
      console.error("[IRIS Auth signup error]:", err);
      return res
        .status(500)
        .json({ error: "Could not create account. Please try again." });
    }
  });

  app.post(["/api/auth/guest", "/api/auth/guest/"], async (req, res) => {
    req.session.username = undefined;
    req.session.isGuest = true;
    req.session.guestStartTime = Date.now();
    await new Promise((resolve) => req.session.save(() => resolve()));
    await setSessionRecord(req.sessionID, req.session);

    return res.json({
      ok: true,
      authenticated: true,
      token: req.sessionID,
      isGuest: true,
      username: "Guest User",
      guestRemainingSeconds: GUEST_LIMIT_SECONDS,
    });
  });

  app.post(["/api/auth/logout", "/api/auth/logout/"], async (req, res) => {
    if (req.irisToken) {
      await deleteSessionRecord(req.irisToken);
    }
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });

  // Health & Gemini Perception APIs

  app.get(["/api/health", "/api/health/"], (_req, res) => {
    res.json({
      status: "ok",
      dbMode: getDbMode(),
      service: "IRIS Node.js + React Backend",
    });
  });

  app.post(
    ["/api/analyze-frame", "/api/analyze-frame/"],
    async (req, res) => {
      try {
        const rawB64 = String(req.body?.imageBase64 || "");
        const mode = String(req.body?.mode || "smart_assist");
        const recentObjects = Array.isArray(req.body?.recentObjects)
          ? req.body.recentObjects.map(String)
          : [];

        if (!rawB64) {
          return res.status(400).json({ error: "No image provided" });
        }

        const result = await analyzeFrameWithGemini(
          rawB64,
          mode,
          recentObjects
        );
        return res.json(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[IRIS Perception analyze_frame error]:", msg);
        return res.status(500).json({
          error: msg,
          detectedObjects: [],
          isSignificantChange: false,
          isSafetyHazard: false,
          spokenAnnouncement: "",
        });
      }
    }
  );

  app.post(["/api/voice-query", "/api/voice-query/"], async (req, res) => {
    try {
      const userPrompt = String(req.body?.userPrompt || "");
      const rawB64 = String(req.body?.imageBase64 || "");
      const contextHistory = String(req.body?.contextHistory || "");

      const spokenAnswer = await answerVoiceQueryWithGemini(
        userPrompt,
        rawB64,
        contextHistory
      );
      return res.json({ spokenAnswer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[IRIS Perception voice_query error]:", msg);
      return res.status(500).json({ spokenAnswer: "", error: msg });
    }
  });

  app.post(["/api/ocr-read", "/api/ocr-read/"], async (req, res) => {
    try {
      const rawB64 = String(req.body?.imageBase64 || "");
      if (!rawB64) {
        return res.status(400).json({ error: "No image provided" });
      }

      const textResult = await readOcrWithGemini(rawB64);
      return res.json({ textResult });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[IRIS Perception ocr_read error]:", msg);
      return res.status(500).json({
        textResult: "Could not read text from this image.",
        error: msg,
      });
    }
  });

  // Frontend Serving (Vite dev middleware in dev, built dist/client in prod)
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distClient = path.join(ROOT_DIR, "dist/client");
    app.use(express.static(distClient));
    app.get("/{*splat}", (_req, res) => {
      const indexHtml = path.join(distClient, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Frontend build not found. Run npm run build.");
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(
      `IRIS server running on http://${HOST}:${PORT} (DB: ${getDbMode()})`
    );
  });
}

startServer().catch((err) => {
  console.error("Failed to start IRIS server:", err);
  process.exit(1);
});
