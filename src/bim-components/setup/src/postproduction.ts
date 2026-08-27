import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

/**
 * The world's default render look, and the only definition of it.
 *
 * This is engine state, applied once at bootstrap, so every consumer of the shared world — the
 * Models / Queries / Room / Smart Views / Viewpoint / Drawing Editor / PostRender tabs, the 2D
 * views, the minimap — starts from the same picture. `PostRenderPanel` imports the same constants
 * to seed its "Restore preset" buttons, which is what keeps the panel and the boot state from
 * drifting apart.
 *
 * Two views opt out, each by swapping `style` for as long as they are mounted and restoring the
 * snapshot on the way out: `RealisticView` (daylight rig, `COLOR_SHADOWS`) and `useGisRenderMode`
 * (photogrammetry tiles, `COLOR`). The AR page never reaches here — it has no OBC world.
 */

export type Postproduction = OBF.PostproductionRenderer["postproduction"];
export type AoParameters = Postproduction["defaultAoParameters"];

/**
 * The poisson-denoise pass is **write-only**: `GTAOPass` exposes `updatePdMaterial` but no getter
 * for what it applied, so these seven values cannot be read back off the engine. They are the
 * vendor tutorial's constants, and `PostRenderPanel` mirrors them in React state — the one part of
 * the render look where the UI, not the renderer, is the source of truth.
 */
export interface PdParameters {
  lumaPhi: number;
  depthPhi: number;
  normalPhi: number;
  radius: number;
  radiusExponent: number;
  rings: number;
  samples: number;
}

export const PD_DEFAULTS: PdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

/**
 * The house look: model colours preserved, near-black edge lines on every element, and ambient
 * occlusion doing the soft shading in reveals and under slabs.
 *
 * Tuned for **building scale**, which a first pass got wrong. Edge detection works in screen
 * pixels, not world units, so a line that reads as a fine pencil edge on a 2 m facade close-up
 * becomes ink hatching on a 50 m whole-building view — every plank, pile and railing member gets
 * the same line. Hence a dark grey edge at the width floor rather than pure black.
 *
 * Two values are deliberately off the vendor's defaults:
 * - `distanceExponent: 1` against the vendor's `5.7`, which collapses AO to a hairline contact
 *   seam. Low exponent + `radius: 0.5` is what produces broad soft shading.
 * - `aoBlend: 1` — anything less is invisible against this scene's ambient light (see below).
 *
 * The selection fill stays at `0.30`: a translucent wash that tints the picked element without
 * hiding what it is made of. A near-solid fill (`0.85` was tried) reads as a flat green blob over
 * the geometry it is supposed to be highlighting.
 *
 * ⚠️ `edgeMode: DEFAULT` includes LOD geometry: more lines, and the slower of the two edge paths
 * on a heavy scene. `GLOBAL` is the cheap alternative and looks near-identical on close-ups — the
 * first thing to try if the viewport feels heavy on a many-model project.
 *
 * ⚠️ **AO cannot carry the whole look.** `create-world.ts` sets `ambientLight.intensity = 1.5`
 * against `directionalLight.intensity = 1.0`; ambient that high flattens form, so surfaces read
 * uniformly bright no matter what this pass does. Grey-side/white-front modelling is lighting,
 * and lighting is what `RealisticView` installs.
 *
 * `enabled` is **not** part of the preset: `setupHighlighter` already turns postproduction on (and
 * that setter is what runs `initialize()`), and the flag is co-owned by `ViewportRightToolbar`
 * during tool suppression — a second writer of that one global is the ADR-0017 hazard.
 */
export const POSTPRODUCTION_PRESET = {
  style: OBF.PostproductionAspect.COLOR_PEN_SHADOWS,
  outlines: true,
  smaa: true,
  glossEnabled: false,
  edgeWidth: 1,
  edgeColor: "#323232",
  edgeMode: OBF.EdgeDetectionPassMode.DEFAULT,
  ao: {
    screenSpaceRadius: true,
    radius: 0.5,
    distanceExponent: 1,
    thickness: 1.5,
    scale: 2,
    samples: 16,
    distanceFallOff: 1,
  } satisfies AoParameters,
  aoBlend: 1,
  selection: {
    color: "#bcf124",
    fillColor: "#bcf124",
    fillOpacity: 0.30,
    thickness: 3,
  },
};

