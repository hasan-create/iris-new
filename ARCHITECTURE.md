# IRIS — System Architecture Design

---

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                   │
│                                                                         │
│   ┌──────────────┐    ┌─────────────────┐    ┌────────────────────┐    │
│   │   Camera     │    │   Browser UI    │    │  Web Speech API    │    │
│   │   (Hardware) │───▶│  HTML/CSS/JS    │───▶│  (TTS + STT)       │    │
│   └──────────────┘    └────────┬────────┘    └────────────────────┘    │
│                                │                                        │
│                    Base64 JPEG │ HTTP POST                              │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVER LAYER (Render)                            │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                     Django 5 Application                        │  │
│   │                                                                 │  │
│   │   ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐ │  │
│   │   │  Auth Views  │   │  Dashboard   │   │    API Views       │ │  │
│   │   │  login       │   │  index view  │   │  analyze-frame     │ │  │
│   │   │  signup      │   │  context     │   │  voice-query       │ │  │
│   │   │  logout      │   │  rendering   │   │  ocr-read          │ │  │
│   │   │  guest-login │   └──────────────┘   └────────┬───────────┘ │  │
│   │   └──────┬───────┘                               │             │  │
│   │          │                                       │             │  │
│   │          ▼                                       ▼             │  │
│   │   ┌──────────────┐              ┌────────────────────────────┐ │  │
│   │   │  Django Auth │              │   call_gemini_api()        │ │  │
│   │   │  + Sessions  │              │   Model fallback chain:    │ │  │
│   │   │  Middleware  │              │   gemini-3.5-flash-lite    │ │  │
│   │   └──────┬───────┘              │   gemini-3.5-flash         │ │  │
│   │          │                      │   gemini-3.6-flash         │ │  │
│   │          ▼                      │   gemini-3.7-flash         │ │  │
│   │   ┌──────────────┐              └───────────┬────────────────┘ │  │
│   │   │  Gunicorn    │                          │                  │  │
│   │   │  WSGI Server │                          │ HTTPS            │  │
│   │   └──────────────┘                          │                  │  │
│   └─────────────────────────────────────────────┼────────────────--┘  │
└─────────────────────────────────────────────────┼───────────────────--─┘
                                                  │
                    ┌─────────────────────────────┘
                    │
          ┌─────────▼──────────┐        ┌──────────────────────┐
          │  Google Gemini API │        │  Aiven Cloud MySQL   │
          │  (External AI)     │        │  (External Database) │
          │                    │        │                      │
          │  Multimodal Vision │        │  auth_user           │
          │  Text Generation   │        │  django_session      │
          │  JSON Mode         │        │  SSL Required        │
          └────────────────────┘        └──────────────────────┘
```

---

## 2. Frontend Architecture

```
Browser
│
├── index.html (Dashboard)
│   ├── <video> — Live camera feed
│   ├── <canvas> — Hidden frame capture
│   ├── #boxContainer — Dynamic bounding box overlays
│   ├── #announcementText — Latest AI spoken text
│   ├── #entityList — Detected objects list
│   ├── #logList — Perception audit log
│   ├── #welcomeModal — Instructions & Guide modal
│   └── #guestExpiredModal — Guest timer expired (guests only)
│
├── app.js — IrisApp Class
│   │
│   ├── INITIALIZATION
│   │   ├── constructor() — DOM refs, state vars
│   │   └── init() — bindEvents → checkOnboarding → initGuestTimer → startCamera
│   │
│   ├── CAMERA
│   │   ├── startCamera() — getUserMedia, play video
│   │   ├── stopCamera() — stop tracks, clear timer
│   │   └── captureFrameBase64() — draw to canvas, toDataURL JPEG 0.55
│   │
│   ├── AI ANALYSIS LOOP
│   │   ├── startAutoLoop() — setInterval every 5000ms
│   │   ├── analyzeCurrentFrame() — POST to /api/analyze-frame/
│   │   └── renderAnalysisResult() — boxes + entity list + speak
│   │
│   ├── VOICE SYSTEM
│   │   ├── startVoiceInput() — SpeechRecognition API
│   │   ├── sendVoiceQuery() — POST to /api/voice-query/
│   │   └── speak() — SpeechSynthesis API
│   │
│   ├── OCR
│   │   └── performOCR() — POST to /api/ocr-read/
│   │
│   ├── GUEST TIMER
│   │   ├── initGuestTimer() — reads data-guest-remaining attr
│   │   ├── updateGuestTimerDisplay() — MM:SS countdown
│   │   └── handleGuestExpiration() — show modal, redirect
│   │
│   └── UI / MODALS
│       ├── openWelcomeModal() / closeWelcomeModal()
│       ├── checkOnboardingModal() — localStorage check
│       ├── setMode() — continuous / smart_assist
│       └── updateAutoUI() — auto-analyze toggle
│
└── style.css
    ├── CSS Variables (colors, spacing)
    ├── Global reset + body
    ├── Header + logo + user badge
    ├── Main grid layout (2-column)
    ├── Video wrapper + HUD overlay
    ├── Bounding box styles (.box-2d, .box-hazard)
    ├── Controls bar + buttons
    ├── Entity list + log list
    ├── Auth pages (glassmorphism)
    ├── Modal styles
    └── Responsive breakpoints (960px, 640px, 480px)
