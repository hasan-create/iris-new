# IRIS — System Architecture Design (Node.js + React)

---

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (React + Vite)                    │
│                                                                         │
│   ┌──────────────┐    ┌────────────────────────┐    ┌────────────────┐  │
│   │   Camera     │───▶│  DashboardPage.jsx     │───▶│  Web Speech    │  │
│   │  (Hardware)  │    │  64x48 Pixel-Diff +    │    │  (TTS + STT)   │  │
│   └──────────────┘    │  480x360 JPEG Canvas   │    └────────────────┘  │
│                       └───────────┬────────────┘                        │
│                                   │ Base64 JPEG / JSON (HTTP POST)      │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVER LAYER (Node.js 22 + Express 5)                │
│                                                                         │
│   ┌───────────────────────────┐       ┌──────────────────────────────┐  │
│   │   Auth & Session Layer    │       │     Perception APIs          │  │
│   │   POST /api/auth/login    │       │     POST /api/analyze-frame  │  │
│   │   POST /api/auth/signup   │       │     POST /api/voice-query    │  │
│   │   POST /api/auth/guest    │       │     POST /api/ocr-read       │  │
│   │   GET  /api/auth/me       │       └──────────────┬───────────────┘  │
│   │   POST /api/auth/logout   │                      │                  │
│   └─────────────┬─────────────┘                      ▼                  │
│                 │                     ┌──────────────────────────────┐  │
│                 │                     │  server/gemini.js            │  │
│                 │                     │  @google/genai JS SDK        │  │
│                 │                     │  1. gemini-3.1-flash-lite    │  │
│                 │                     │  2. gemini-4-hydrogen        │  │
│                 │                     └──────────────┬───────────────┘  │
└─────────────────┼────────────────────────────────────┼──────────────────┘
                  │                                    │ HTTPS
                  ▼                                    ▼
       ┌──────────────────────┐             ┌──────────────────────────┐
       │  Aiven Cloud MySQL   │             │    Google Gemini API     │
       │  (mysql2/promise)    │             │    Multimodal Vision     │
       │  - users             │             │    Structured JSON       │
       │  - sessions          │             │    OCR & Voice Q&A       │
       │  (auto memory        │             └──────────────────────────┘
       │   fallback if unset) │
       └──────────────────────┘
```

---

## 2. Frontend Architecture (`client/`)

- **`client/main.jsx`**: Mounts `<BrowserRouter>` and `<App />` with `client/styles/style.css`.
- **`client/App.jsx`**: Fetches `/api/auth/me` using session cookies + `Authorization: Bearer <token>` (`sessionStorage`), manages route guards (`/login`, `/signup`, `/`).
- **`client/pages/LoginPage.jsx` & `SignupPage.jsx`**: Glassmorphism authentication UI supporting account login, registration, and 5-minute Guest Preview.
- **`client/pages/DashboardPage.jsx`**:
  - Requests camera via `navigator.mediaDevices.getUserMedia`.
  - Runs a `350ms` local pixel-diff check on an offscreen `64×48` canvas to detect motion/scene changes immediately and avoid redundant static uploads.
  - Captures `480×360` JPEG frames (`0.65` quality) and calls `/api/analyze-frame`, `/api/voice-query`, or `/api/ocr-read`.
  - Preempts background auto-analyze requests (`AbortController`) whenever the user asks a voice/text question or runs OCR.
  - Renders 2D bounding boxes (`.box-2d`, `.box-hazard`), Active Spatial Memory, Perception Audit Log, and Web Speech TTS/STT.

---

## 3. Backend Architecture (`server/`)

- **`server/index.js`**:
  - Initializes database via `initDatabase()`.
  - Configures `express-session` backed by `createSessionStore(session)` plus Bearer-token lookup for cross-origin iframe compatibility.
  - Exposes `/api/auth/*`, `/api/analyze-frame`, `/api/voice-query`, `/api/ocr-read`, and `/api/health`.
  - Mounts Vite middleware in development and serves `dist/client` in production on port `3000` (`0.0.0.0`).
- **`server/db.js`**:
  - Connects to MySQL via `mysql2/promise` with SSL when `MYSQL_HOST` is remote.
  - Automatically creates `users` and `sessions` tables on startup.
  - Falls back to an in-memory `Map` store when `MYSQL_*` credentials are omitted or unreachable.
- **`server/gemini.js`**:
  - Uses the official **`@google/genai`** JavaScript SDK (`GoogleGenAI`) directly (no LangChain).
  - Uses `gemini-3.1-flash-lite` (`ThinkingLevel.MINIMAL`) as the low-latency primary model and `gemini-4-hydrogen` (`ThinkingLevel.LOW`) as fallback, with a `10s` per-model timeout.
  - Enforces strict JSON Schema output (`responseSchema`) for bounding boxes and hazard detection.
