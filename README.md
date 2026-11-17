# IRIS — Intelligent Real-time Interactive Sight

> A real-time AI-powered visual perception assistant for the blind and visually impaired, built with **Node.js, Express, React, Vite, and MySQL**.

---

## What is IRIS?

IRIS (Intelligent Real-time Interactive Sight) is a browser-based assistive technology application that uses your device's live camera feed and Google's Gemini multimodal AI (`@google/genai` JavaScript SDK) to help blind and low-vision individuals perceive and understand their surroundings in real time.

It detects objects with 2D bounding boxes, identifies safety hazards, reads signs and text out loud, and answers spoken or typed questions — all from a live camera feed.

---

## Features

- **Real-Time Object Detection & Pixel-Diff Triggering** — Samples frames locally in `<canvas>` and immediately triggers detection when the scene changes (e.g., holding up a smartphone or removing an object), drawing 2D bounding boxes with spatial positions (Left / Center / Right).
- **Continuous Narration Mode** — Streams concise live scene descriptions out loud using the browser's Web Speech API.
- **Smart Assist (Quiet) Mode** — Stays quiet when the scene is unchanged and speaks up when a new foreground object or safety hazard appears.
- **Voice & Text Queries** — Ask IRIS questions like *"What am I holding?"* or *"Are there any obstacles?"* via microphone (`Ask IRIS`), text input, or quick-tap chips.
- **OCR Sign & Text Reader** — Extracts and reads visible text from signs, labels, packaging, and screens out loud.
- **Guest Preview Mode** — New visitors can try IRIS for **5 minutes** without creating an account.
- **User Authentication** — Full sign up, login, logout, and persistent SQL sessions via MySQL (`mysql2`) with an automatic in-memory fallback for local/sandbox previews without MySQL configured.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router, Vite (JavaScript `.jsx`) |
| Styling | HTML5, CSS3 (Dark Glassmorphism UI) |
| Speech | Web Speech API (`SpeechSynthesis` & `SpeechRecognition`) |
| Backend | Node.js 22 + Express 5 (JavaScript `.js`, no TypeScript) |
| AI / Vision | Google Gemini API via `@google/genai` JavaScript SDK (`gemini-3.1-flash-lite` + `gemini-4-hydrogen` fallback) |
| Database | MySQL (`mysql2/promise` with SSL) + automatic in-memory fallback |
| Auth & Sessions | `express-session` (cookie + Bearer token) & `bcryptjs` |
| Deployment | Render (Node Web Service) |

---

## Project Structure

```
iris-sight/
│
├── server/
│   ├── index.js              # Express server, auth routes, AI APIs, Vite/static serving
│   ├── db.js                 # MySQL (mysql2) users & sessions + in-memory fallback
│   └── gemini.js             # @google/genai JavaScript client (vision, voice Q&A, OCR)
│
├── client/
│   ├── main.jsx              # React root + BrowserRouter
│   ├── App.jsx               # Routes & auth/guest session state
│   ├── styles/style.css      # Dark glassmorphism styles & responsive layout
│   ├── pages/
│   │   ├── DashboardPage.jsx # Camera, pixel-diff loop, bounding boxes, voice/OCR
│   │   ├── LoginPage.jsx     # Login & Guest Preview entry
│   │   └── SignupPage.jsx    # Account registration
│   └── components/
│       ├── WelcomeModal.jsx
│       └── GuestExpiredModal.jsx
│
├── index.html                # Vite HTML entry point
├── vite.config.js            # Vite + React configuration
├── package.json              # Node.js dependencies & scripts
├── metadata.json             # App capabilities & camera/mic permissions
└── .env.example              # Environment variable template
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/me` | GET | Get current user or remaining guest seconds |
| `/api/auth/login` | POST | Authenticate user and issue session |
| `/api/auth/signup` | POST | Create account in MySQL `users` table |
| `/api/auth/guest` | POST | Start 5-minute guest session |
| `/api/auth/logout` | POST | Destroy session |
| `/api/analyze-frame` | POST | Analyze camera frame with `@google/genai` |
| `/api/voice-query` | POST | Answer a spoken or typed question about the frame |
| `/api/ocr-read` | POST | Extract and read visible text from image |
| `/api/health` | GET | Health check and active DB mode (`mysql` or `memory-fallback`) |

---

## Running Locally

### Prerequisites
- Node.js 20+ (`npm`)
- MySQL (local or Aiven Cloud MySQL — optional for quick local testing thanks to automatic in-memory fallback)
- Google Gemini API key ([get one here](https://aistudio.google.com))

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your values
cp .env.example .env

# 3. Start development server (Express + Vite on port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key
SESSION_SECRET=your_random_session_secret
PORT=3000

# MySQL (e.g. Aiven Cloud MySQL)
MYSQL_HOST=your_mysql_host
MYSQL_PORT=3306
MYSQL_DATABASE=iris_db
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
```

---

## Deployment (Render)

1. Ensure your Aiven MySQL service is running.
2. Create a **Web Service** on Render with the **Node** runtime:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
3. Add `GEMINI_API_KEY`, `SESSION_SECRET`, and `MYSQL_*` under **Environment** in Render. On startup, `server/db.js` automatically creates the `users` and `sessions` tables in MySQL if they do not already exist.

---

## License

MIT License — free to use, modify, and distribute.

---

## Author

Built by **Hasan** — IRIS AI Perception Project
