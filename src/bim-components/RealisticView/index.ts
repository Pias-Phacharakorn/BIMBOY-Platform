import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so vite-tsconfig-paths
// does not rewrite aliases inside this folder. Repo-wide convention here.
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { applySun, sunDirection, type SunAngles } from "./src/sun";
// The module, not the `../setup` barrel: that barrel pulls in ClipperCursor, the measure cursors
// and the rest of bootstrap as *values*. `postproduction.ts` imports nothing but three/OBC/OBF, so
// reaching it directly keeps this component's dependency edge a leaf.
import {
  POSTPRODUCTION_PRESET,
  aoPassOf,
  type AoParameters,
  type Postproduction,
} from "../setup/src/postproduction";

/**
 * The gloss pass's six tunables.
 *
 * Derived from the key list rather than hand-written, because the same list drives the copy loop in
 * {@link applyPostproduction} — one place to edit if the vendor ever adds a seventh.
 */
const GLOSS_KEYS = [
  "minGloss",
  "maxGloss",
  "glossExponent",
  "fresnelExponent",
  "glossFactor",
  "fresnelFactor",
] as const;

export type GlossParameters = Record<(typeof GLOSS_KEYS)[number], number>;

export interface RealisticSettings extends SunAngles {
  /**
   * Sun brightness.
   *
   * ⚠️ Nothing like the three.js Sponza example's `100.0`. That scene is glTF PBR under physically
   * based light units; this one is `MeshLambertMaterial` under `SimpleScene`'s conventional units,
   * where `create-world.ts` runs its directional light at `1.0`. A hundred here is pure white.
   */
  intensity: number;
  /** `renderer.toneMappingExposure`. Honoured by the vendor's `OutputPass`. */
  exposure: number;
  shadows: boolean;
  /** `Sky`'s haze. Low is a hard blue sky; high is a milky one. */
  turbidity: number;

  /**
   * ⚠️ Costs a **full extra scene render every frame** — `GlossPass.render` does its own
   * `renderer.render(scene, camera)` with an override material. Unlike the shadow map, which
   * {@link RealisticView._applySettings} pins to `autoUpdate = false` so orbiting is free, there is
   * no on-demand escape. Hence off by default: nobody pays for a pass they did not ask for.
   */
  glossEnabled: boolean;
  gloss: GlossParameters;
  ao: AoParameters;
  /** `aoPass.blendIntensity`. Not part of `AoParameters` — the vendor keeps it on the pass. */
  aoBlend: number;
}

/** The sun/sky half — the only keys {@link RealisticView.update} accepts. */
export type DaylightSettings = Omit<
  RealisticSettings,
  "glossEnabled" | "gloss" | "ao" | "aoBlend"
>;

const DAYLIGHT_DEFAULTS = {
  azimuth: -45,
  elevation: 55,
  intensity: 2.5,
  exposure: 1,
  shadows: true,
  turbidity: 10,
} satisfies DaylightSettings;

/**
 * The daylight look's render half — the house look with two deliberate corrections.
 *
 * `POSTPRODUCTION_PRESET` is the starting point on purpose, so every difference below is one that
 * can be justified *before* rendering anything. Both come out of
 * [ADR-0025](../../../docs/adr/0025-house-look-is-the-boot-preset.md).
 *
 * - **`aoBlend` `1 → 0.5`.** The preset chose `1` because "anything less is invisible against this
 *   scene's ambient light", and `create-world.ts` runs ambient at `1.5`. {@link
 *   RealisticView.activate} drops it to `0.15` and adds real shadow maps, so blend `1` is AO
 *   doubling up on the sun.
 * - ⚠️ **`minGloss` `-0.12 → 0`** against the vendor default. `minGloss` is **not** a gloss floor —
 *   it is a *global darkening offset applied wherever gloss is absent*. The fragment shader clamps
 *   `gloss = max(gloss, 0.001)`, so a zero-gloss pixel resolves to `normalize(vec3(0.001)) *
 *   minGloss` ≈ `0.577 * minGloss` added to the scene colour. At `-0.12` that is a flat −0.069 per
 *   channel across every low-gloss surface **and the whole sky**, which contributes nothing to the
 *   gloss buffer at all (see {@link RealisticView._buildRig}).
 *
 * The remaining five gloss values are the vendor's shader defaults, read out of
 * `projected-normal-material.ts`. Every number here is a starting point for live tuning, not a
 * measured result.
 */
