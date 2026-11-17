import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function SignupPage({ onAuthSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username,
          email,
          password,
          confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Could not create account.",
        });
        return;
      }
      await onAuthSuccess(data);
    } catch {
      setMessage({
        type: "error",
        text: "Network error while creating account. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
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
            <h2>CREATE ACCOUNT</h2>
            <p>Join the IRIS AI Perception Network</p>
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
                placeholder="Choose Username"
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
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <input
                type="email"
                id="email"
                name="email"
                className="glass-input"
                placeholder="Email Address (Optional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                className="glass-input"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="glass-btn btn-login"
              disabled={submitting}
            >
              {submitting ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
            </button>
          </form>

          <div className="auth-footer-text">
            Already have an account?{" "}
            <Link to="/login" className="auth-signup-link">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
