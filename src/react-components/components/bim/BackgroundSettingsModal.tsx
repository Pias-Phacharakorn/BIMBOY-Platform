import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Palette } from "lucide-react";
import { ColorRow, PresetRow } from "@/react-components/components/ui";
import { useUIStore } from "@/react-components/store/uiStore";
import {
  VIEWPORT_BACKGROUND_PRESETS,
  VIEWPORT_BACKGROUND_SEED,
  applyViewportBackground,
  viewportBackgroundCss,
  type ViewportBackground,
  type ViewportBackgroundStyle,
} from "@/lib/viewportBackground";

/**
 * Viewport backdrop settings — the Navisworks "Background Settings" dialog, cut down to the two
 * styles this app wants: Graduated (top + bottom) and Plain (one colour).
 *
 * **The real viewport is the preview.** Every change paints immediately, so the pane on the left is
 * a convenience rather than the only feedback. What makes that safe is the snapshot: the background
 * as it stood when the dialog opened is held in a ref, and Cancel — including Escape and a click on
 * the backdrop — puts it back.
 *
 * **`null` is not "no value", it is the default.** It means no `--viewport-bg` override, i.e. the
 * branded gradient in `style.css`. The pickers open on {@link VIEWPORT_BACKGROUND_SEED} in that
 * state, and "Reset to defaults" returns to `null` rather than writing those seed colours — so the
 * default look is the original CSS rule, not an approximation of it.
 *
 * **A preset is a starting point, not a mode.** Dark and White write a whole
 * {@link ViewportBackground} through the same `commit` a colour picker uses, after which every
 * control below stays editable — so there is no "am I in a preset" state to keep in sync, and
 * Cancel, Escape and Reset behave exactly as they did before presets existed. Note that Dark is not
 * Reset: it is a vertical two-stop gradient, where the default is the branded 135° rule.
 *
 * Portalled to `document.body`, as `CloudModelModal` is: the Settings dropdown that opens this has
 * its own outside-click handler, and a dialog rendered inside it would be closed by its own clicks.
 * Mounted only while open, also as `CloudModelModal` is — that is what makes the snapshot and the
 * draft plain initialisers rather than effects.
 */
export function BackgroundSettingsModal() {
  const { setBackgroundModalOpen, viewportBackground, setViewportBackground } = useUIStore();

  // Mounted only while open (see ToolbarSettings), which is what lets both of these initialise from
  // the live background at open time instead of resynchronising through an effect.
  //
  // What Cancel restores.
  const snapshot = useRef<ViewportBackground | null>(viewportBackground);
  // The pickers always need concrete colours, even when the background is the CSS default.
  const [draft, setDraft] = useState<ViewportBackground>(
    viewportBackground ?? VIEWPORT_BACKGROUND_SEED,
  );

  /** The one path that changes anything: store and DOM move together, never one without the other. */
  const commit = (next: ViewportBackground | null) => {
    setViewportBackground(next);
    applyViewportBackground(next);
    if (next) setDraft(next);
  };

  const cancel = () => {
    commit(snapshot.current);
    setBackgroundModalOpen(false);
  };

  const reset = () => {
    commit(null);
    setDraft(VIEWPORT_BACKGROUND_SEED);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // `cancel` only reads a ref and zustand setters, so binding once per opening is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPlain = draft.style === "plain";

  // Derived every render rather than stored: editing a colour away from a preset unlights its
  // swatch for free, and typing one back lights it again. Matched against the *committed*
  // background, not the draft, so the default state (`null`) correctly lights neither — the draft
  // is seeded with Dark's colours there, and highlighting Dark would claim a backdrop the viewport
  // is not showing.
  const activePresetId =
    (viewportBackground &&
      VIEWPORT_BACKGROUND_PRESETS.find(
        ({ background }) =>
          background.style === viewportBackground.style &&
          background.topColor.toLowerCase() === viewportBackground.topColor.toLowerCase() &&
          background.bottomColor.toLowerCase() === viewportBackground.bottomColor.toLowerCase(),
      )?.id) ??
    null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={cancel}
    >
      <div
        className="w-[520px] max-w-full flex flex-col bg-surface border border-border rounded-radius shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Background settings"
      >
        <div className="flex items-center gap-2 px-4 py-3 bg-surface-raised border-b border-border">
          <Palette className="w-4 h-4 text-accent" />
          <span className="text-xs font-bold text-fg">Background Settings</span>
        </div>

        <div className="flex gap-4 p-4">
          {/* Shows the draft even before it differs from the viewport, so the two styles can be
              compared without committing to either. */}
          <div
            className="w-44 h-44 shrink-0 rounded border border-border"
            style={{ background: viewportBackgroundCss(draft) }}
            aria-label="Background preview"
          />

          <div className="flex flex-col gap-3.5 flex-1 min-w-0">
            <PresetRow
              label="Theme"
              options={VIEWPORT_BACKGROUND_PRESETS.map(({ id, label, background }) => ({
                id,
                label,
                background: viewportBackgroundCss(background),
              }))}
              activeId={activePresetId}
              onSelect={(id) => {
                const preset = VIEWPORT_BACKGROUND_PRESETS.find((option) => option.id === id);
                if (preset) commit(preset.background);
              }}
            />

            <div className="flex items-center justify-between gap-3 text-xs text-fg">
              <span className="font-medium text-muted">Style</span>
              <div className="relative flex items-center">
                <select
                  value={draft.style}
                  onChange={(event) =>
                    commit({ ...draft, style: event.target.value as ViewportBackgroundStyle })
                  }
                  className="appearance-none bg-surface-alt border border-border rounded pl-2.5 pr-7 py-1.5 text-xs text-fg cursor-pointer focus:outline-none focus:border-accent font-semibold"
                >
                  <option value="graduated">Graduated</option>
                  <option value="plain">Plain</option>
                </select>
                <div className="pointer-events-none absolute right-2.5 text-muted flex items-center">
                  <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Plain reuses topColor, so flipping Graduated -> Plain -> Graduated keeps the
                gradient's bottom colour instead of forgetting it. */}
            <ColorRow
              label={isPlain ? "Color" : "Top Color"}
              value={draft.topColor}
              onChange={(topColor) => commit({ ...draft, topColor })}
            />
            {!isPlain && (
              <ColorRow
                label="Bottom Color"
                value={draft.bottomColor}
                onChange={(bottomColor) => commit({ ...draft, bottomColor })}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-raised border-t border-border">
          <button type="button" onClick={reset} className={BUTTON}>
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancel} className={BUTTON}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setBackgroundModalOpen(false)}
              className="inline-flex items-center px-3 py-1 border border-accent rounded-radius bg-accent/15 text-xs font-semibold text-fg hover:bg-accent/25 transition-colors duration-120"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const BUTTON =
  "inline-flex items-center px-3 py-1 border border-border rounded-radius bg-surface-alt text-xs font-semibold text-muted hover:border-accent hover:text-fg transition-colors duration-120";