const RENDER_DEFAULTS = {
  glossEnabled: false,
  gloss: {
    minGloss: 0,
    maxGloss: 0.8,
    glossExponent: 10,
    fresnelExponent: 6,
    glossFactor: 0.2,
    fresnelFactor: 1,
  },
  ao: { ...POSTPRODUCTION_PRESET.ao },
  aoBlend: 0.5,
};

export const REALISTIC_DEFAULTS: RealisticSettings = {
  ...DAYLIGHT_DEFAULTS,
  ...RENDER_DEFAULTS,
};

/**
 * A loaded fragments model, derived from `FragmentsManager.list` rather than imported.
 *
 * `@thatopen/fragments` is not a direct dependency of this file, and a hand-written structural
 * type does not work either: `tiles.onItemSet` is an `Event`, whose private `handlers` field makes
 * it nominal, so any look-alike is rejected.
 */
type FragmentsModel = NonNullable<ReturnType<OBC.FragmentsManager["list"]["get"]>>;

/**
 * Every postproduction value this component owns while it is active.
 *
 * Used in both directions: `activate` snapshots one of these off the live passes and writes another
 * built from {@link RealisticSettings}; `deactivate` writes the snapshot back. Same shape, same
 * function, so there is no way for the restore to cover fewer fields than the write.
 */
interface PostproductionState {
  style: OBF.PostproductionAspect;
  glossEnabled: boolean;
  gloss: GlossParameters;
  ao: AoParameters;
  aoBlend: number;
}

/** Everything this component overwrites, so `deactivate` can put it all back. */
interface Baseline {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  shadowsEnabled: boolean;
  shadowAutoUpdate: boolean;
  ambientIntensity: number;
  directionalIntensity: number;
  /** `null` when the passes were not readable — see {@link readPostproduction}. */
  postproduction: PostproductionState | null;
}

/**
 * Snapshots the live passes, or `null` if they are not readable yet.
 *
 * Every pass getter (`glossPass`, `aoPass`, …) **throws** until `initialize()` has run — the same
 * hazard `getPostproduction` and `PostRenderPanel.readState` guard against. A `null` here is what
 * makes {@link RealisticView} refuse to write: with no snapshot there is no way back, and a
 * one-way write to a shared singleton is exactly what this component exists to avoid.
 */
const readPostproduction = (
  postproduction: Postproduction | null,
): PostproductionState | null => {
  if (!postproduction) return null;
  try {
    const { glossPass } = postproduction;
    const gloss = {} as GlossParameters;
    for (const key of GLOSS_KEYS) gloss[key] = glossPass[key];
    return {
      style: postproduction.style,
      glossEnabled: postproduction.glossEnabled,
      gloss,
      // ⚠️ A copy, not a reference. `defaultAoParameters` is mutated **in place** by both this
      // component and `PostRenderPanel`, so a stored reference would drift with the very edits it
      // was taken to undo — and "restore" to whatever the user last set.
      ao: { ...postproduction.defaultAoParameters },
      aoBlend: aoPassOf(postproduction).blendIntensity,
    };
  } catch {
    return null;
  }
};

/**
 * Writes a whole {@link PostproductionState} onto the live passes.
 *
 * ⚠️ **The order is load-bearing, and not obvious from the vendor's API.** `set glossEnabled` ends
 * with `this.style = this._style` — it re-runs the *style* setter — and the style setter pushes
 * `defaultAoParameters` into the AO material whenever the style leaves `PEN_SHADOWS`. So the AO
 * block has to be in `defaultAoParameters` **before** gloss or style is touched, or toggling gloss
 * publishes the values being replaced.
 *
 * `blendIntensity` and the explicit `updateGtaoMaterial` are **not** redundant with that re-push:
 * the pass keeps `blendIntensity` outside `defaultAoParameters`, and the setter's re-push only
 * fires when leaving `PEN_SHADOWS` — which this component never does, since it sits at
 * `COLOR_SHADOWS`. Same rule `applyPostproductionPreset` follows.
 */
const applyPostproduction = (postproduction: Postproduction, state: PostproductionState) => {
  Object.assign(postproduction.defaultAoParameters, state.ao);
  for (const key of GLOSS_KEYS) postproduction.glossPass[key] = state.gloss[key];

  postproduction.glossEnabled = state.glossEnabled;
  postproduction.style = state.style;

  const aoPass = aoPassOf(postproduction);
  aoPass.blendIntensity = state.aoBlend;
  aoPass.updateGtaoMaterial(postproduction.defaultAoParameters);
};