```

---

## 3. Backend Architecture

```
iris_django/
│
├── settings.py
│   ├── SECRET_KEY          ← from env
│   ├── DEBUG               ← from env (False in prod)
│   ├── ALLOWED_HOSTS       ← ['*']
│   ├── INSTALLED_APPS      ← django defaults + 'vision'
│   ├── MIDDLEWARE          ← SecurityMiddleware
│   │                          WhiteNoiseMiddleware
│   │                          SessionMiddleware
│   │                          CsrfViewMiddleware
│   │                          AuthenticationMiddleware
│   ├── DATABASES           ← MySQL via env vars + SSL
│   ├── STATIC_URL          ← /static/
│   ├── STATICFILES_DIRS    ← [BASE_DIR/static]
│   └── STATIC_ROOT         ← [BASE_DIR/staticfiles]
│
├── urls.py
│   └── includes vision.urls
│
└── wsgi.py ← Gunicorn entry point


vision/
│
├── urls.py
│   ├── ''              → index (dashboard)
│   ├── 'login/'        → login_view
│   ├── 'signup/'       → signup_view
│   ├── 'logout/'       → logout_view
│   ├── 'guest-login/'  → guest_login_view
│   ├── 'api/analyze-frame/'  → analyze_frame
│   ├── 'api/voice-query/'    → voice_query
│   ├── 'api/ocr-read/'       → ocr_read
│   └── 'api/health/'         → health
│
└── views.py
    │
    ├── get_gemini_api_key()
    │   └── reads from 5 possible env var names
    │
    ├── call_gemini_api(prompt, image_b64, system_instruction, json_mode)
    │   ├── Tries 6 Gemini model variants in sequence
    │   ├── Handles 429 rate limit with 0.5s sleep + fallback
    │   └── Returns text response or raises exception
    │
    ├── AUTH VIEWS
    │   ├── login_view()     — authenticate + login + session
    │   ├── signup_view()    — create_user + login + session
    │   ├── guest_login_view() — set is_guest + guest_start_time in session
    │   └── logout_view()    — logout + session.flush()
    │
    └── DASHBOARD + API VIEWS
        ├── index()
        │   ├── Check auth OR guest session
        │   ├── Calculate guest_remaining_seconds
        │   ├── Redirect if guest expired
        │   └── Render index.html with context
        │
        ├── analyze_frame()   [@csrf_exempt, POST]
        │   ├── Parse imageBase64, mode, recentObjects
        │   ├── Build system_instruction + prompt
        │   ├── call_gemini_api(json_mode=True)
        │   └── Return parsed JSON response
        │
        ├── voice_query()     [@csrf_exempt, POST]
        │   ├── Parse userPrompt, imageBase64, contextHistory
        │   ├── call_gemini_api(json_mode=False)
        │   └── Return {spokenAnswer}
        │
        └── ocr_read()        [@csrf_exempt, POST]
            ├── Parse imageBase64
            ├── call_gemini_api(json_mode=False)
            └── Return {textResult}
```

---

## 4. Data Flow — Object Detection

```
1. AUTO LOOP (every 5s)
   app.js → startAutoLoop() → setInterval(5000)
                │
                ▼
2. FRAME CAPTURE
   captureFrameBase64()
   canvas.drawImage(video, 0, 0, 480, 360)
   canvas.toDataURL('image/jpeg', 0.55)
   → "data:image/jpeg;base64,/9j/4AAQ..."
                │
                ▼
3. HTTP REQUEST
   POST /api/analyze-frame/
   {
     imageBase64: "<base64>",
     mode: "continuous",
     recentObjects: ["Chair"]
   }
                │
                ▼
4. DJANGO VIEW (analyze_frame)
   Builds prompt + system instruction
   Strips data URI prefix from base64
                │
                ▼
5. GEMINI API CALL
   POST https://generativelanguage.googleapis.com/
        v1beta/models/gemini-3.5-flash-lite:generateContent
   Payload: image + text prompt
   Response: JSON with detectedObjects
                │
                ▼
6. JSON RESPONSE
   {
     detectedObjects: [{label, confidence, box2d, spatialPosition}],
     isSafetyHazard: false,
     spokenAnnouncement: "A chair is in front of you."
   }
                │
                ▼
7. FRONTEND RENDER
   renderAnalysisResult()
   ├── Draw box2d overlays on #boxContainer
   ├── Update #entityList with object cards
   ├── Update #announcementText
   ├── addLog() to audit trail
   └── speak() → SpeechSynthesis.speak()
```

---

## 5. Data Flow — Authentication

```
REGISTERED USER                    GUEST USER
      │                                 │
      ▼                                 ▼
