import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import SignupPage from "./pages/SignupPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

const TOKEN_KEY = "iris_session_token";

export default function App() {
  const [auth, setAuth] = useState({
    loading: true,
    authenticated: false,
    isGuest: false,
    username: null,
    guestRemainingSeconds: 300,
    flashMessage: null,
  });
  const navigate = useNavigate();

  const refreshAuth = useCallback(async () => {
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!data.authenticated) {
        sessionStorage.removeItem(TOKEN_KEY);
      }
      setAuth((prev) => ({
        loading: false,
        authenticated: Boolean(data.authenticated),
        isGuest: Boolean(data.isGuest),
        username: data.username || null,
        guestRemainingSeconds: data.guestRemainingSeconds ?? 300,
        flashMessage: data.expired
          ? { type: "error", text: data.message }
          : prev.flashMessage,
      }));
    } catch {
      setAuth((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const handleLoginSuccess = async (data) => {
    if (data?.token) {
      sessionStorage.setItem(TOKEN_KEY, data.token);
    }
    if (data?.authenticated) {
      setAuth({
        loading: false,
        authenticated: true,
        isGuest: Boolean(data.isGuest),
        username: data.username || "Guest User",
        guestRemainingSeconds: data.guestRemainingSeconds ?? 300,
        flashMessage: null,
      });
    } else {
      await refreshAuth();
    }
    navigate("/");
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setAuth({
      loading: false,
      authenticated: false,
      isGuest: false,
      username: null,
      guestRemainingSeconds: 300,
      flashMessage: null,
    });
    navigate("/login");
  };

  if (auth.loading) {
    return (
      <div className="auth-body">
        <div className="glass-card" style={{ textAlign: "center" }}>
          <div className="logo-icon">I</div>
          <p style={{ color: "#94a3b8", fontSize: "13px" }}>
            Loading IRIS Sight...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          auth.authenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage
              initialMessage={auth.flashMessage}
              onAuthSuccess={handleLoginSuccess}
            />
          )
        }
      />
      <Route
        path="/signup"
        element={
          auth.authenticated ? (
            <Navigate to="/" replace />
          ) : (
            <SignupPage onAuthSuccess={handleLoginSuccess} />
          )
        }
      />
      <Route
        path="/"
        element={
          auth.authenticated ? (
            <DashboardPage
              username={auth.username}
              isGuest={auth.isGuest}
              guestRemainingSeconds={auth.guestRemainingSeconds}
              onLogout={handleLogout}
              onGuestExpired={(msg) => {
                sessionStorage.removeItem(TOKEN_KEY);
                setAuth({
                  loading: false,
                  authenticated: false,
                  isGuest: false,
                  username: null,
                  guestRemainingSeconds: 0,
                  flashMessage: msg ? { type: "error", text: msg } : null,
                });
                navigate("/login");
              }}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
