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

/**
 * What the pickers open on when nothing has been chosen yet, converted from the branded rule's own
 * stops (`oklch(21% 0.05 252)` / `oklch(9% 0.014 255)`). A starting point for the dialog only —
 * these are never written anywhere until the user changes something.
 */
export const VIEWPORT_BACKGROUND_SEED: ViewportBackground = {
  style: "graduated",
  topColor: "#05192E",
  bottomColor: "#010205",
};

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
