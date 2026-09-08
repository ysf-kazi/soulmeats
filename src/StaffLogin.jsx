import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "./firebase";

export default function StaffLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      onLogin(userCredential.user);
    } catch (error) {
      console.error("Staff login error:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        setError("Invalid email or password.");
      } else if (error.code === "auth/too-many-requests") {
        setError(
          "Too many unsuccessful attempts. Please try again later."
        );
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="staff-login-page">
      <div className="staff-login-background-glow staff-login-glow-one"></div>
      <div className="staff-login-background-glow staff-login-glow-two"></div>

      <div className="staff-login-card">
        <div className="staff-login-brand">
          <div className="staff-login-logo">S🔥</div>

          <div>
            <h1>Soulmeats</h1>
            <p>Open Air Restaurant</p>
          </div>
        </div>

        <div className="staff-login-title">
          <h2>Staff Login</h2>
          <p>Sign in to manage orders, tables and payments.</p>
        </div>

        <form onSubmit={handleLogin} className="staff-login-form">
          <label>
            <span>Email</span>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Staff email"
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>Password</span>

            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
            />
          </label>

          {error && (
            <div className="staff-login-error">
              <span>!</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="staff-login-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="staff-button-spinner"></span>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="staff-login-footer">
          <span>Secure staff access</span>
          <span>•</span>
          <span>Soulmeats</span>
        </div>
      </div>
    </div>
  );
}