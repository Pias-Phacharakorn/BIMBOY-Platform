import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { Icon } from "@/react-components/components/ui";

export function LoginView() {
  const { loginWithEmail, signUpWithEmail, loginWithOAuth } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
        // If sign up doesn't auto-login (depends on email confirmation settings), show message
        setError("Account created! Please check your email for confirmation or sign in.");
      } else {
        // On success, auth state changes and login.tsx's beforeLoad guard
        // redirects to the ?redirect= target (or /projects). No navigate here —
        // an imperative navigate races the guard and caused a redirect loop.
        await loginWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "azure") => {
    setError(null);
    try {
      await loginWithOAuth(provider);
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}.`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-[#090a0f] px-4 relative overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-accent/8 opacity-20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-2/8 opacity-20 blur-[120px] pointer-events-none" />

      {/* Main glassmorphic login card */}
      <div className="relative z-10 w-full max-w-[420px] p-8 md:p-10 rounded-radius border border-border bg-[oklch(14.5%_0.014_255_/_80%)] backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-300">
        
        {/* Brand logo & header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center w-12 h-12 mb-3 rounded-radius bg-gradient-to-br from-accent to-accent-2 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_10px_20px_rgba(102,126,234,0.3)]">
            <div className="w-5 h-5 rounded-sm bg-bg/20 backdrop-blur-sm border border-white/20" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-fg font-ui">
            BIM BOY
          </h1>
          <p className="text-sm mt-1.5 text-muted">
            Digital BIM Management Platform
          </p>
        </div>

        {/* Auth error message display */}
        {error && (
          <div className={`flex items-start gap-2.5 p-3.5 mb-6 text-xs rounded-radius border ${
            error.includes("created") || error.includes("confirm")
              ? "bg-status-ok/10 border-status-ok/30 text-status-ok"
              : "bg-status-danger/10 border-status-danger/30 text-status-danger"
          }`}>
            <Icon name="WARNING" className="flex-none mt-0.5" size={14} />
            <div className="leading-normal">{error}</div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-2" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-10 px-3.5 border border-border-strong rounded-radius bg-[oklch(10.5%_0.012_255)] text-fg text-sm placeholder:text-muted/40 transition-colors focus:border-accent/60 outline-none"
              placeholder="name@company.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-2" htmlFor="password">
              Password
            </label>
            <div className="relative w-full">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-10 pl-3.5 pr-10 border border-border-strong rounded-radius bg-[oklch(10.5%_0.012_255)] text-fg text-sm placeholder:text-muted/40 transition-colors focus:border-accent/60 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted hover:text-fg cursor-pointer select-none transition-colors outline-none"
                title={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "HIDE" : "SHOW"} size={16} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 min-h-10 mt-2 border rounded-radius cursor-pointer text-sm font-semibold border-[oklch(69%_0.15_252)] bg-gradient-to-b from-[oklch(70%_0.16_252)] to-[oklch(57%_0.16_252)] text-[oklch(99%_0.004_255)] hover:from-[oklch(73%_0.16_252)] hover:to-[oklch(60%_0.16_252)] transition-all duration-120 hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-fg/30 border-t-fg rounded-full animate-spin" />
            ) : isSignUp ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Mode switcher link */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs font-medium text-accent hover:text-accent/80 transition-colors cursor-pointer"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Create one"}
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative z-10 px-3 text-[10px] font-bold uppercase tracking-widest bg-[oklch(14.5%_0.014_255)] text-muted-2">
            Or continue with
          </span>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin("google")}
            className="inline-flex items-center justify-center gap-2 min-h-10 px-4 border border-border-strong rounded-radius bg-surface-alt hover:bg-surface-raised text-fg cursor-pointer text-xs font-semibold transition-all duration-120 hover:-translate-y-[1px] active:translate-y-0"
          >
            <Icon name="GOOGLE" size={16} />
            <span>Google</span>
          </button>
          <button
            type="button"
            onClick={() => handleOAuthLogin("azure")}
            className="inline-flex items-center justify-center gap-2 min-h-10 px-4 border border-border-strong rounded-radius bg-surface-alt hover:bg-surface-raised text-fg cursor-pointer text-xs font-semibold transition-all duration-120 hover:-translate-y-[1px] active:translate-y-0"
          >
            <Icon name="MICROSOFT" size={16} />
            <span>Microsoft</span>
          </button>
        </div>

        {/* Guest entry — a plain link to /demo, whose route guard owns the
            flag-then-redirect flow. No imperative navigation here, for the same
            reason the sign-in path has none: it would race the guard. */}
        <div className="mt-6 pt-6 border-t border-border text-center">
          <Link
            to="/demo"
            className="inline-flex items-center justify-center gap-2 w-full min-h-10 px-4 border border-dashed border-border-strong rounded-radius bg-transparent hover:bg-surface-alt text-muted hover:text-fg cursor-pointer text-xs font-semibold transition-all duration-120 no-underline"
          >
            <Icon name="SHOW" size={14} />
            <span>Explore as Guest — no account needed</span>
          </Link>
          <p className="mt-2.5 text-[10px] leading-relaxed text-muted-2">
            Opens a read-only sample project. Nothing you do is saved.
          </p>
        </div>
      </div>
    </div>
  );
}
