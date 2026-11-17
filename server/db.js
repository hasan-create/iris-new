import mysql from "mysql2/promise";

let pool = null;
let dbMode = "memory-fallback";

const memoryUsers = new Map();
const memorySessions = new Map();

export async function initDatabase() {
  const host = (process.env.MYSQL_HOST || "").trim();
  const user = (process.env.MYSQL_USER || "").trim();
  const database = (process.env.MYSQL_DATABASE || "").trim();
  const password = process.env.MYSQL_PASSWORD || "";
  const port = Number(process.env.MYSQL_PORT || 3306);

  if (!host || !user || !database) {
    console.warn(
      "[IRIS DB] MYSQL_HOST/USER/DATABASE not set — using in-memory fallback store."
    );
    dbMode = "memory-fallback";
    return;
  }

  try {
    const useSsl = host !== "localhost" && host !== "127.0.0.1";
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      connectTimeout: 4000,
      ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    const conn = await pool.getConnection();
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(150) NOT NULL UNIQUE,
          email VARCHAR(254) NOT NULL DEFAULT '',
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(128) NOT NULL PRIMARY KEY,
          expires BIGINT UNSIGNED NOT NULL,
          data MEDIUMTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      dbMode = "mysql";
      console.log(`[IRIS DB] Connected to MySQL (${host}:${port}/${database}).`);
    } finally {
      conn.release();
    }
  } catch (err) {
    console.warn(
      `[IRIS DB] MySQL connection unavailable (${err.message}) — using in-memory fallback store.`
    );
    if (pool) {
      pool.end().catch(() => {});
      pool = null;
    }
    dbMode = "memory-fallback";
  }
}

export function getDbMode() {
  return dbMode;
}

export async function findUserByUsername(username) {
  if (dbMode === "mysql" && pool) {
    const [rows] = await pool.execute(
      "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ? LIMIT 1",
      [username]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0];
    }
    return null;
  }

  return memoryUsers.get(username) || null;
}

export async function createUser({ username, email, passwordHash }) {
  if (dbMode === "mysql" && pool) {
    const [result] = await pool.execute(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email || "", passwordHash]
    );
    return {
      id: result.insertId,
      username,
      email: email || "",
      password_hash: passwordHash,
    };
  }

  const record = {
    id: memoryUsers.size + 1,
    username,
    email: email || "",
    password_hash: passwordHash,
    created_at: new Date(),
  };
  memoryUsers.set(username, record);
  return record;
}

export async function getSessionRecord(sid) {
  if (!sid) return null;
  if (dbMode === "mysql" && pool) {
    const [rows] = await pool.execute(
      "SELECT data, expires FROM sessions WHERE session_id = ? LIMIT 1",
      [sid]
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    if (Number(row.expires) < Date.now()) {
      await deleteSessionRecord(sid);
      return null;
    }
    return JSON.parse(row.data);
  }

  const entry = memorySessions.get(sid);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    memorySessions.delete(sid);
    return null;
  }
  return JSON.parse(entry.data);
}

export async function setSessionRecord(sid, sess) {
  const maxAge = sess?.cookie?.maxAge ?? 24 * 60 * 60 * 1000;
  const expires = Date.now() + maxAge;
  const data = JSON.stringify(sess);

  if (dbMode === "mysql" && pool) {
    await pool.execute(
      "REPLACE INTO sessions (session_id, expires, data) VALUES (?, ?, ?)",
      [sid, expires, data]
    );
    return;
  }

  memorySessions.set(sid, { expires, data });
}

export async function deleteSessionRecord(sid) {
  if (!sid) return;
  if (dbMode === "mysql" && pool) {
    await pool.execute("DELETE FROM sessions WHERE session_id = ?", [sid]);
    return;
  }
  memorySessions.delete(sid);
}

export function createSessionStore(session) {
  const Store = session.Store;

  class IrisSqlSessionStore extends Store {
    get(sid, callback) {
      getSessionRecord(sid)
        .then((sess) => callback(null, sess))
        .catch((err) => callback(err));
    }

    set(sid, sess, callback) {
      setSessionRecord(sid, sess)
        .then(() => callback?.(null))
        .catch((err) => callback?.(err));
    }

    destroy(sid, callback) {
      deleteSessionRecord(sid)
        .then(() => callback?.(null))
        .catch((err) => callback?.(err));
    }

    touch(sid, sess, callback) {
      this.set(sid, sess, callback);
    }
  }

  return new IrisSqlSessionStore();
}
