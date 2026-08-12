/**
 * The guest-demo session flag, and the single source of truth for it.
 *
 * Lives in `lib/` rather than a feature because two layers need it and neither may
 * import the other: `AuthContext` (React state) and the route `beforeLoad` guards
 * (plain functions, no React).
 *
 * ⚠️ Guards must read this **directly**, not via `context.auth.isGuest`. On a hard
 * page load the router evaluates `beforeLoad` before `RouterProvider`'s context is
 * wired (`router.tsx` starts with `auth: undefined!`), so a guard that trusted the
 * context alone redirected refreshing guests to /login — and unlike a signed-in
 * user, whom login.tsx's guard bounces back to the ?redirect target, a guest has
 * nothing to bounce them back and was stranded there.
 *
 * sessionStorage, not localStorage: a refresh should stay inside the demo, but
 * closing the tab should end it.
 */
const GUEST_STORAGE_KEY = "bimboy.guestMode";

export function isGuestSession(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(GUEST_STORAGE_KEY) === "1";
}

export function startGuestSession(): void {
  sessionStorage.setItem(GUEST_STORAGE_KEY, "1");
}

export function endGuestSession(): void {
  sessionStorage.removeItem(GUEST_STORAGE_KEY);
}
