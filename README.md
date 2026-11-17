# IRIS — Intelligent Real-time Interactive Sight

> A real-time AI-powered visual perception assistant for the blind and visually impaired.

---

## What is IRIS?

IRIS (Intelligent Real-time Interactive Sight) is a web-based assistive technology application that uses your device's camera and Google's Gemini AI to help blind and low-vision individuals perceive and understand their surroundings in real time.

It detects objects, identifies safety hazards, reads signs and text out loud, and answers spoken voice queries — all from a live camera feed.

---

## Features

- **Real-Time Object Detection** — Detects physical objects in the camera frame with 2D bounding box overlays, spatial positioning (Left / Center / Right), and distance estimation.
- **Continuous Narration Mode** — Streams live scene descriptions out loud using the browser's speech synthesis.
- **Smart Assist Mode** — Stays quiet in the background and only speaks up when a new object or safety hazard is detected.
- **Voice Queries** — Ask IRIS questions like *"What am I holding?"* or *"Are there any obstacles?"* using your microphone or quick-tap chips.
- **OCR Sign & Text Reader** — Reads visible text from signs, labels, packaging, and screens out loud.
- **Safety Hazard Alerts** — Automatically warns users of trip hazards or approaching dangerous objects.
- **Guest Preview Mode** — New visitors can try IRIS for 5 minutes without creating an account.
- **User Authentication** — Full sign up, login, and logout with session management.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 5 (Python) |
| AI / Vision | Google Gemini API (multimodal) |
| Database | MySQL (Aiven Cloud) |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Speech | Web Speech API (browser-native) |
| Deployment | Render (gunicorn + whitenoise) |
| Static Files | WhiteNoise |

---

## Project Structure

```
iris_django_project/
│
├── iris_django/          # Django project config
│   ├── settings.py       # App settings, DB config, static files
│   ├── urls.py           # Root URL routing
│   └── wsgi.py           # WSGI entry point for deployment
│
├── vision/               # Main Django app
│   ├── views.py          # All views: auth, dashboard, API endpoints
│   ├── urls.py           # App-level URL routing
│   └── apps.py
│
├── templates/
│   └── vision/
│       ├── index.html    # Main dashboard UI
│       ├── login.html    # Login page
│       └── signup.html   # Sign up page
│
├── static/
│   ├── css/style.css     # All styles (glassmorphism dark UI)
│   └── js/app.js         # Frontend logic (camera, AI calls, speech)
│
├── requirements.txt      # Python dependencies
├── render.yaml           # Render deployment config
├── .env.example          # Environment variable template
└── manage.py
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main dashboard (requires login) |
| `/login/` | GET, POST | User login |
| `/signup/` | GET, POST | User registration |
| `/logout/` | GET | Logout and clear session |
| `/guest-login/` | GET | Start 5-minute guest session |
| `/api/analyze-frame/` | POST | Analyze camera frame with Gemini AI |
| `/api/voice-query/` | POST | Answer a spoken user question |
| `/api/ocr-read/` | POST | Extract and read text from image |
| `/api/health/` | GET | Health check endpoint |

---

## How It Works

1. The user opens the app and grants camera permission.
2. The frontend (`app.js`) captures frames from the live video feed every 5 seconds.
3. Each frame is converted to base64 and sent to `/api/analyze-frame/`.
4. The Django backend sends the image to the **Google Gemini API** with a structured prompt.
5. Gemini returns detected objects with bounding boxes, spatial positions, and a spoken announcement.
6. The frontend renders bounding boxes on the video, updates the object list, and speaks the announcement aloud using the Web Speech API.
7. Users can ask voice queries or tap quick-query chips for instant AI answers about their view.

---

## Running Locally

### Prerequisites
- Python 3.10+
- MySQL running locally or a cloud MySQL instance
- Google Gemini API key ([get one here](https://aistudio.google.com))

### Setup

```bash
# Clone the repo
git clone https://github.com/hasan-create/Intelligent-Real-time-Interactive-Sight.git
cd Intelligent-Real-time-Interactive-Sight

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env template and fill in your values
copy .env.example .env     # Windows
cp .env.example .env       # Mac/Linux

# Run migrations
python manage.py migrate

# Start the development server
python manage.py runserver
```

Then open [http://localhost:8000](http://localhost:8000)

---

## Environment Variables

Create a `.env` file in the root directory with the following:

```env
GEMINI_API_KEY=your_gemini_api_key
DJANGO_SECRET_KEY=your_django_secret_key

MYSQL_DATABASE=your_db_name
MYSQL_USER=your_db_user
MYSQL_PASSWORD=your_db_password
MYSQL_HOST=your_db_host
MYSQL_PORT=3306
```

---

## Deployment (Render)

This project is configured for one-click deployment on [Render](https://render.com).

**Build Command:**
```
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

**Start Command:**
```
gunicorn iris_django.wsgi:application
```

Set all environment variables in the Render dashboard under **Environment**.

---

## Guest Mode

Users can try IRIS without registering via the **"Continue as Guest"** button on the login page. Guest sessions are limited to **5 minutes**, after which they are redirected to login or sign up.

---

## Accessibility

IRIS is built specifically for **blind and low-vision users**:
- All detections are announced via text-to-speech
- Safety hazards trigger immediate audio alerts
- Voice query support means hands-free interaction
- Minimal UI with high contrast dark theme

---

## License

MIT License — free to use, modify, and distribute.

---

## Author

Built by **Hasan** — IRIS AI Perception Project
