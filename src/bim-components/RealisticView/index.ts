import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so vite-tsconfig-paths
// does not rewrite aliases inside this folder. Repo-wide convention here.
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { applySun, sunDirection, type SunAngles } from "./src/sun";

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
}

export const REALISTIC_DEFAULTS: RealisticSettings = {
  azimuth: -45,
  elevation: 55,
  intensity: 2.5,
  exposure: 1,
  shadows: true,
  turbidity: 10,
};

/**
 * A loaded fragments model, derived from `FragmentsManager.list` rather than imported.
 *
 * `@thatopen/fragments` is not a direct dependency of this file, and a hand-written structural
 * type does not work either: `tiles.onItemSet` is an `Event`, whose private `handlers` field makes
 * it nominal, so any look-alike is rejected.
 */
type FragmentsModel = NonNullable<ReturnType<OBC.FragmentsManager["list"]["get"]>>;

/** Everything this component overwrites, so `deactivate` can put it all back. */
interface Baseline {
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  shadowsEnabled: boolean;
  shadowAutoUpdate: boolean;
  ambientIntensity: number;
  directionalIntensity: number;
  style: OBF.PostproductionAspect | null;
}

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
  private _settings: RealisticSettings = { ...REALISTIC_DEFAULTS };

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
    return { ...this._settings };
  }

  /**
   * Installs the daylight rig on `world`, snapshotting what it replaces.
   *
   * Async because the sun's shadow frustum is fitted to the model, and `BoundingBoxer` reads that
   * from the fragments worker.
   */
  async activate(world: OBC.World) {
    if (this.active) return;

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
      style: postproduction ? postproduction.style : null,
    };

    await this._measureModels();
    this._buildRig(scene.three);
    this._applySettings();

    // The scene's own flat rig is what makes the viewer readable and what makes a render look
    // dead: ambient 1.5 leaves no dark side to anything. Drop both to near nothing and let the
    // hemisphere + sun do the work — the values come back on deactivate.
    sceneConfig.ambientLight.intensity = 0.15;
    sceneConfig.directionalLight.intensity = 0.1;

    // AO without pen edges. The vendor's own occlusion pass supplies contact shading, so this
    // component never needs an occlusion solution of its own.
    if (postproduction) postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

    this._bindFragments();
    this._requestShadowUpdate();
  }

  /** Puts everything back exactly as it was. Safe to call when not active. */
  deactivate() {
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
    if (postproduction && baseline.style !== null) postproduction.style = baseline.style;

    this._baseline = null;
    this._world = null;
  }

  /** Applies a partial settings change to the live rig. */
  update(next: Partial<RealisticSettings>) {
    this._settings = { ...this._settings, ...next };
    if (!this.active) return;
    this._applySettings();
    this._requestShadowUpdate();
  }

  /** Re-fits the sun to the models and refreshes the shadow. Call after a model loads. */
  async refit() {
    if (!this.active) return;
    await this._measureModels();
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