/** Deep enough to cut the two nested blocks loose — nothing below them is an object. */
const cloneSettings = (settings: RealisticSettings): RealisticSettings => ({
  ...settings,
  gloss: { ...settings.gloss },
  ao: { ...settings.ao },
});

/**
 * Daylight rendering for the viewport: sky, a shadow-casting sun, and filmic tone mapping.
 *
 * **Active only while the Realistic tab is mounted.** It is the sole owner of the renderer and
 * scene state it touches, it snapshots that state on {@link activate} and restores it exactly on
 * {@link deactivate}. That is a performance requirement rather than tidiness: a shadow pass left
 * enabled globally would cost every other tab a second full render of a scene that is already
 * CPU-bound on draw-call submission.
 *
 * **What it deliberately is not.** The three.js `webgl_lightprobes_sponza` example this comes from
 * bakes a `LightProbeGrid` for local bounce light. That class does not exist in the pinned
 * `three@0.182` (`examples/jsm/lighting/` holds only `TiledLighting.js`), and the bake would be
 * unaffordable anyway — 490 probes × 6 cube faces × bounces, each a full scene render. So this is
 * direct light only: no GI, and **no image-based lighting either**, because `WebGLRenderer` hands
 * `scene.environment` only to `MeshStandardMaterial` and fragments builds `MeshLambertMaterial`.
 * Lambert honours ambient/hemisphere/directional lights, shadow maps and tone mapping — which is
 * exactly the set used here.
 */
