import React, { useEffect, useRef, useState, useCallback } from "react";
import WelcomeModal from "../components/WelcomeModal.jsx";
import GuestExpiredModal from "../components/GuestExpiredModal.jsx";

const QUICK_QUERIES = [
  { label: "What's in my hand?", query: "What am I holding in my hand?" },
  {
    label: "Obstacle check",
    query: "Are there any obstacles or hazards in front of me?",
  },
  {
    label: "Room layout",
    query: "Describe the room layout and objects around me.",
  },
];

const DIFF_W = 64;
const DIFF_H = 48;

export default function DashboardPage({
  username,
  isGuest,
  guestRemainingSeconds,
  onLogout,
  onGuestExpired,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const diffCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const isAnalyzingRef = useRef(false);
  const autoAbortRef = useRef(null);
  const userBusyRef = useRef(false);
  const trackedEntitiesRef = useRef([]);
  const lastAnalyzedPixelsRef = useRef(null);
  const lastAnalysisTimeRef = useRef(0);
  const lastSpokenRef = useRef({ text: "", time: 0 });
  const speakTimerRef = useRef(null);
  const currentModeRef = useRef("continuous");

  const [cameraActive, setCameraActive] = useState(false);
  const [isAutoEnabled, setIsAutoEnabled] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentMode, setCurrentMode] = useState("continuous");
  const [isListening, setIsListening] = useState(false);
  const [customQuery, setCustomQuery] = useState("");

  const [detectedObjects, setDetectedObjects] = useState([]);
  const [isSafetyHazard, setIsSafetyHazard] = useState(false);
  const [announcementText, setAnnouncementText] = useState(
    'Ready. Tap "Analyze Now" or switch modes to begin.'
  );
  const [logs, setLogs] = useState([
    { time: "System", message: "IRIS perception gateway connected." },
  ]);

  const [welcomeOpen, setWelcomeOpen] = useState(
    () => !localStorage.getItem("iris_welcome_seen")
  );
  const [remainingSeconds, setRemainingSeconds] = useState(
    guestRemainingSeconds ?? 300
  );
  const [guestExpiredOpen, setGuestExpiredOpen] = useState(false);
  const [toastPhase, setToastPhase] = useState("visible");

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text) return;
    try {
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      speakTimerRef.current = setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.05;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn("Speech synthesis speak error:", err);
        }
      }, 50);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  }, []);

  const addLog = useCallback((message) => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [{ time, message }, ...prev.slice(0, 49)]);
  }, []);

  const sampleLowResPixels = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    if (!diffCanvasRef.current) {
      const c = document.createElement("canvas");
      c.width = DIFF_W;
      c.height = DIFF_H;
      diffCanvasRef.current = c;
    }
    const ctx = diffCanvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
    ctx.drawImage(video, 0, 0, DIFF_W, DIFF_H);
    return ctx.getImageData(0, 0, DIFF_W, DIFF_H).data;
  }, []);

  const computeSceneChangeRatio = useCallback((currentPixels) => {
    const prev = lastAnalyzedPixelsRef.current;
    if (!prev || !currentPixels || prev.length !== currentPixels.length) {
      return 1;
    }
    let changedPixels = 0;
    const totalPixels = DIFF_W * DIFF_H;
    for (let i = 0; i < currentPixels.length; i += 4) {
      const dr = Math.abs(currentPixels[i] - prev[i]);
      const dg = Math.abs(currentPixels[i + 1] - prev[i + 1]);
      const db = Math.abs(currentPixels[i + 2] - prev[i + 2]);
      if ((dr + dg + db) / 3 > 22) {
        changedPixels++;
      }
    }
    return changedPixels / totalPixels;
  }, []);

  const captureFrameBase64 = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.videoWidth === 0) {
      return "";
    }
    const ctx = canvas.getContext("2d");
    canvas.width = 480;
    canvas.height = 360;
    ctx.drawImage(video, 0, 0, 480, 360);
    return canvas.toDataURL("image/jpeg", 0.65);
  }, []);

  const stopCamera = useCallback(() => {
    if (autoAbortRef.current) {
      autoAbortRef.current.abort();
      autoAbortRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    trackedEntitiesRef.current = [];
    lastAnalyzedPixelsRef.current = null;
    setDetectedObjects([]);
    setIsSafetyHazard(false);
    setCameraActive(false);
  }, []);

  const analyzeCurrentFrame = useCallback(
    async (isAuto = false) => {
      if (!streamRef.current) {
        if (!isAuto) {
          setAnnouncementText("Camera is off. Please start the camera first.");
          speak("Camera is off. Please start the camera first.");
        }
        return;
      }

      if (isAuto && (isAnalyzingRef.current || userBusyRef.current)) return;

      if (!isAuto && autoAbortRef.current) {
        autoAbortRef.current.abort();
        autoAbortRef.current = null;
      }

      const b64 = captureFrameBase64();
      if (!b64) {
        if (!isAuto) {
          addLog("Waiting for camera video frame...");
        }
        return;
      }

      const sampled = sampleLowResPixels();
      if (sampled) {
        lastAnalyzedPixelsRef.current = new Uint8ClampedArray(sampled);
      }

      isAnalyzingRef.current = true;
      if (!isAuto) setIsAnalyzing(true);

      const controller = new AbortController();
      if (isAuto) {
        autoAbortRef.current = controller;
      }

      const recentLabels = trackedEntitiesRef.current
        .slice(0, 3)
        .map((e) => e.label);

      try {
        const res = await fetch("/api/analyze-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: b64,
            mode: currentModeRef.current,
            recentObjects: recentLabels,
          }),
        });
        const data = await res.json();

        if (isAuto && userBusyRef.current) return;

        if (data.error) {
          addLog(`Perception error: ${data.error}`);
          if (!isAuto) {
            setAnnouncementText(data.error);
          }
          return;
        }

        const objects = Array.isArray(data.detectedObjects)
          ? data.detectedObjects
          : [];
        trackedEntitiesRef.current = objects;
        setDetectedObjects(objects);
        setIsSafetyHazard(Boolean(data.isSafetyHazard));
        lastAnalysisTimeRef.current = Date.now();

        const spoken = (data.spokenAnnouncement || "").trim();
        if (spoken) {
          const now = Date.now();
          const isRepeat =
            isAuto &&
            spoken === lastSpokenRef.current.text &&
            now - lastSpokenRef.current.time < 12000;
          setAnnouncementText(spoken);
          if (!isRepeat) {
            speak(spoken);
            addLog(spoken);
            lastSpokenRef.current = { text: spoken, time: now };
          }
        } else if (!isAuto) {
          const fallbackMsg =
            objects.length > 0
              ? `Detected: ${objects.map((o) => o.label).join(", ")}.`
              : "No distinct objects detected in the current view.";
          setAnnouncementText(fallbackMsg);
          speak(fallbackMsg);
          addLog(fallbackMsg);
        }
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Analysis error:", err);
          if (!isAuto) {
            addLog("Analysis failed due to network error.");
          }
        }
      } finally {
        if (autoAbortRef.current === controller) {
          autoAbortRef.current = null;
        }
        isAnalyzingRef.current = false;
        if (!isAuto) setIsAnalyzing(false);
      }
    },
    [addLog, captureFrameBase64, sampleLowResPixels, speak]
  );

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "environment",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        videoRef.current.onloadeddata = () => {
          setTimeout(() => analyzeCurrentFrame(true), 350);
        };
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Camera error:", err);
      addLog("Camera access error. Please check permissions.");
    }
  }, [addLog, analyzeCurrentFrame]);

  useEffect(() => {
    startCamera();
    const fadeTimer = setTimeout(() => setToastPhase("fading"), 4000);
    const hideTimer = setTimeout(() => setToastPhase("hidden"), 4500);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
      if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Local pixel-diff keyframe monitor: triggers immediately on scene changes, skips redundant static uploads
  useEffect(() => {
    if (!cameraActive || !isAutoEnabled) return;

    const interval = setInterval(() => {
      if (isAnalyzingRef.current || userBusyRef.current) return;

      const now = Date.now();
      const sinceLast = now - lastAnalysisTimeRef.current;
      const currentPixels = sampleLowResPixels();
      if (!currentPixels) return;

      const changeRatio = computeSceneChangeRatio(currentPixels);

      // Major scene change (e.g. object removed or smartphone held in front of lens)
      if (changeRatio > 0.16 && sinceLast >= 800) {
        // Clear stale bounding boxes immediately so removed objects don't linger
        setDetectedObjects([]);
        setIsSafetyHazard(false);
        analyzeCurrentFrame(true);
        return;
      }

      // Moderate change detected: re-analyze promptly
      if (changeRatio > 0.08 && sinceLast >= 1200) {
        analyzeCurrentFrame(true);
        return;
      }

      // Calm heartbeat when static
      const heartbeatMs =
        currentModeRef.current === "continuous" ? 7000 : 12000;
      if (sinceLast >= heartbeatMs) {
        analyzeCurrentFrame(true);
      }
    }, 350);

    return () => clearInterval(interval);
  }, [
    cameraActive,
    isAutoEnabled,
    analyzeCurrentFrame,
    sampleLowResPixels,
    computeSceneChangeRatio,
  ]);

  // Guest 5-minute countdown timer
  useEffect(() => {
    if (!isGuest) return;
    setRemainingSeconds(guestRemainingSeconds ?? 300);

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopCamera();
          setIsAutoEnabled(false);
          setWelcomeOpen(false);
          setGuestExpiredOpen(true);
          speak(
            "Your 5 minute guest preview has expired. Please sign up or log in for unlimited access."
          );
          setTimeout(() => {
            onGuestExpired(
              "Your 5-minute guest preview has expired. Please sign up or log in to continue."
            );
          }, 4500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGuest, guestRemainingSeconds, onGuestExpired, speak, stopCamera]);

  const handleCloseWelcome = () => {
    setWelcomeOpen(false);
    localStorage.setItem("iris_welcome_seen", "true");
    speak("IRIS perception active. Starting camera feed.");
  };

  const handleToggleAuto = () => {
    const next = !isAutoEnabled;
    setIsAutoEnabled(next);
    speak(next ? "Automatic perception active." : "Automatic perception paused.");
  };

  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    currentModeRef.current = mode;
    if (mode === "continuous") {
      speak("Continuous Mode: Streaming live scene narration.");
    } else {
      speak("Smart Assist Mode: Quiet background monitoring.");
    }
  };

  const sendVoiceQuery = async (promptText) => {
    const trimmed = String(promptText || "").trim();
    if (!trimmed) return;

    if (autoAbortRef.current) {
      autoAbortRef.current.abort();
      autoAbortRef.current = null;
    }

    userBusyRef.current = true;
    setIsQuerying(true);
    setAnnouncementText(`Checking: "${trimmed}"...`);
    speak("Checking...");

    const b64 = captureFrameBase64();
    if (!b64 && !cameraActive) {
      addLog("Note: Camera is off; answering without live camera image.");
    }

    try {
      const res = await fetch("/api/voice-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userPrompt: trimmed,
          imageBase64: b64,
          contextHistory: JSON.stringify(trackedEntitiesRef.current),
        }),
      });
      const data = await res.json();
      if (data.spokenAnswer) {
        setAnnouncementText(data.spokenAnswer);
        speak(data.spokenAnswer);
        addLog(`Q: "${trimmed}" -> ${data.spokenAnswer}`);
      } else if (data.error) {
        setAnnouncementText(data.error);
        speak("Sorry, I could not process that question.");
        addLog(`Query error: ${data.error}`);
      }
    } catch {
      setAnnouncementText("Query error. Please try again.");
      speak("Query error.");
    } finally {
      setIsQuerying(false);
      setTimeout(() => {
        userBusyRef.current = false;
      }, 2500);
    }
  };

  const performOCR = async () => {
    if (autoAbortRef.current) {
      autoAbortRef.current.abort();
      autoAbortRef.current = null;
    }

    const b64 = captureFrameBase64();
    if (!b64) {
      const msg = "Camera frame not ready. Please start camera first.";
      setAnnouncementText(msg);
      speak(msg);
      return;
    }

    userBusyRef.current = true;
    setIsQuerying(true);
    setAnnouncementText("Reading text...");
    speak("Reading text...");

    try {
      const res = await fetch("/api/ocr-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: b64 }),
      });
      const data = await res.json();
      if (data.textResult) {
        setAnnouncementText(data.textResult);
        speak(data.textResult);
        addLog(`OCR: ${data.textResult}`);
      }
      if (data.error) {
        addLog(`OCR error: ${data.error}`);
      }
    } catch {
      setAnnouncementText("OCR error. Please try again.");
      speak("OCR error.");
    } finally {
      setIsQuerying(false);
      setTimeout(() => {
        userBusyRef.current = false;
      }, 2500);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const msg =
        "Voice recognition is not supported in this browser. Type your question or tap a quick chip.";
      setAnnouncementText(msg);
      speak(msg);
      addLog(msg);
      return;
    }

    userBusyRef.current = true;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let receivedResult = false;

    setIsListening(true);
    setAnnouncementText("Listening... Speak your question.");

    recognition.onresult = (event) => {
      receivedResult = true;
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setCustomQuery(transcript);
      sendVoiceQuery(transcript);
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      userBusyRef.current = false;
      const errCode = event?.error || "unknown";
      const msg =
        errCode === "not-allowed"
          ? "Microphone permission denied. Please allow mic access or type your question."
          : errCode === "no-speech"
          ? "No speech heard. Please try asking again."
          : `Voice input error (${errCode}). You can type your question or tap a quick chip.`;
      setAnnouncementText(msg);
      speak(msg);
      addLog(msg);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (!receivedResult) {
        userBusyRef.current = false;
      }
    };

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      userBusyRef.current = false;
    }
  };

  const handleCustomQuerySubmit = (e) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    const q = customQuery.trim();
    setCustomQuery("");
    sendVoiceQuery(q);
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <>
      <header className="header">
        <div className="logo-area">
          <div className="logo-icon">I</div>
          <div className="logo-text">
            <h1>IRIS SIGHT</h1>
            <p>Real-Time Multimodal Perception for the Visually Impaired</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            id="btnOpenGuide"
            className="btn btn-guide"
            title="View Instructions & Feature Guide"
            onClick={() => setWelcomeOpen(true)}
          >
            ❓ Instructions &amp; Guide
          </button>
          <div className="user-badge">
            {isGuest ? (
              <span className="badge badge-guest">
                ⏳ Guest Preview:{" "}
                <span id="guestTimer">{formatTimer(remainingSeconds)}</span>
              </span>
            ) : (
              <span className="badge badge-user">👤 {username}</span>
            )}
            <button
              type="button"
              onClick={onLogout}
              className="logout-link"
              style={{
                background: "transparent",
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        <main className="card">
          <div className="video-wrapper">
            <video ref={videoRef} id="cameraFeed" autoPlay playsInline muted />
            <canvas ref={canvasRef} id="captureCanvas" />

            <div className="hud-overlay">
              <div className="hud-sector">LEFT (0-33%)</div>
              <div className="hud-sector">CENTER (33-66%)</div>
              <div className="hud-sector">RIGHT (66-100%)</div>
            </div>

            <div
              id="boxContainer"
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              {detectedObjects.map((obj, idx) => {
                if (!obj.box2d || obj.box2d.length !== 4) return null;
                const [ymin, xmin, ymax, xmax] = obj.box2d;
                return (
                  <div
                    key={`${obj.label}-${idx}`}
                    className={`box-2d ${isSafetyHazard ? "box-hazard" : ""}`}
                    style={{
                      top: `${ymin / 10}%`,
                      left: `${xmin / 10}%`,
                      height: `${(ymax - ymin) / 10}%`,
                      width: `${(xmax - xmin) / 10}%`,
                    }}
                  >
                    <div className="box-label">
                      {obj.label} ({obj.spatialPosition})
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="announcement-box">
            <span className="announcement-icon">🔊</span>
            <div className="announcement-text" id="announcementText">
              {announcementText}
            </div>
          </div>

          <div className="controls-bar">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                id="btnAutoToggle"
                className="btn btn-primary"
                onClick={handleToggleAuto}
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  borderColor: "#34d399",
                }}
              >
                <span
                  id="autoIndicator"
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    background: isAutoEnabled ? "#34d399" : "#9ca3af",
                    borderRadius: "50%",
                    marginRight: "6px",
                    boxShadow: isAutoEnabled ? "0 0 8px #34d399" : "none",
                  }}
                />
                Auto-Analyze:{" "}
                <span id="autoStatusText">
                  {isAutoEnabled ? "ON (Streaming)" : "PAUSED"}
                </span>
              </button>
              <button
                id="btnAnalyze"
                className="btn"
                disabled={isAnalyzing}
                onClick={() => analyzeCurrentFrame(false)}
              >
                {isAnalyzing ? "Analyzing..." : "Analyze Now"}
              </button>
              <button
                id="btnToggleCam"
                className="btn"
                onClick={() => (cameraActive ? stopCamera() : startCamera())}
              >
                {cameraActive ? "Stop Camera" : "Start Camera"}
              </button>
              <button
                id="btnOcr"
                className="btn"
                disabled={isQuerying}
                onClick={performOCR}
              >
                Read Signs (OCR)
              </button>
            </div>

            <div className="mode-toggle">
              <button
                id="modeSmart"
                className={`mode-btn ${
                  currentMode === "smart_assist" ? "active" : ""
                }`}
                onClick={() => handleModeChange("smart_assist")}
              >
                Smart Assist (Quiet)
              </button>
              <button
                id="modeContinuous"
                className={`mode-btn ${
                  currentMode === "continuous" ? "active" : ""
                }`}
                onClick={() => handleModeChange("continuous")}
              >
                Continuous Narration
              </button>
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">Voice Queries</div>
            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                id="btnMic"
                className="btn btn-primary"
                style={{ flexShrink: 0 }}
                disabled={isQuerying}
                onClick={startVoiceInput}
              >
                {isListening ? "Listening..." : "🎤 Ask IRIS"}
              </button>
              <form
                onSubmit={handleCustomQuerySubmit}
                style={{
                  display: "flex",
                  gap: "6px",
                  flex: "1 1 200px",
                  minWidth: "180px",
                }}
              >
                <input
                  type="text"
                  className="glass-input"
                  style={{ padding: "8px 12px" }}
                  placeholder="Or type a question for IRIS..."
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn"
                  disabled={isQuerying || !customQuery.trim()}
                >
                  Ask
                </button>
              </form>
              <div className="quick-queries">
                {QUICK_QUERIES.map((chip) => (
                  <button
                    key={chip.label}
                    className="query-chip"
                    disabled={isQuerying}
                    onClick={() => sendVoiceQuery(chip.query)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        <aside
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          <div className="card panel-section">
            <div className="panel-title">
              <span>Active Spatial Memory</span>
              <span style={{ fontSize: "11px", color: "#38bdf8" }}>
                60s Window
              </span>
            </div>
            <div className="entity-list" id="entityList">
              {detectedObjects.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  No objects detected yet.
                </div>
              ) : (
                detectedObjects.map((obj, idx) => (
                  <div className="entity-item" key={`${obj.label}-${idx}`}>
                    <span className="entity-name">{obj.label}</span>
                    <span className="entity-meta">{obj.spatialPosition}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card panel-section" style={{ flex: 1 }}>
            <div className="panel-title">Perception &amp; Decision Audit</div>
            <div className="log-list" id="logList">
              {logs.map((entry, idx) => (
                <div className="log-item" key={idx}>
                  <div className="log-time">{entry.time}</div>
                  <div>{entry.message}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <WelcomeModal isOpen={welcomeOpen} onClose={handleCloseWelcome} />

      {isGuest && (
        <GuestExpiredModal
          isOpen={guestExpiredOpen}
          onNavigateAuth={() => onGuestExpired(null)}
        />
      )}

      {toastPhase !== "hidden" && (
        <div
          id="irisStartToast"
          className="iris-start-toast"
          style={{ opacity: toastPhase === "fading" ? 0 : 1 }}
        >
          <span className="iris-toast-dot" />
          IRIS is starting...
        </div>
      )}
    </>
  );
}
