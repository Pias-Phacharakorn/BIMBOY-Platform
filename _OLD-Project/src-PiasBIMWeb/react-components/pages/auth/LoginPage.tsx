import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export function LoginPage() {
  const { user, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || "/projects";
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      // Successful auth redirects via the useEffect hook
    } catch (err: any) {
      console.error(err);
      let errMsg = "An unexpected error occurred. Please try again.";
      if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        errMsg = "This email is already in use.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Invalid email address format.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Google Sign-In failed.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Local styles for premium page aesthetics */}
      <style>{`
        .login-page-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          width: 100vw;
          background: 
            radial-gradient(circle at 80% 20%, oklch(70% 0.15 252 / 12%), transparent 45%),
            radial-gradient(circle at 10% 80%, oklch(74% 0.13 195 / 8%), transparent 45%),
            linear-gradient(135deg, oklch(10% 0.012 255) 0%, oklch(6% 0.008 255) 100%);
          overflow: hidden;
          font-family: var(--font-ui);
          position: relative;
        }

        .login-page-container::before {
          content: "";
          position: absolute;
          width: 300px;
          height: 300px;
          background: var(--accent);
          filter: blur(150px);
          opacity: 0.15;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          border-radius: 50%;
        }

        .login-card {
          width: min(440px, 90vw);
          padding: 40px;
          background: rgba(20, 20, 25, 0.65);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 16px;
          box-shadow: 
            0 24px 60px oklch(4% 0.02 255 / 55%),
            inset 0 1px 0 oklch(100% 0 0 / 8%);
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 28px;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .login-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .login-logo {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          box-shadow: 
            0 0 0 1px oklch(88% 0.06 230 / 18%), 
            0 12px 28px oklch(66% 0.17 252 / 30%);
        }

        .login-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, var(--fg) 40%, var(--muted) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .login-subtitle {
          font-size: 13px;
          color: var(--muted);
        }

        .mode-switcher {
          display: flex;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 4px;
          position: relative;
        }

        .mode-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          z-index: 2;
          transition: color 0.2s ease;
        }

        .mode-btn.active {
          color: var(--fg);
        }

        .mode-slider {
          position: absolute;
          top: 4px;
          bottom: 4px;
          width: calc(50% - 4px);
          background: var(--surface-raised);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          z-index: 1;
          transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .mode-slider.right {
          transform: translateX(100%);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--muted);
          letter-spacing: 0.02em;
        }

        .input-field {
          height: 42px;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          color: var(--fg);
          font-size: 14px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }

        .input-field:focus {
          border-color: var(--accent);
          box-shadow: var(--focus-ring);
          outline: none;
        }

        .input-field:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .error-banner {
          padding: 10px 14px;
          background: oklch(63% 0.18 28 / 12%);
          border: 1px solid oklch(63% 0.18 28 / 30%);
          border-radius: var(--radius);
          color: var(--status-danger);
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          animation: slideDown 0.2s ease;
        }

        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .submit-btn {
          height: 42px;
          width: 100%;
          background: linear-gradient(180deg, oklch(70% 0.16 252), oklch(57% 0.16 252));
          border: 1px solid oklch(69% 0.15 252);
          border-radius: var(--radius);
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.12s ease, border-color 0.12s ease, filter 0.12s ease;
        }

        .submit-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .divider-container {
          display: flex;
          align-items: center;
          gap: 16px;
          color: var(--muted-2);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .divider-line {
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .oauth-btn {
          height: 42px;
          width: 100%;
          background: transparent;
          border: 1px solid var(--border-strong);
          border-radius: var(--radius);
          color: var(--fg);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .oauth-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--muted);
        }

        .oauth-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .google-icon {
          width: 18px;
          height: 18px;
        }
      `}</style>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo" />
          <div className="login-title">PiasBimWeb</div>
          <div className="login-subtitle">
            {isRegister
              ? "Create your engineering operations account"
              : "Sign in to access your BIM workspaces"}
          </div>
        </div>

        <div className="mode-switcher">
          <div className={`mode-slider ${isRegister ? "right" : ""}`} />
          <button
            type="button"
            className={`mode-btn ${!isRegister ? "active" : ""}`}
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
            disabled={loading}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`mode-btn ${isRegister ? "active" : ""}`}
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
            disabled={loading}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="error-banner">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              EMAIL ADDRESS
            </label>
            <input
              id="email"
              type="email"
              className="input-field"
              placeholder="engineer@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
            />
          </div>

          {isRegister && (
            <div className="input-group">
              <label className="input-label" htmlFor="confirm-password">
                CONFIRM PASSWORD
              </label>
              <input
                id="confirm-password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading && <div className="btn-spinner" />}
            {loading
              ? (isRegister ? "Creating Account..." : "Signing In...")
              : (isRegister ? "Create Account" : "Sign In")}
          </button>
        </form>

        <div className="divider-container">
          <div className="divider-line" />
          <span>or</span>
          <div className="divider-line" />
        </div>

        <button
          type="button"
          className="oauth-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {/* Custom vector Google Icon */}
          <svg className="google-icon" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.345 0 3.327 2.673 1.345 6.582l3.92 3.183z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.273c0-.818-.073-1.609-.209-2.373H12v4.509h6.445c-.277 1.482-1.114 2.736-2.373 3.582l3.7 2.873c2.164-2 3.418-4.945 3.418-8.591z"
            />
            <path
              fill="#FBBC05"
              d="M5.266 14.235A7.09 7.09 0 0 1 4.909 12c0-.79.13-1.555.357-2.264l-3.92-3.182C.482 8.245 0 10.064 0 12c0 1.936.482 3.755 1.345 5.445l3.921-3.21z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.245 0 5.973-1.073 7.964-2.909l-3.7-2.873c-1.027.691-2.345 1.1-4.264 1.1a7.077 7.077 0 0 1-6.734-4.855L1.345 17.67C3.327 21.327 7.345 24 12 24z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  );
}
