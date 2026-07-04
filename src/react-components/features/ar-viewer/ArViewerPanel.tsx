import { useRef } from "react";
import { Icon } from "@/react-components/components/ui";
import { useArSession } from "./useArSession";

export function ArViewerPanel() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { status, isSupported, error, start, exit } = useArSession(overlayRef);
  const sessionActive = status === "active";

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {!sessionActive && (
        <div className="pointer-events-auto flex flex-col items-center gap-3 p-6 border border-border bg-surface/95 rounded-radius max-w-sm text-center">
          <Icon name="AR" size={28} />
          {isSupported === false ? (
            <>
              <h3 className="text-sm font-semibold text-fg">
                AR is not supported on this device
              </h3>
              <p className="text-xs text-muted">
                Web AR requires Chrome or Edge on Android, or the Meta Quest
                Browser. iOS Safari and desktop browsers don't support
                immersive AR sessions yet.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-fg">
                View this model in AR
              </h3>
              <p className="text-xs text-muted">
                Point your camera at a flat surface, tap to place the model at
                real-world scale, then walk around it.
              </p>
              <button
                type="button"
                onClick={start}
                disabled={isSupported === null || status === "requesting"}
                className="inline-flex items-center justify-center gap-2 min-h-8 px-4 border rounded-radius cursor-pointer text-xs font-semibold border-accent bg-gradient-to-b from-accent to-accent-muted text-fg hover:from-accent hover:to-accent/90 transition-all duration-120 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "requesting" ? "Starting AR..." : "Enter AR"}
              </button>
              {status === "error" && (
                <p className="text-xs text-red-400 break-words">
                  Couldn't start the AR session
                  {error ? `: ${error}` : ". Check camera permissions and try again."}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {sessionActive && (
        <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-black/60 text-white text-xs">
            Tap a detected surface to place the model
          </span>
          <button
            type="button"
            onClick={exit}
            className="inline-flex items-center justify-center gap-2 min-h-8 px-4 border border-border rounded-radius cursor-pointer text-xs font-semibold bg-surface/95 text-fg hover:bg-surface-alt transition-colors duration-120"
          >
            Exit AR
          </button>
        </div>
      )}
    </div>
  );
}
