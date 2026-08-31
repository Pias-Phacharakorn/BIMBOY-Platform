/**
 * The viewport backdrop, as CSS.
 *
 * The 3D canvas is transparent — `create-world.ts` sets `world.scene.three.background = null` — so
 * what you see behind the model is `.viewport-container`'s CSS background showing through. This
 * module drives that one rule through a custom property instead of adding a second mechanism:
 * no `THREE.Color`, no generated `CanvasTexture`, and nothing new in front of the AO and edge
 * detection passes.
 *
 * **`null` is a real state, and it is the default.** With no property set, `.viewport-container`
 * falls back to the branded backdrop it has always had (135° gradient + blue radial highlight, see
 * `style.css`). Resetting removes the property rather than writing a colour, so the default is
 * never approximated — it is the original rule, untouched.
 */

export type ViewportBackgroundStyle = "graduated" | "plain";

export interface ViewportBackground {
  style: ViewportBackgroundStyle;
  /** Top of the gradient — and, in `plain`, the single background colour. */
  topColor: string;
  /** Bottom of the gradient. Kept while in `plain` so switching back is lossless. */
  bottomColor: string;
}

/** The custom property `.viewport-container` reads. */
export const VIEWPORT_BACKGROUND_VAR = "--viewport-bg";

/**
 * The effective backdrop, for anything that wants to show it outside the viewport — the settings
 * row's swatch. Resolves to the override when there is one and to `--viewport-bg-default` (the
 * branded rule in `style.css`) when there is not, so no caller has to duplicate either value or
 * even know which is in play.
 */
export const VIEWPORT_BACKGROUND_CURRENT_CSS = `var(${VIEWPORT_BACKGROUND_VAR}, var(--viewport-bg-default))`;

export type ViewportBackgroundPresetId = "dark" | "white";

export interface ViewportBackgroundPreset {
  id: ViewportBackgroundPresetId;
  label: string;
  background: ViewportBackground;
}

/**
 * The two themed backdrops offered as one click in the settings dialog.
 *
 * They are ordinary {@link ViewportBackground} values, not a third state — selecting one is written
 * through the same path a colour picker uses, so Style, Top and Bottom stay editable afterwards and
 * Cancel / Reset need to know nothing about presets. They live here rather than in the dialog so a
 * future toolbar quick-toggle can reuse them without importing a component.
 *
 * **Dark is not the same as Reset.** Dark is a vertical two-stop gradient; the default that this
 * module's `null` state hands back is the branded 135° rule plus a blue radial highlight
 * (`style.css`), which no combination of these two colours reproduces.
 */
export const VIEWPORT_BACKGROUND_PRESETS: readonly ViewportBackgroundPreset[] = [
  {
    id: "dark",
    label: "Dark",
    background: { style: "graduated", topColor: "#05192E", bottomColor: "#010205" },
  },
  {
    id: "white",
    label: "White",
    background: { style: "graduated", topColor: "#C4D8ED", bottomColor: "#B8B8B8" },
  },
];

/**
 * What the pickers open on when nothing has been chosen yet — the Dark preset, whose stops are the
 * branded rule's own (`oklch(21% 0.05 252)` / `oklch(9% 0.014 255)`) converted to hex. A starting
 * point for the dialog only: never written anywhere until the user changes something.
 */
export const VIEWPORT_BACKGROUND_SEED: ViewportBackground =
  VIEWPORT_BACKGROUND_PRESETS[0].background;

/** Vertical, like the Navisworks dialog this mirrors. The default's 135° angle is not exposed. */
export const viewportBackgroundCss = (background: ViewportBackground) =>
  background.style === "plain"
    ? background.topColor
    : `linear-gradient(180deg, ${background.topColor} 0%, ${background.bottomColor} 100%)`;

/**
 * Single writer of the property. `null` removes it, which is what hands the viewport back to the
 * branded default in `style.css`.
 *
 * Written on `documentElement` rather than the viewport element so it outlives any React remount —
 * the reason the values live in `uiStore` and not in component state.
 */
export const applyViewportBackground = (background: ViewportBackground | null) => {
  const root = document.documentElement;
  if (!background) {
    root.style.removeProperty(VIEWPORT_BACKGROUND_VAR);
    return;
  }
  root.style.setProperty(VIEWPORT_BACKGROUND_VAR, viewportBackgroundCss(background));
};