/**
 * `OBF.AOPass extends GTAOPass` from `three/examples/jsm`, but this repo pins
 * `@types/three@0.156.0` — which predates `GTAOPass` entirely, and `three@0.182` ships no typings
 * for `examples/jsm` — so every inherited member is invisible to `tsc`. Declaring the three we
 * actually use keeps the call sites checked instead of widening the pass to `any`. Verified
 * against `node_modules/three/examples/jsm/postprocessing/GTAOPass.js`.
 */
export interface AoPassApi {
  blendIntensity: number;
  updateGtaoMaterial: (parameters: Partial<AoParameters>) => void;
  updatePdMaterial: (parameters: Partial<PdParameters>) => void;
}

export const aoPassOf = (postproduction: Postproduction) =>
  postproduction.aoPass as unknown as AoPassApi;

/**
 * The vendor's `get postproduction()` **throws** ("Renderer not initialized yet with a world!")
 * rather than returning undefined, and each pass getter throws its own error until `initialize()`
 * has run — which happens from exactly one place, the `enabled` setter's first `true`. So every
 * read and write goes through this, and a missing engine is treated as "not ready yet".
 */
export const getPostproduction = (world: OBC.World | null | undefined): Postproduction | null => {
  const renderer = world?.renderer as OBF.PostproductionRenderer | undefined;
  if (!renderer) return null;
  try {
    return renderer.postproduction;
  } catch {
    return null;
  }
};

/**
 * Writes the whole preset onto the live passes.
 *
 * Order is load-bearing: the AO parameters go in **before** the style, because the vendor's style
 * setter pushes `defaultAoParameters` into the material itself when the style leaves
 * `PEN_SHADOWS`. Applying GTAO/PD explicitly afterwards covers every other transition — the object
 * is otherwise aspirational (the shader ships `distanceExponent: 1` / `thickness: 1`).
 */
export const applyPostproductionPreset = (
  postproduction: Postproduction,
  outliner: OBF.Outliner,
) => {
  Object.assign(postproduction.defaultAoParameters, POSTPRODUCTION_PRESET.ao);

  postproduction.style = POSTPRODUCTION_PRESET.style;
  postproduction.outlinesEnabled = POSTPRODUCTION_PRESET.outlines;
  postproduction.smaaEnabled = POSTPRODUCTION_PRESET.smaa;
  postproduction.glossEnabled = POSTPRODUCTION_PRESET.glossEnabled;

  postproduction.edgesPass.width = POSTPRODUCTION_PRESET.edgeWidth;
  postproduction.edgesPass.color = new THREE.Color(POSTPRODUCTION_PRESET.edgeColor);
  postproduction.edgesPass.mode = POSTPRODUCTION_PRESET.edgeMode;

  aoPassOf(postproduction).blendIntensity = POSTPRODUCTION_PRESET.aoBlend;
  aoPassOf(postproduction).updateGtaoMaterial(postproduction.defaultAoParameters);
  aoPassOf(postproduction).updatePdMaterial(PD_DEFAULTS);

  outliner.color = new THREE.Color(POSTPRODUCTION_PRESET.selection.color);
  outliner.fillColor = new THREE.Color(POSTPRODUCTION_PRESET.selection.fillColor);
  outliner.fillOpacity = POSTPRODUCTION_PRESET.selection.fillOpacity;
  outliner.thickness = POSTPRODUCTION_PRESET.selection.thickness;
};

/**
 * Installs the default look on the world.
 *
 * **Must run after `setupHighlighter`**, and that ordering is not stylistic: the passes this
 * writes to do not exist until `initialize()` has run, and `initialize()` runs from the `enabled`
 * setter, which `setupHighlighter` is the first to call. `initialize()` also reads
 * `currentWorld.camera.three`, so this cannot move up into `create-world.ts` either — the camera
 * is assigned there *after* the renderer.
 */
export const setupPostproduction = (components: OBC.Components, world: OBC.World) => {
  const postproduction = getPostproduction(world);
  if (!postproduction) {
    console.warn("setupPostproduction: the renderer has no postproduction yet — preset skipped.");
    return;
  }
  try {
    applyPostproductionPreset(postproduction, components.get(OBF.Outliner));
  } catch (error) {
    console.warn("setupPostproduction: the render passes are not ready — preset skipped.", error);
  }
};
