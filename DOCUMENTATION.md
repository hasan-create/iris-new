# IRIS — Intelligent Real-time Interactive Sight
## Project Documentation

---

## 1. Project Overview

**IRIS** (Intelligent Real-time Interactive Sight) is an AI-powered assistive web application designed to empower blind and visually impaired individuals. It uses a device's live camera feed combined with Google's Gemini multimodal AI to perceive, describe, and narrate the surrounding environment in real time — providing independence and situational awareness to users who cannot rely on vision.

The core idea: point your phone or webcam at anything, and IRIS tells you what it sees — out loud, instantly.

---

## 2. Problem Statement

Over **2.2 billion people worldwide** live with some form of visual impairment (WHO, 2023). Many face daily challenges navigating their environment, reading signs, identifying objects, or detecting hazards. Existing assistive tools are often:

- Expensive (specialized hardware)
- Limited in functionality (static image description only)
- Not real-time or conversational

IRIS addresses this gap by providing a **free, browser-based, real-time visual assistant** powered by state-of-the-art AI.

---

## 3. Objectives

- Provide real-time object detection with spatial awareness (Left / Center / Right)
- Deliver continuous spoken narration of the user's surroundings
- Detect and immediately alert users to safety hazards
- Enable natural voice queries about the environment
- Read visible text (signs, labels, screens) out loud via OCR
- Be accessible on any device with a browser and camera — no installation required

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      USER DEVICE                        │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Camera  │───▶│  Browser UI  │───▶│  Web Speech   │  │
│  │  Feed    │    │  (HTML/CSS/  │    │  API (TTS)    │  │
│  └──────────┘    │   JS)        │    └───────────────┘  │
│                  └──────┬───────┘                        │
└─────────────────────────┼───────────────────────────────┘
                          │ HTTP POST (base64 image)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   DJANGO BACKEND (Render)               │
│  ┌─────────────────────────────────────────────────┐    │
│  │              vision/views.py                    │    │
│  │  /api/analyze-frame/  → Object Detection        │    │
│  │  /api/voice-query/    → Voice Q&A               │    │
│  │  /api/ocr-read/       → Text Recognition        │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │                               │
│  ┌──────────────────┐   │   ┌─────────────────────┐    │
│  │  MySQL Database  │   │   │  Google Gemini API  │    │
│  │  (Aiven Cloud)   │   └──▶│  (Multimodal AI)    │    │
│  │  - Users         │       └─────────────────────┘    │
│  │  - Sessions      │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend Framework | Django 5 (Python) | Web server, routing, auth |
| AI Engine | Google Gemini API | Multimodal vision + language |
| Database | MySQL on Aiven Cloud | User accounts, sessions |
| Frontend | HTML5, CSS3, JavaScript | UI, camera, speech |
| Speech Output | Web Speech API | Text-to-speech narration |
| Speech Input | Web Speech Recognition API | Voice queries |
| Static Files | WhiteNoise | Serving CSS/JS in production |
| WSGI Server | Gunicorn | Production web server |
| Deployment | Render | Cloud hosting |
| Version Control | GitHub | Source code management |

---

## 6. Key Features

### 6.1 Real-Time Object Detection
- Captures camera frames every 5 seconds automatically
- Sends frame to Gemini AI for analysis
- Returns detected objects with:
  - Object label (e.g. "Chair", "Person", "Smartphone")
  - Confidence score
  - 2D bounding box coordinates
  - Spatial position (Left / Center / Right)
  - Estimated distance (Near / Mid / Far)
  - Motion state (Stationary / Moving)
- Renders bounding boxes as overlays on the live video

### 6.2 Narration Modes
- **Continuous Narration** — Speaks a description of the scene every 5 seconds
- **Smart Assist (Quiet)** — Stays silent unless a new significant object or hazard appears

### 6.3 Safety Hazard Detection
- Automatically identifies dangerous objects or situations
- Triggers immediate audio alert with red bounding box highlight
- Examples: open stairs, sharp objects, approaching person

### 6.4 Voice Query System
- Users click "Ask IRIS" or tap a quick-query chip
- Speaks question via microphone
- IRIS analyzes current camera frame + question context
- Responds with a 1-2 sentence spoken answer
- Quick chips: "What's in my hand?", "Obstacle check", "Room layout"

### 6.5 OCR Text Reader
- Captures current frame
- Sends to Gemini for text extraction
- Reads all visible text aloud (signs, labels, screens, documents)

### 6.6 User Authentication
- Full registration and login system
- Django's built-in auth with session management
- Secure password handling

### 6.7 Guest Preview Mode
- 5-minute timed preview for new visitors
- No account required to try the app
- Countdown timer displayed in header
- Redirects to login/signup after expiry

---

## 7. Application Flow

```
User Opens App
      │
      ▼
  Logged In? ──No──▶ Login / Sign Up / Guest
      │
     Yes
      │
      ▼
  Dashboard Loads
      │
      ├──▶ Camera starts automatically
      │
      ├──▶ "IRIS is starting..." toast notification appears
      │
      ├──▶ Auto-Analyze loop starts (every 5 seconds)
      │         │
      │         ▼
      │    Capture frame → POST to /api/analyze-frame/
      │         │
      │         ▼
      │    Gemini AI analyzes image
      │         │
      │         ▼
      │    Return JSON (objects, boxes, announcement)
      │         │
      │         ▼
      │    Render boxes on video + Speak announcement
      │
      ├──▶ User taps "Ask IRIS" → Voice query → Spoken answer
      │
      └──▶ User taps "Read Signs" → OCR → Text spoken aloud
```

