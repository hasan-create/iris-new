import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function LoginPage({ initialMessage, onAuthSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState(initialMessage || null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Invalid username or password.",
        });
        return;
      }
      await onAuthSuccess(data);
    } catch {
      setMessage({
        type: "error",
        text: "Network error while logging in. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestLogin = async () => {
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/guest", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        await onAuthSuccess(data);
      } else {
        setMessage({ type: "error", text: "Could not start guest session." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    setMessage({
      type: "success",
      text: "Please sign up a new account or continue as a guest.",
    });
  };

  return (
    <div className="auth-body">
      <div className="auth-wrapper">
        <div className="glass-card">
          <div className="auth-camera-badge">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="camera-svg"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </div>

          <div className="auth-title-area">
            <h2>IRIS SIGHT</h2>
            <p>Real-Time Multimodal Perception Agent</p>
          </div>

          {message && (
            <div className="messages-list" style={{ width: "100%" }}>
              <div className={`alert alert-${message.type}`}>{message.text}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-field-group">
              <div className="input-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="field-svg"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <input
                type="text"
                id="username"
                name="username"
                className="glass-input"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="input-field-group">
              <div className="input-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="field-svg"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                className="glass-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="form-options">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  name="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="custom-checkbox"></span>
                <span className="checkbox-label">Remember me</span>
              </label>
              <a
                href="#forgot"
                className="forgot-link"
                onClick={handleForgotPassword}
              >
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              className="glass-btn btn-login"
              disabled={submitting}
            >
              {submitting ? "LOGGING IN..." : "LOGIN"}
            </button>
          </form>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            className="glass-btn btn-guest-mode"
            disabled={submitting}
          >
            ⚡ CONTINUE AS GUEST
          </button>

          <div className="auth-footer-text">
            Don't have an account?{" "}
            <Link to="/signup" className="auth-signup-link">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
