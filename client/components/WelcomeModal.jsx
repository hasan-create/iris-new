import React from "react";

export default function WelcomeModal({ isOpen, onClose }) {
  return (
    <div id="welcomeModal" className={`modal-backdrop ${isOpen ? "active" : ""}`}>
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="logo-icon">I</div>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px" }}>
                Welcome to IRIS Agent
              </h2>
              <p
                style={{
                  margin: "2px 0 0 0",
                  color: "#94a3b8",
                  fontSize: "13px",
                }}
              >
                Your Intelligent Visual Assistant
              </p>
            </div>
          </div>
          <button
            id="btnCloseModalX"
            className="modal-close-btn"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="welcome-banner">
            👋 <strong>Hello! I am IRIS.</strong> I analyze real-time video
            frames from your camera to detect physical objects, identify hazards,
            and read text out loud.
          </div>

          <h3 className="guide-heading" style={{ color: "#38bdf8" }}>
            📖 How to Use IRIS (Quick Instructions)
          </h3>
          <div
            className="modes-guide"
            style={{ borderLeft: "3px solid #38bdf8" }}
          >
            <div className="mode-guide-item">
              <strong>1. Point Camera:</strong> Aim your phone/webcam towards
              your surroundings or hand.
            </div>
            <div className="mode-guide-item">
              <strong>2. Ask &amp; Query:</strong> Click &quot;Ask IRIS&quot; or
              speak <em>&quot;What&apos;s in my hand?&quot;</em> to ask
              questions.
            </div>
            <div className="mode-guide-item">
              <strong>3. Read Signs:</strong> Click &quot;Read Signs (OCR)&quot;
              to hear text on labels or signs spoken out loud.
            </div>
            <div className="mode-guide-item">
              <strong>4. Narration Modes:</strong> Choose{" "}
              <strong>Continuous Narration</strong> (streaming updates) or{" "}
              <strong>Smart Assist</strong> (quiet alerts only).
            </div>
          </div>

          <h3 className="guide-heading" style={{ color: "#f59e0b" }}>
            ⚠️ Prerequisites Needed
          </h3>
          <div
            className="prereq-list"
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "10px",
              padding: "12px 16px",
              fontSize: "13px",
              color: "#fef08a",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div>
              📷 <strong>1. Camera Permission:</strong> Allow camera access when
              prompted by your browser.
            </div>
            <div>
              🎙️ <strong>2. Microphone Access:</strong> Enable microphone
              permissions for voice questions.
            </div>
            <div>
              🌐 <strong>3. Internet Connection:</strong> Ensure active internet
              connectivity for AI perception.
            </div>
          </div>

          <h3 className="guide-heading">✨ Key Features</h3>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">👁️</div>
              <div className="feature-title">Real-Time Object Detection</div>
              <div className="feature-desc">
                Detects objects with 2D bounding boxes, spatial position
                (Left/Center/Right), and distance estimation.
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎙️</div>
              <div className="feature-title">Interactive Voice Queries</div>
              <div className="feature-desc">
                Click &quot;Ask IRIS&quot; or quick question chips to query your
                view: <em>&quot;What&apos;s in my hand?&quot;</em> or{" "}
                <em>&quot;Are there hazards?&quot;</em>
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📖</div>
              <div className="feature-title">OCR Sign &amp; Text Reader</div>
              <div className="feature-desc">
                Click <strong>&quot;Read Signs (OCR)&quot;</strong> to extract
                and speak aloud text from signs, packaging, or labels.
              </div>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🛡️</div>
              <div className="feature-title">Safety &amp; Hazard Alerts</div>
              <div className="feature-desc">
                Automatically warns you of trip hazards, approaching objects, or
                dangerous obstacles.
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
          <button
            id="btnStartAgent"
            className="btn btn-primary"
            style={{
              padding: "10px 28px",
              fontSize: "14px",
              fontWeight: 600,
            }}
            onClick={onClose}
          >
            🚀 Got It! Start IRIS
          </button>
        </div>
      </div>
    </div>
  );
}
