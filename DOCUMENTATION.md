# IRIS — Intelligent Real-time Interactive Sight
## Project Documentation (Node.js + React Edition)

---

## 1. Project Overview

**IRIS** (Intelligent Real-time Interactive Sight) is an AI-powered assistive web application designed for blind and visually impaired users. It pairs a live browser camera feed with Google's Gemini multimodal AI (`@google/genai` JavaScript SDK) to detect objects, warn about hazards, read text aloud, and answer questions in real time.

---

## 2. Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | React 19, React Router, Vite (JavaScript) | SPA UI, routing, camera & overlay rendering |
| Styling | HTML5, CSS3 (`client/styles/style.css`) | Dark glassmorphism accessible UI |
| Speech | Web Speech API (`SpeechSynthesis` & `SpeechRecognition`) | Spoken announcements & voice queries |
| Backend | Node.js 22 + Express 5 (JavaScript) | API endpoints, auth, static/Vite serving |
| AI Engine | `@google/genai` JavaScript SDK (`gemini-3.1-flash-lite`, `gemini-4-hydrogen`) | Multimodal object detection, voice Q&A, OCR |
| Database | MySQL (`mysql2/promise` with SSL) + memory fallback | Persistent `users` and `sessions` tables |
| Auth | `express-session` + `bcryptjs` | Password hashing & cookie/Bearer sessions |

---

## 3. Core Features & Data Flow

### 3.1 Real-Time Object Detection & Pixel-Diff Triggering
- Samples a `64×48` low-resolution frame every `350ms` in the browser to measure scene change.
- Major changes (`>16%` pixels changed) clear stale bounding boxes and trigger `POST /api/analyze-frame` immediately.
- Static scenes throttle down to a `7s` heartbeat in **Continuous Narration** mode and `12s` in **Smart Assist (Quiet)** mode.
- Captures a `480×360` JPEG (`0.65` quality) and receives structured JSON:
  - `detectedObjects`: `label`, `confidence`, `box2d` (`[ymin, xmin, ymax, xmax]` 0–1000), `spatialPosition` (`Left`/`Center`/`Right`), `distance`, `state`
  - `isSignificantChange`, `isSafetyHazard`, `safetyMessage`, `spokenAnnouncement`

### 3.2 Voice & Text Queries (`POST /api/voice-query`)
- Triggered by **Ask IRIS** (microphone `SpeechRecognition`), typing into the inline question box, or tapping a quick chip (*"What's in my hand?"*, *"Obstacle check"*, *"Room layout"*).
- Aborts any background auto-analyze request so user questions take priority without audio interruption.

### 3.3 OCR Text Reader (`POST /api/ocr-read`)
- Captures the current camera frame, extracts visible text from signs, screens, and labels via Gemini, and speaks it aloud.

### 3.4 Authentication & 5-Minute Guest Mode
- **Sign Up / Login**: Stores salted `bcryptjs` password hashes in MySQL `users` table and sessions in MySQL `sessions` table.
- **Guest Mode**: Grants a 5-minute (`300s`) timed preview with a live countdown in the header and automatic redirect upon expiry.

---

## 4. Database Schema (MySQL)

`server/db.js` automatically runs `CREATE TABLE IF NOT EXISTS` on startup:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires BIGINT UNSIGNED NOT NULL,
  data MEDIUMTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

If `MYSQL_HOST`, `MYSQL_USER`, or `MYSQL_DATABASE` are not set (or unreachable in a restricted sandbox), the server automatically falls back to an in-memory store so the app still runs cleanly.

---

## 5. Scripts & Deployment

- `npm run dev` — Starts Express + Vite middleware on `http://0.0.0.0:3000`
- `npm run build` — Builds the React frontend to `dist/client`
- `npm start` — Starts production Express server serving `dist/client` and `/api/*`
- `npm run lint` — Runs syntax verification on `server/*.js`

---

**Developer:** Hasan — IRIS AI Perception Project