export class RealisticView extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "3c9a71f4-5d28-4e63-b8a1-7f0e2d6c9b45" as const;

  enabled = true;

  readonly onDisposed = new OBC.Event<string>();

  private _world: OBC.World | null = null;
  private _baseline: Baseline | null = null;
  /**
   * Bumped by every `activate` and every `deactivate`, so an async activate can tell whether it
   * still owns the component after it resumes. Without it, a `deactivate` landing during the
   * bounds measurement tears down a rig that does not exist yet and clears `_baseline`; the
   * pending activate then installs a rig nobody owns, and every later `deactivate` early-returns
   * on the null baseline and leaves it in the scene. React StrictMode's mount/cleanup/mount makes
   * that the *normal* path in dev, not a rare race.
   */
  private _generation = 0;
  private _settings: RealisticSettings = cloneSettings(REALISTIC_DEFAULTS);

  private _sky: Sky | null = null;
  private _hemisphere: THREE.HemisphereLight | null = null;
  private _sun: THREE.DirectionalLight | null = null;
  private _bounds = new THREE.Box3();

  /** Per-model tile unsubscribes, so listeners cannot outlive the tab. `Outliner`'s pattern. */
  private _tileListeners = new Map<string, () => void>();
  private _onModelSet: ((event: { value: unknown }) => void) | null = null;

  constructor(components: OBC.Components) {
    super(components);
    components.add(RealisticView.uuid, this);
  }

  get active() {
    return this._baseline !== null;
  }

  get settings(): RealisticSettings {
    return cloneSettings(this._settings);
  }

  /**
   * Installs the daylight rig on `world`, snapshotting what it replaces.
   *
   * Async because the sun's shadow frustum is fitted to the model, and `BoundingBoxer` reads that
   * from the fragments worker.
   */
  async activate(world: OBC.World) {
    if (this.active) return;

    const generation = ++this._generation;
    const renderer = world.renderer;
    const scene = world.scene;
    if (!renderer || !scene) return;

    const three = renderer.three;
    const sceneConfig = (scene as OBC.SimpleScene).config;
    const postproduction = this._postproduction(world);

    this._world = world;
    this._baseline = {
      toneMapping: three.toneMapping,
      toneMappingExposure: three.toneMappingExposure,
      shadowsEnabled: three.shadowMap.enabled,
      shadowAutoUpdate: three.shadowMap.autoUpdate,
      ambientIntensity: sceneConfig.ambientLight.intensity,
      directionalIntensity: sceneConfig.directionalLight.intensity,
      postproduction: readPostproduction(postproduction),
    };

    await this._measureModels();
    // Someone else took over while the bounds were being measured (a deactivate, or a second
    // activate after one). Return before touching the scene: this call's baseline has already been
    // consumed, so anything built here would outlive every teardown.
    if (this._generation !== generation) return;

    this._buildRig(scene.three);
    this._applySettings();

    // The scene's own flat rig is what makes the viewer readable and what makes a render look
    // dead: ambient 1.5 leaves no dark side to anything. Drop both to near nothing and let the
    // hemisphere + sun do the work — the values come back on deactivate.
    sceneConfig.ambientLight.intensity = 0.15;
    sceneConfig.directionalLight.intensity = 0.1;

    // AO without pen edges, plus this tab's own gloss and AO. The vendor's occlusion pass supplies
    // contact shading, so this component never needs an occlusion solution of its own — it only
    // needs the pass tuned for daylight rather than for the flat house look.
    this._applyPostproduction();

    this._bindFragments();
    this._requestShadowUpdate();
  }

  /** Puts everything back exactly as it was. Safe to call when not active. */
  deactivate() {
    // Before the early return below, so a still-pending activate is cancelled even when there is
    // nothing yet to tear down.
    this._generation++;

    const baseline = this._baseline;
    const world = this._world;
    if (!baseline || !world) return;

    const three = world.renderer?.three;
    const scene = world.scene;

    this._unbindFragments();
    this._setTileShadows(false);
    this._teardownRig(scene?.three ?? null, world);

    if (three) {
      three.toneMapping = baseline.toneMapping;
      three.toneMappingExposure = baseline.toneMappingExposure;
      three.shadowMap.enabled = baseline.shadowsEnabled;
      three.shadowMap.autoUpdate = baseline.shadowAutoUpdate;
      // The map is stale the moment shadows go off; clear it so re-entry cannot show the old sun.
      three.shadowMap.needsUpdate = true;
    }

    if (scene) {
      const sceneConfig = (scene as OBC.SimpleScene).config;
      sceneConfig.ambientLight.intensity = baseline.ambientIntensity;
      sceneConfig.directionalLight.intensity = baseline.directionalIntensity;
    }

    const postproduction = this._postproduction(world);
    if (postproduction && baseline.postproduction) {
      try {
        // Style, gloss and AO all go back in one call, in the same order they were written — see
        // `applyPostproduction` for why that order is not interchangeable.
        applyPostproduction(postproduction, baseline.postproduction);
      } catch (error) {
        console.warn("RealisticView: could not restore the render settings.", error);
      }
    }

    this._baseline = null;
    this._world = null;
  }

  /**
   * Applies a partial sun/sky change to the live rig.
   *
   * ⚠️ Typed to {@link DaylightSettings}, not `RealisticSettings`, and that narrowing is the point:
   * the spread below is **shallow**, so `update({ ao: { radius: 0.3 } })` would type-check while
   * silently wiping every sibling AO field at runtime. The type makes that call impossible —
   * {@link updateAo} and {@link updateGloss} are the way in for the nested blocks.
   */
  update(next: Partial<DaylightSettings>) {
    this._settings = { ...this._settings, ...next };
    if (!this.active) return;
    this._applySettings();
    this._requestShadowUpdate();
  }

  /**
   * Applies a partial AO change to the live pass. `blend` is `aoPass.blendIntensity`, which the
   * vendor keeps off `AoParameters`.
   */
  updateAo(next: Partial<AoParameters & { blend: number }>) {
    const { blend, ...params } = next;
    this._settings = {
      ...this._settings,
      ao: { ...this._settings.ao, ...params },
      aoBlend: blend ?? this._settings.aoBlend,
    };
    this._applyPostproduction();
  }

  /** Applies a partial gloss change to the live pass. `enabled` is `postproduction.glossEnabled`. */
  updateGloss(next: Partial<GlossParameters & { enabled: boolean }>) {
    const { enabled, ...params } = next;
    this._settings = {
      ...this._settings,
      gloss: { ...this._settings.gloss, ...params },
      glossEnabled: enabled ?? this._settings.glossEnabled,
    };
    this._applyPostproduction();
  }

  /** Restores the sun and sky, leaving gloss and AO exactly as tuned. */
  resetDaylight() {
    this.update({ ...DAYLIGHT_DEFAULTS });
  }

  /** Restores gloss and AO, leaving the sun exactly where it is. */
  resetRender() {
    this._settings = {
      ...this._settings,
      glossEnabled: RENDER_DEFAULTS.glossEnabled,
      gloss: { ...RENDER_DEFAULTS.gloss },
      ao: { ...RENDER_DEFAULTS.ao },
      aoBlend: RENDER_DEFAULTS.aoBlend,
    };
    this._applyPostproduction();
  }

  /** Re-fits the sun to the models and refreshes the shadow. Call after a model loads. */
  async refit() {
    if (!this.active) return;
    const generation = this._generation;
    await this._measureModels();
    // Same hazard as `activate`: the rig can be torn down while the bounds are measured.
    if (this._generation !== generation) return;
    this._applySettings();
    this._setTileShadows(this._settings.shadows);
    this._requestShadowUpdate();
  }

  dispose() {
    this.deactivate();
    this.onDisposed.trigger(RealisticView.uuid);
    this.onDisposed.reset();
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /** The getter throws until the renderer has a world, so never read it bare. */
  private _postproduction(world: OBC.World) {
    const renderer = world.renderer as OBF.PostproductionRenderer | null;
    if (!renderer) return null;
    try {
      return renderer.postproduction;
    } catch {
      return null;
    }
  }

  /**
   * Pushes this tab's gloss and AO onto the shared passes.
   *
   * Deliberately **not** folded into `_applySettings`: that runs on every azimuth drag, and this
   * writes fourteen pass values plus a GTAO material rebuild. Sun changes go through one, render
   * changes through the other, and `activate` calls both once.
   *
   * Refuses to write when the baseline holds no postproduction snapshot. That is the whole
   * ownership contract in one line — a write we cannot undo would leave the house look permanently
   * carrying the daylight tuning, which is the bug this component exists to prevent.
   */
  private _applyPostproduction() {
    const world = this._world;
    if (!world || !this._baseline?.postproduction) return;

    const postproduction = this._postproduction(world);
    if (!postproduction) return;

    const settings = this._settings;
    try {
      applyPostproduction(postproduction, {
        style: OBF.PostproductionAspect.COLOR_SHADOWS,
        glossEnabled: settings.glossEnabled,
        gloss: { ...settings.gloss },
        ao: { ...settings.ao },
        aoBlend: settings.aoBlend,
      });
    } catch (error) {
      console.warn("RealisticView: could not apply the render settings.", error);
    }
  }

  private async _measureModels() {
    const boxer = this.components.get(OBC.BoundingBoxer);
    boxer.list.clear();
    await boxer.addFromModels();
    const box = boxer.get();
    boxer.list.clear();
    // An empty scene yields an inverted-infinite box; a 10 m cube keeps the rig sane until a
    // model arrives, and `refit()` replaces it then.
    this._bounds = box.isEmpty()
      ? new THREE.Box3(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 10, 5))
      : box;
  }

  private _buildRig(scene: THREE.Object3D) {
    const sky = new Sky();
    // Big enough to sit outside anything the camera will be inside of.
    sky.scale.setScalar(450000);
    // Same reason the grid does it in `create-world.ts`: this is backdrop, not geometry, and
    // every picking path in the app (CursorSurface, the clip-aware raycaster, measure snapping)
    // would otherwise be able to hit a 450 km box.
    sky.raycast = () => null;
    scene.add(sky);
    this._sky = sky;

    // Sky colour above, bounced ground colour below — the cheap stand-in for the sky-lit ambient
    // the probe grid would have produced, and one of the few things Lambert actually honours.
    const hemisphere = new THREE.HemisphereLight(0xbcd9ff, 0x8a7f6d, 1.0);
    scene.add(hemisphere);
    this._hemisphere = hemisphere;

    const sun = new THREE.DirectionalLight(0xfff2dc, this._settings.intensity);
    sun.shadow.mapSize.setScalar(2048);
    // `target` only affects the light once it is in the scene graph and its matrix is current.
    scene.add(sun.target);
    scene.add(sun);
    this._sun = sun;

    const postproduction = this._world ? this._postproduction(this._world) : null;
    if (postproduction) {
      // Isolated materials render in the base pass and are hidden from every later pass — read
      // off `BasePass.render`, which restores `visible` before the draw and clears it after. So
      // the sky reaches the beauty image without collecting edge outlines or occlusion.
      //
      // ⚠️ This does **not** cover the gloss pass, and nothing can: `isolatedMaterials` is a
      // `BasePass` concept that `GlossPass` never consults. It renders the whole scene with
      // `scene.overrideMaterial`, and `getProjectedNormalMaterial()` declares no `side`, so it
      // defaults to `FrontSide` — while `Sky` is `BackSide` with the camera inside a 450 km
      // sphere. The sky's faces are therefore culled and it contributes *nothing* to the gloss
      // buffer, which is what makes `minGloss` visible on it as a flat darkening. See
      // `RENDER_DEFAULTS`.
      postproduction.basePass.isolatedMaterials.push(sky.material);
    }
  }

  private _teardownRig(scene: THREE.Object3D | null, world: OBC.World) {
    const postproduction = this._postproduction(world);

    if (this._sky) {
      if (postproduction) {
        const { isolatedMaterials } = postproduction.basePass;
        const index = isolatedMaterials.indexOf(this._sky.material);
        if (index !== -1) isolatedMaterials.splice(index, 1);
      }
      // The base pass leaves isolated materials at `visible = false`; hand it back usable in case
      // anything else ever holds a reference to it.
      this._sky.material.visible = true;
      scene?.remove(this._sky);
      this._sky.geometry.dispose();
      this._sky.material.dispose();
      this._sky = null;
    }

    if (this._hemisphere) {
      scene?.remove(this._hemisphere);
      this._hemisphere.dispose();
      this._hemisphere = null;
    }

    if (this._sun) {
      scene?.remove(this._sun.target);
      scene?.remove(this._sun);
      // Frees the shadow map render target — not freed by removing the light.
      this._sun.shadow.dispose();
      this._sun.dispose();
      this._sun = null;
    }
  }

  private _applySettings() {
    const world = this._world;
    const three = world?.renderer?.three;
    if (!three || !this._sun || !this._sky) return;

    const settings = this._settings;

    three.toneMapping = THREE.ACESFilmicToneMapping;
    three.toneMappingExposure = settings.exposure;
    three.shadowMap.enabled = settings.shadows;
    // The one line that makes shadows affordable here. A shadow map is rendered in *light* space,
    // so orbiting, panning and zooming cannot invalidate it — only a moved sun or changed geometry
    // can. The example re-renders it every frame for nothing; we re-render it on demand.
    three.shadowMap.autoUpdate = false;

    this._sun.intensity = settings.intensity;
    this._sun.castShadow = settings.shadows;
    applySun(this._sun, this._bounds, settings);

    const uniforms = this._sky.material.uniforms;
    uniforms.turbidity.value = settings.turbidity;
    uniforms.rayleigh.value = 2;
    uniforms.mieCoefficient.value = 0.005;
    uniforms.mieDirectionalG.value = 0.8;
    // ⚠️ A *direction* measured from the zenith, not the light's position — see `sunDirection`.
    uniforms.sunPosition.value.copy(sunDirection(settings));
  }

  private _requestShadowUpdate() {
    const three = this._world?.renderer?.three;
    if (three && three.shadowMap.enabled) three.shadowMap.needsUpdate = true;
  }

  /**
   * Shadow flags are per mesh and default to `false`, and fragments creates and destroys tile
   * meshes continuously as LOD streaming runs — so this cannot be done once. Existing tiles are
   * flagged now, and `tiles.onItemSet` catches every one that appears later.
   */
  private _setTileShadows(on: boolean) {
    const fragments = this.components.get(OBC.FragmentsManager);
    for (const [, model] of fragments.list) {
      for (const [, mesh] of model.tiles) {
        mesh.castShadow = on;
        mesh.receiveShadow = on;
      }
    }
  }

  private _bindFragments() {
    const fragments = this.components.get(OBC.FragmentsManager);

    this._setTileShadows(this._settings.shadows);
    for (const [, model] of fragments.list) this._bindModel(model);

    // A model loaded while the tab is open needs its tiles flagged and the sun refitted.
    this._onModelSet = () => void this.refit();
    fragments.list.onItemSet.add(this._onModelSet);
  }

  private _bindModel(model: FragmentsModel) {
    if (this._tileListeners.has(model.modelId)) return;

    const onTile = ({ value: mesh }: { value: THREE.Object3D }) => {
      const on = this._settings.shadows;
      mesh.castShadow = on;
      mesh.receiveShadow = on;
      this._requestShadowUpdate();
    };

    model.tiles.onItemSet.add(onTile);
    this._tileListeners.set(model.modelId, () => model.tiles.onItemSet.remove(onTile));
  }

  private _unbindFragments() {
    for (const [, unsubscribe] of this._tileListeners) unsubscribe();
    this._tileListeners.clear();

    if (this._onModelSet) {
      this.components.get(OBC.FragmentsManager).list.onItemSet.remove(this._onModelSet);
      this._onModelSet = null;
    }
  }
}
