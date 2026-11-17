import React from "react";
import { Link } from "react-router-dom";

export default function GuestExpiredModal({ isOpen, onNavigateAuth }) {
  return (
    <div
      id="guestExpiredModal"
      className={`modal-backdrop ${isOpen ? "active" : ""}`}
    >
      <div
        className="modal-content"
        style={{ maxWidth: "480px", textAlign: "center", padding: "12px" }}
      >
        <div className="modal-header" style={{ justifyContent: "center" }}>
          <div className="logo-icon">I</div>
          <h2 style={{ marginLeft: "10px", fontSize: "20px" }}>
            Guest Preview Expired
          </h2>
        </div>
        <div
          className="modal-body"
          style={{ alignItems: "center", textAlign: "center" }}
        >
          <div style={{ fontSize: "48px", marginBottom: "8px" }}>⏳</div>
          <p
            style={{
              fontSize: "15px",
              color: "#e2e8f0",
              lineHeight: 1.5,
            }}
          >
            Your <strong>5-minute guest preview</strong> has ended. Please log
            in or sign up to enjoy unlimited real-time visual assistance.
          </p>
        </div>
        <div
          className="modal-footer"
          style={{ justifyContent: "center", gap: "12px" }}
        >
          <Link
            to="/login"
            onClick={onNavigateAuth}
            className="btn btn-primary"
            style={{ padding: "10px 24px", textDecoration: "none" }}
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            onClick={onNavigateAuth}
            className="btn btn-secondary"
            style={{ padding: "10px 24px", textDecoration: "none" }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
