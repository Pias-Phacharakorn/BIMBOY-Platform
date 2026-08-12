import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/react-components/features/auth/useAuth";

/**
 * Landing screen for /demo. Flips the guest flag on mount and then does nothing —
 * /demo's `beforeLoad` guard performs the redirect once main.tsx re-validates the
 * router, keeping route navigation in one place.
 *
 * Visible only for the instant before that redirect, or indefinitely if guest mode
 * somehow fails to take, which is why it still offers a way out.
 */
export function GuestEntryView() {
  const { continueAsGuest, isGuest } = useAuth();

  useEffect(() => {
    if (!isGuest) continueAsGuest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen w-screen bg-[#090a0f] px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-fg">Preparing the demo workspace…</span>
          <span className="text-xs text-muted">Loading a sample BIM model — no account needed.</span>
        </div>
        <Link
          to="/login"
          className="text-xs font-medium text-muted hover:text-fg transition-colors no-underline"
        >
          Sign in instead
        </Link>
      </div>
    </div>
  );
}
