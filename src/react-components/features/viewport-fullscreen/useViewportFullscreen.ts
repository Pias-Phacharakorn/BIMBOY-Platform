import { useCallback, useEffect } from "react";
import { useUIStore } from "@/react-components/store/uiStore";

/**
 * Full-screen viewport mode: the app's own chrome and the browser's fullscreen, driven as one thing.
 *
 * **The browser owns the state; this module only mirrors it.** `toggle` asks
 * (`requestFullscreen`/`exitFullscreen`) and writes nothing — every write to
 * `uiStore.isViewportFullscreen` comes from a `fullscreenchange` event. That is deliberate, and it
 * is what buys Esc and F11 as exit paths: the browser handles those keys itself and then raises
 * `fullscreenchange`, so this app never binds a keydown listener for Escape. It could not safely —
 * `ClipperPlacementManager` keeps a lifetime-long global Escape handler for section-plane placement,
 * and one more would make Esc cancel a plane placement *and* drop out of fullscreen.
 *
 * The trade the single-writer rule makes: if `requestFullscreen()` is rejected (an iframe without
 * `allow="fullscreen"`, a browser policy), nothing happens at all — the chrome stays put rather than
 * hiding with no fullscreen behind it.
 *
 * Fullscreen is requested on `documentElement`, not on the viewport element. Anything portalled to
 * `document.body` — `BackgroundSettingsModal`, `CloudModelLoadingModal` — is not a descendant of a
 * fullscreened subtree and would simply not be painted; the Settings menu in the very toolbar that
 * offers this button opens one of them.
 *
 * Split in two on purpose. The listener and the exit-on-unmount belong to whoever *owns* the mode
 * (one view), while any number of buttons may want to read it and toggle it — folding both into one
 * hook would give every future caller an unmount that silently drops the user out of fullscreen.
 */

/**
 * Read the mode and toggle it. Safe to call from as many components as you like — no listeners, no
 * cleanup, no side effects beyond the user's own click.
 */
export function useViewportFullscreen() {
  const isFullscreen = useUIStore((state) => state.isViewportFullscreen);

  const toggle = useCallback(() => {
    // Failures are swallowed on purpose: a rejected request leaves the store false, which is
    // already the honest answer. See the all-or-nothing trade above.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return { isFullscreen, toggle };
}

/**
 * Owns the mode for one view: mirrors `fullscreenchange` into the store, and guarantees the view
 * cannot be left while the chrome is hidden.
 *
 * **Call this exactly once, from the view that renders the viewport.** The flag lives in `uiStore`
 * and `AppShell` wraps every workspace view, so a mode surviving a route change would hide the
 * header of a page with no toolbar to turn it back on.
 */
export function useViewportFullscreenOwner() {
  const setViewportFullscreen = useUIStore((state) => state.setViewportFullscreen);

  useEffect(() => {
    const sync = () => setViewportFullscreen(document.fullscreenElement !== null);

    document.addEventListener("fullscreenchange", sync);
    // The DOM is the authority even at mount: the document can already be fullscreen here (a
    // remount inside the mode), while the store starts at false.
    sync();

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      // The listener is gone by now, so `exitFullscreen` will not write the flag back — clear it
      // directly rather than relying on an event nobody is listening for.
      setViewportFullscreen(false);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [setViewportFullscreen]);
}