---

## 8. API Reference

### POST `/api/analyze-frame/`
Analyzes a camera frame for objects and hazards.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "mode": "continuous | smart_assist",
  "recentObjects": ["Chair", "Table"]
}
```

**Response:**
```json
{
  "detectedObjects": [
    {
      "label": "Chair",
      "confidence": 0.95,
      "box2d": [120, 80, 400, 350],
      "spatialPosition": "Center",
      "distance": "Near",
      "state": "stationary"
    }
  ],
  "isSignificantChange": true,
  "isSafetyHazard": false,
  "safetyMessage": "",
  "spokenAnnouncement": "A chair is directly in front of you."
}
```

### POST `/api/voice-query/`
Answers a natural language question about the current view.

**Request:**
```json
{
  "userPrompt": "What am I holding in my hand?",
  "imageBase64": "data:image/jpeg;base64,...",
  "contextHistory": "[]"
}
```

**Response:**
```json
{
  "spokenAnswer": "You are holding a smartphone in your right hand."
}
```

### POST `/api/ocr-read/`
Extracts and returns visible text from the image.

**Request:**
```json
{
  "imageBase64": "data:image/jpeg;base64,..."
}
```

**Response:**
```json
{
  "textResult": "EXIT. Push bar to open. In case of fire do not use elevator."
}
```

---

## 9. Database Schema

Django's default auth tables are used for user management:

| Table | Fields | Purpose |
|-------|--------|---------|
| `auth_user` | id, username, email, password, is_active | User accounts |
| `django_session` | session_key, session_data, expire_date | Guest + user sessions |

No custom models are defined — authentication and session management use Django's built-in system entirely.

---

## 10. Frontend Architecture

### `app.js` — IrisApp Class
The entire frontend is a single JavaScript class `IrisApp` with these responsibilities:

| Method | Purpose |
|--------|---------|
| `startCamera()` | Request camera permission, start video feed |
| `startAutoLoop()` | Set 5-second interval for auto-analysis |
| `captureFrameBase64()` | Draw video frame to canvas, export as JPEG base64 |
| `analyzeCurrentFrame()` | POST frame to backend, render result |
| `renderAnalysisResult()` | Draw bounding boxes, update entity list, speak |
| `sendVoiceQuery()` | POST voice question + frame, speak answer |
| `performOCR()` | POST frame for text extraction, speak result |
| `startVoiceInput()` | Activate Web Speech Recognition |
| `speak()` | Text-to-speech via SpeechSynthesis API |
| `initGuestTimer()` | Countdown timer for guest sessions |

---

## 11. UI Design

- **Theme:** Dark glassmorphism with cyan accent (`#38bdf8`)
- **Background:** Deep navy radial gradient
- **Cards:** Frosted glass effect with backdrop-filter blur
- **Responsive:** Mobile-first, works on phones and desktops
- **Accessibility:** High contrast, large touch targets, all feedback via audio

---

## 12. Security

| Concern | Implementation |
|---------|---------------|
| CSRF Protection | Django's built-in CSRF middleware |
| Secret Management | All keys in environment variables, never in code |
| SQL Injection | Django ORM — parameterized queries |
| Auth | Django's built-in authentication system |
| SSL | Aiven MySQL requires SSL (`ssl-mode=REQUIRED`) |
| Debug Mode | `DEBUG=False` in production via env var |

---

## 13. Deployment

**Platform:** Render (render.com)  
**Database:** Aiven Cloud MySQL  
**Static Files:** WhiteNoise (served directly by Django/Gunicorn)

**Build Command:**
```
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

**Start Command:**
```
gunicorn iris_django.wsgi:application
```

**Required Environment Variables:**
```
GEMINI_API_KEY
DJANGO_SECRET_KEY
DEBUG=False
MYSQL_HOST
MYSQL_PORT
MYSQL_DATABASE
MYSQL_USER
MYSQL_PASSWORD
```

---

## 14. Limitations & Future Scope

### Current Limitations
- Analysis runs every 5 seconds (not true real-time streaming)
- Gemini API rate limits can cause occasional delays (9-10 seconds)
- Free Render instance spins down after inactivity (cold start delay)
- No mobile app — browser only

### Future Scope
- WebSocket-based real-time streaming for instant detection
- Dedicated mobile app (React Native / Flutter)
- Offline mode with on-device AI models
- Multi-language voice support
- Integration with smart glasses hardware
- Emergency alert system (SMS/call when hazard detected)
- User history and analytics dashboard

---

## 15. How to Run Locally

```bash
# Clone
git clone https://github.com/hasan-create/Intelligent-Real-time-Interactive-Sight.git
cd Intelligent-Real-time-Interactive-Sight

# Virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Environment setup
cp .env.example .env
# Edit .env with your credentials

# Database
python manage.py migrate

# Run
python manage.py runserver
```

Open [http://localhost:8000](http://localhost:8000)

---

## 16. Project Team

**Developer:** Hasan  
**Project:** IRIS — Intelligent Real-time Interactive Sight  
**Purpose:** Assistive AI technology for the visually impaired

---

*"Technology should be accessible to everyone — including those who experience the world differently."*