POST /login/                    GET /guest-login/
username + password             session['is_guest'] = True
      │                         session['guest_start_time'] = now()
      ▼                                 │
authenticate()                          │
      │                                 │
   Success?                             │
   ├── Yes → login(user)                │
   │         session['is_guest']=False  │
   │         redirect → /              │
   └── No  → messages.error            │
             re-render login            │
                                        │
         Both redirect to ──────────────┘
                │
                ▼
           index() view
           ├── is_guest=True?
           │   ├── Calculate remaining = 300 - elapsed
           │   ├── remaining <= 0? → flush + redirect login
           │   └── Pass guest_remaining_seconds to template
           └── is_guest=False?
               └── Pass username to template

Template renders data-is-guest attr on <body>
JS reads attr → initGuestTimer() only if guest
```

---

## 6. Gemini AI Integration

```
call_gemini_api()
│
├── MODEL FALLBACK CHAIN (tried in order)
│   1. gemini-3.5-flash-lite   ← fastest, cheapest
│   2. gemini-3.5-flash
│   3. gemini-3.6-flash
│   4. gemini-3.7-flash
│   5. gemini-flash-lite-latest
│   6. gemini-flash-latest      ← last resort
│
├── REQUEST STRUCTURE
│   ├── contents[].parts[]
│   │   ├── inline_data (image JPEG base64)
│   │   └── text (prompt)
│   ├── systemInstruction.parts[].text
│   └── generationConfig
│       ├── temperature: 0.1      ← low = deterministic
│       ├── maxOutputTokens: 200
│       └── responseMimeType: "application/json" (if json_mode)
│
├── ERROR HANDLING
│   ├── 429 Rate Limit → sleep(0.5s) → try next model
│   ├── Other HTTP errors → try next model
│   └── Exception → try next model
│
└── THREE USE CASES
    ├── analyze_frame  → json_mode=True, image + detection prompt
    ├── voice_query    → json_mode=False, image + question prompt
    └── ocr_read       → json_mode=False, image + OCR prompt
```

---

## 7. Deployment Architecture

```
GitHub Repository
hasan-create/Intelligent-Real-time-Interactive-Sight
        │
        │ Auto-deploy on push to main
        ▼
┌─────────────────────────────────────────┐
│           Render Web Service            │
│                                         │
│  BUILD PHASE                            │
│  pip install -r requirements.txt        │
│  python manage.py collectstatic         │
│  python manage.py migrate               │
│                                         │
│  RUNTIME                                │
│  gunicorn iris_django.wsgi:application  │
│  Port: 10000 (Render default)           │
│                                         │
│  STATIC FILES                           │
│  WhiteNoise serves /staticfiles/        │
│  CompressedManifestStaticFilesStorage   │
│                                         │
│  ENV VARS (set in Render dashboard)     │
│  GEMINI_API_KEY, DJANGO_SECRET_KEY      │
│  DEBUG=False                            │
│  MYSQL_* connection details             │
└─────────────┬───────────────────────────┘
              │                    │
              ▼                    ▼
┌─────────────────────┐  ┌────────────────────────┐
│  Google Gemini API  │  │   Aiven Cloud MySQL    │
│  generativelanguage │  │   Virginia Region      │
│  .googleapis.com    │  │   SSL: REQUIRED        │
│                     │  │   Port: 20314          │
└─────────────────────┘  └────────────────────────┘
```

---

## 8. Security Architecture

```
LAYER 1 — Transport
  ├── HTTPS enforced (Render + Aiven)
  ├── Aiven MySQL SSL (ssl-mode=REQUIRED)
  └── Gemini API over HTTPS

LAYER 2 — Application
  ├── CSRF middleware on all POST forms
  ├── API endpoints (@csrf_exempt — JSON API, no cookie auth)
  ├── Session-based auth (Django default)
  └── DEBUG=False in production (no stack traces exposed)

LAYER 3 — Secrets
  ├── All credentials in environment variables
  ├── .env in .gitignore (never committed)
  ├── .env.example has only placeholder values
  └── Render dashboard stores secrets encrypted

LAYER 4 — Input
  ├── Django ORM prevents SQL injection
  ├── CSRF tokens on login/signup forms
  └── Gemini prompt injection risk mitigated by
      system instruction + low temperature (0.1)
```

---

## 9. Component Interaction Summary

```
┌──────────┐    frame     ┌──────────┐   prompt+image  ┌──────────────┐
│  Camera  │─────────────▶│  app.js  │────────────────▶│  Gemini API  │
└──────────┘              │          │◀────────────────│              │
                          │          │   JSON response  └──────────────┘
┌──────────┐    speech    │          │
│  Speaker │◀─────────────│          │   session data  ┌──────────────┐
└──────────┘              │          │◀───────────────▶│   Django     │
                          │          │                 │   + MySQL    │
┌──────────┐    voice     │          │────────────────▶│              │
│   Mic    │─────────────▶│          │   HTML context  └──────────────┘
└──────────┘              └──────────┘
```
