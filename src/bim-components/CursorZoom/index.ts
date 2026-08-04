import * as OBC from "@thatopen/components";
import * as THREE from "three";
// Runtime import, not `import type`: the ACTION enum is needed to tell a rotate drag from a pan.
import CameraControls from "camera-controls";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so vite-tsconfig-paths
// does not rewrite aliases inside this folder. Repo-wide convention here.
import { CursorSurface } from "../CursorSurface";
import { PivotMarker } from "./src/PivotMarker";

/**
 * Smallest gap ever left between the camera and the surface it stopped at, in metres. The real
 * standoff is `max(this, camera.near × NEAR_STANDOFF_FACTOR)` — see {@link CursorZoom._standoff}.
 */
const MIN_STANDOFF = 0.25;

/**
 * The standoff must clear the near plane, or the camera parks *inside* it and the surface it
 * stopped at is clipped away — you end up looking through the wall you were inspecting.
 */
const NEAR_STANDOFF_FACTOR = 2.5;

/** How long a computed clamp is reused before the next wheel event re-raycasts. */
const CLAMP_CACHE_MS = 150;

/**
 * How long after the last wheel event the damped dolly is assumed to still be running.
 * `smoothTime = 0.2` (set by `SimpleCamera.newCameraControls`) plus a frame of slack.
 */
const DOLLY_SETTLE_MS = 300;

/** Never let `minDistance` reach `maxDistance` — `clamp(v, min, max)` returns `min` when they cross. */
const MAX_DISTANCE_MARGIN = 0.99;

/**
 * Relative depth change below which a re-anchor is skipped as a no-op.
 *
 * ⚠️ **Load-bearing, not an optimisation.** `setTarget` sets `_needsUpdate`, so `update()` emits
 * another `rest`, which calls straight back into {@link CursorZoom._onRest}. Without a no-op bail
 * that is an endless `rest` → `setTarget` → `rest` loop, raycasting every frame.
 */
const REANCHOR_EPSILON = 0.01;

/**
 * Every action that spins the camera around its target, mouse and touch alike. `currentAction`
 * returns the raw `_state` bitfield, and the vendor tests it bitwise (`(_state & X) === X`) because
 * the touch gestures are compound — `TOUCH_DOLLY_ROTATE` is a rotate too.
 */
const ROTATE_ACTIONS =
  CameraControls.ACTION.ROTATE |
  CameraControls.ACTION.TOUCH_ROTATE |
  CameraControls.ACTION.TOUCH_DOLLY_ROTATE |
  CameraControls.ACTION.TOUCH_ZOOM_ROTATE;

/**
 * Navisworks-like navigation: the surface under the cursor bounds the camera.
 *
 * Zoom already aims at the cursor — `SimpleCamera.newCameraControls()` ships
 * `dollyToCursor = true`. What it also ships is `infinityDolly = true`, and that is what makes
 * the camera fly straight through whatever you aimed at, forever:
 *
 * ```js
 * const clampedDistance = clamp(distance, this.minDistance, this.maxDistance);
 * if (this.infinityDolly && this.dollyToCursor) this._dollyToNoClamp(distance, true);        // clamp BYPASSED
 * else                                          this._dollyToNoClamp(clampedDistance, true); // clamp honoured
 * ```
 *
 * So `minDistance` is **dead config** out of the box: the vendor deliberately keeps the distance
 * and pushes the *target* forward instead. Turning `infinityDolly` off is what brings the clamp
 * to life; everything else here is deciding what to clamp it *to*.
 *
 * **Two mechanisms, on two different events, because they cannot share one.**
 *
 * - The **clamp** raises `minDistance` from the wheel, trigonometrically, because the pivot it sees
 *   is usually stale. It never touches the target, so it is safe mid-dolly.
 * - The **pivot** is re-anchored onto the hovered surface's depth along the view axis
 *   (`controls.setTarget`) on `pointerdown` and on camera-controls' **`rest`** — the only moments
 *   nothing is animating. `_onRest` carries the full reason; the short version is that `setTarget`
 *   teleports `radius` behind `update()`'s `_lastDistance` bookkeeping, and doing that with a notch
 *   still pending sends `dollyToCursor`'s `lerpRatio` to ~9 and lurches the camera.
 *
 * ⚠️ **Do not merge them, and do not re-anchor from the wheel.** Three variants were built and each
 * produced its own artefact: a wheel re-anchor lurches the camera; replacing the trigonometry with a
 * constant `minDistance` reinstates the fly-through; and re-anchoring on the frozen branch — whether
 * via the view axis or `setOrbitPoint` — sends the zoom somewhere the user was not pointing. What
 * remains has one known rough edge instead, documented on `_onRest`: an already-frozen zoom waits for
 * unrelated motion before it recovers. → ADR-0006.
 *
 * **Zoom step scaling needs no code.** `_dollyInternal` is multiplicative
 * (`radius × 0.95^-delta`), so the stride is already proportional to the distance to the target;
 * the `rest` re-anchor is what keeps that distance meaningful between gestures.
 *
 * ⚠️ **The freeze this design replaced — recorded so it is never reintroduced.** The clamp used to
 * be `max(standoff, distance − travel)`. When the hovered surface was farther from the camera than
 * the target was, `travel > distance`, the bracket went negative, and the `max` floored it at
 * `standoff` — so instead of stopping, the dolly walked `radius` all the way down to 0.25 m. Once
 * `minDistance >= radius`, three motion paths switch off at once: `clampedDistance === lastDistance`
 * (no radius change), `_changedDolly += 0` (and `update()` gates the entire cursor-directed target
 * shift on `_changedDolly !== 0`), and the vendor's `isMin` escape — the one thing that pushes the
 * *target* forward once the radius bottoms out — is gated on `infinityDolly`, which we turn off.
 * Zoom died permanently, in every direction, until a click or Focus reset the radius. The root cause
 * is that **`minDistance` cannot express a stop lying beyond the target**, so the floor silently
 * collapsed the radius instead. The `rest` re-anchor is what breaks the deadlock: the radius is
 * restored to the hovered depth the moment the camera settles — after a rotate as much as a zoom —
 * so the next burst always has room to move. The floor itself stays, and is harmless now. → ADR-0006.
 *
 * ⚠️ **Known limitation, by design:** you can no longer wheel *into* a sealed volume — inside a
 * closed duct, or a room seen from outside. The escape hatches are FirstPerson mode (exempt, a
 * walkthrough must pass through walls) and a section plane.
 */
export class CursorZoom extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "fc7dd3ac-4d59-432a-9922-eabfa18dec89" as const;

  readonly onDisposed = new OBC.Event<string>();

  private _enabled = true;
  private _world: OBC.World | null = null;
  private _canvas: HTMLCanvasElement | null = null;

  /**
   * The controls instance currently being tuned, with the vendor values it had on arrival.
   *
   * Held per instance because it is **not** stable: `OBC.Views.open()` assigns a whole new
   * `OrthoPerspectiveCamera` to `world.camera`, and each one builds its own `CameraControls`.
   */
  private _controls: CameraControls | null = null;
  private _baseline: { minDistance: number; infinityDolly: boolean } | null = null;

  /** One raycast in flight at a time, shared by both gestures. */
  private _raycastInProgress = false;
  private _lastClampAt = Number.NEGATIVE_INFINITY;
  private _lastWheelAt = Number.NEGATIVE_INFINITY;

  /** The green dot telling the user what the camera is anchored to. Owned and freed here. */
  private readonly _marker = new PivotMarker();

  constructor(components: OBC.Components) {
    super(components);
    components.add(CursorZoom.uuid, this);
  }

  get world() {
    return this._world;
  }

  /** Set after construction, as `GizmoAxis` and the measure cursors do. */
  set world(value: OBC.World | null) {
    if (this._world === value) return;
    this._detach();
    this._world = value;
    this._attach();
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    if (this._enabled === value) return;
    this._enabled = value;
    if (value) this._attach();
    else this._detach();
  }

  // ─── Binding ───────────────────────────────────────────────────────────────

  private _attach() {
    const world = this._world;
    if (!world || !this._enabled) return;

    this._canvas = world.renderer?.three.domElement ?? null;
    this._canvas?.addEventListener("pointerdown", this._onPointerDown);
    // Passive: this never calls preventDefault, it only reads that a wheel happened.
    this._canvas?.addEventListener("wheel", this._onWheel, { passive: true });
    world.onCameraChanged.add(this._bindControls);

    // The marker rides in the main scene, drawn by the renderer's existing CSS2D pass. It survives
    // camera swaps untouched — only the controls it reports on get rebound.
    this._marker.attach(world.scene.three);

    this._bindControls();
  }

  private _detach() {
    this._canvas?.removeEventListener("pointerdown", this._onPointerDown);
    this._canvas?.removeEventListener("wheel", this._onWheel);
    this._canvas = null;

    // `Components.dispose()` frees the camera/world before custom components, so anything
    // reaching into them at teardown has to tolerate their absence.
    try {
      this._world?.onCameraChanged.remove(this._bindControls);
    } catch {
      // World already disposed — its events are gone with it.
    }

    try {
      this._marker.detach();
    } catch {
      // Scene already disposed; the element removal below its own try is harmless either way.
    }

    this._releaseControls();
  }

  /**
   * Adopts the world's current controls, snapshotting the vendor's values first.
   *
   * Doubles as the `world.onCameraChanged` handler: a `Views2DList` plan open/close swaps
   * `world.camera`, so the controls we tuned are simply gone and a fresh, untuned instance is
   * live. Comparing instances makes re-entry free.
   */
  private _bindControls = () => {
    const controls = this._activeControls();
    if (controls === this._controls) return;

    this._releaseControls();
    if (!controls) return;

    this._controls = controls;
    this._baseline = {
      minDistance: controls.minDistance,
      infinityDolly: controls.infinityDolly,
    };

    // The one line that makes `minDistance` mean anything at all — see the class doc.
    controls.infinityDolly = false;

    // ⚠️ `controlstart`/`controlend` are **not** emitted for the wheel (vendor: scroll events are
    // intermittent, so a start and end cannot be detected), which is why the zoom half of the
    // marker is driven from `_onWheel` and its own idle timer instead. Both are bound here because
    // `control` alone can miss the opening frame of a drag.
    controls.addEventListener("controlstart", this._onRotate);
    controls.addEventListener("control", this._onRotate);

    // The only safe moment to re-anchor the pivot — see `_onRest`.
    controls.addEventListener("rest", this._onRest);
  };

  private _releaseControls() {
    const controls = this._controls;
    const baseline = this._baseline;
    this._controls = null;
    this._baseline = null;
    if (!controls || !baseline) return;

    try {
      controls.removeEventListener("controlstart", this._onRotate);
      controls.removeEventListener("control", this._onRotate);
      controls.removeEventListener("rest", this._onRest);
      controls.infinityDolly = baseline.infinityDolly;
      // ⚠️ Never restore a `minDistance` larger than where the camera already is: `update()`
      // clamps distance into `[minDistance, maxDistance]` every frame, so a bigger value would
      // shove the camera backwards. The snapshot is often the vendor's construction-time `6`,
      // taken before `OrbitMode.activateOrbitControls()` lowered it to `1`.
      controls.minDistance = Math.min(baseline.minDistance, controls.distance);
    } catch {
      // Controls already disposed with their camera; nothing left to restore.
    }
  }

  /** `world.camera` is a getter that **throws** once the camera is disposed. */
  private _activeControls(): CameraControls | null {
    try {
      const camera = this._world?.camera;
      if (!camera?.hasCameraControls()) return null;
      return camera.controls;
    } catch {
      return null;
    }
  }

  /**
   * Whether the current camera wants this behaviour, read per gesture because
   * `OrthoPerspectiveCamera.set(mode)` fires **no event** — `mode` is a cheap getter, so polling
   * it beats maintaining a subscription that does not exist.
   *
   * `FirstPerson` is exempt by design and `Plan` (the 2D views) has no orbit. In `Orthographic`
   * the wheel maps to `_zoomInternal`, which never reads `minDistance`, and `setOrthoCamera()`
   * pins `distance = 200` — so ortho gets the pivot and nothing else. A vendor limit, not a choice.
   */
  private _navigation(): { orbit: boolean; perspective: boolean } | null {
    try {
      const camera = this._world?.camera as OBC.OrthoPerspectiveCamera | undefined;
      if (!camera?.projection) return null;
      return {
        orbit: camera.mode?.id === "Orbit",
        perspective: camera.projection.current === "Perspective",
      };
    } catch {
      // `mode` throws when no navigation mode is initialised.
      return null;
    }
  }

  /** Standoff, derived from the live near plane so the two can never drift apart. */
  private _standoff(): number {
    let near = 0;
    try {
      const three = this._world?.camera.three as THREE.PerspectiveCamera | undefined;
      near = three?.near ?? 0;
    } catch {
      near = 0;
    }
    return Math.max(MIN_STANDOFF, near * NEAR_STANDOFF_FACTOR);
  }

  // ─── Gestures ──────────────────────────────────────────────────────────────

  /**
   * Re-anchors the pivot onto whatever was just clicked, so a later orbit spins around it and a
   * later wheel dollies toward it. Has no visual effect: {@link CursorZoom._reanchorPivot} keeps
   * the target on the current view axis, so the camera neither moves nor turns.
   *
   * ⚠️ It used to call `setOrbitPoint`, which caused the right-click-pan bounce: that method ends
   * with `dollyTo(distance, false)`, clamped against `minDistance` while the focal offset is
   * computed from the *unclamped* distance. It also sets a focal offset that only `fitToSphere`
   * ever clears — never `setLookAt` — so `view-cube.ts`, `ClashList.tsx` and
   * `MiniMapCameraManager` inherited a lateral shift. → ADR-0006.
   */
  private _onPointerDown = () => {
    const controls = this._controls;
    const navigation = this._navigation();
    if (!controls?.enabled || !navigation?.orbit) return;

    // The vendor's "not during animations" caveat. A damped dolly is the one case that really
    // applies, so a pointerdown landing inside a wheel burst is skipped rather than deferred:
    // by the time it settled the hit would be stale anyway, and the next click re-pivots.
    if (performance.now() - this._lastWheelAt < DOLLY_SETTLE_MS) return;

    void this._pivotOnHoveredSurface(controls);
  };

  private async _pivotOnHoveredSurface(controls: CameraControls) {
    const point = await this._castRay();
    // Guard the await: a camera swap may have replaced these controls meanwhile.
    if (!point || this._controls !== controls) return;
    this._reanchorPivot(controls, point, this._standoff());
  }

  /**
   * Marks the orbit pivot while the camera is being spun.
   *
   * Bound to both `controlstart` and `control`, and gated on the action rather than the event, so a
   * pan or a wheel-driven `control` never shows a dot. The target does not move during a rotate, so
   * re-reading it per event is free and keeps the fade-out timer alive for the whole drag — which is
   * also what makes `controlend` unnecessary: the hold countdown starts from the last `control`.
   */
  private _onRotate = () => {
    const controls = this._controls;
    if (!controls || (controls.currentAction & ROTATE_ACTIONS) === 0) return;
    // Plan mode reports ACTION.ROTATE for a left-drag even though its rotation speed is zeroed, so
    // without this the dot would mark a pivot that nothing spins around. `_onWheel` needs no such
    // gate: it only ever *extends* an already-visible dot, and the anchor stays meaningful.
    if (!this._navigation()?.orbit) return;

    if (this._markerSuppressed()) {
      this._marker.hide();
      return;
    }

    this._marker.showAt(controls.getTarget(new THREE.Vector3()));
  };

  /**
   * Whether a tool currently owns the cursor, in which case the dot would fight that tool's own
   * indicator for the same pixels. One check, because every such tool drives the shared
   * `CursorSurface` guide — see its `visible` getter.
   */
  private _markerSuppressed() {
    try {
      return this.components.get(CursorSurface).visible;
    } catch {
      // CursorSurface not registered (or already disposed): nothing owns the cursor.
      return false;
    }
  }

  private _onWheel = () => {
    this._lastWheelAt = performance.now();
    // Keeps an already-visible dot alive through the rest of a burst; the first tick's raycast is
    // what actually shows it, since only that knows where the hovered surface is.
    this._marker.keepAlive();

    const controls = this._controls;
    const navigation = this._navigation();
    if (!controls?.enabled || !navigation?.orbit || !navigation.perspective) return;

    // Burst throttle: the first tick of a burst raycasts, the rest reuse the clamp it computed.
    // Stamped *before* the async hop so a 30-events-per-second burst cannot queue N raycasts.
    if (performance.now() - this._lastClampAt < CLAMP_CACHE_MS) return;
    this._lastClampAt = performance.now();

    void this._clampToHoveredSurface(controls);
  };

  /**
   * Releases the clamp and re-anchors the pivot once the camera has settled — the **only** safe
   * moment to touch the pivot at all.
   *
   * ⚠️ **Why not during a wheel burst.** `update()`'s `dollyToCursor` block derives
   * `dollyControlAmount = _spherical.radius − _lastDistance` and turns it into
   * `lerpRatio = (prevRadius − _sphericalEnd.radius) / _sphericalEnd.radius`. `setTarget` teleports
   * the radius behind `_lastDistance`'s back, so with a notch still pending a 20 → 2 re-anchor makes
   * `dollyControlAmount` −18 and `lerpRatio` ≈ **9** instead of ≈ 0.05 — the target is lerped nine
   * times past the cursor and the camera lurches. That is the jerk. `rest` fires only after every
   * damped delta has fallen under `restThreshold`, so nothing is pending and the block is skipped
   * entirely (it is gated on `_changedDolly !== 0`).
   *
   * It fires after a **rotate** as well as a zoom, which is what recovers a parked camera: park at a
   * face, spin to another element, and the pivot is re-anchored onto *that* element before the next
   * wheel event, so `radius` is healthy and the clamp has room to work.
   *
   * Raycasting here is cheap — once per settled gesture, not per frame — and needed rather than
   * reusing the burst's hit, which a rotate has already made stale.
   *
   * ⚠️ **Known rough edge, deliberately left:** the vendor emits no `rest` for a notch that moved
   * nothing, so a zoom that is *already* frozen does not recover here — it waits for some other
   * motion to produce a `rest`, which is why a parked camera can need several scrolls before it
   * moves. Two fixes were tried and both were worse: re-anchoring from the wheel jerks the camera,
   * and doing it via the view axis sends the zoom at screen centre instead of the hovered element.
   * → ADR-0006.
   */
  private _onRest = () => {
    const controls = this._controls;
    const navigation = this._navigation();
    if (!controls?.enabled || !navigation?.orbit || !navigation.perspective) return;

    // Release the clamp the burst left raised, or it silently breaks every `fitToSphere` caller:
    // that method ends in `dollyTo(distanceToFit)`, which clamps — so a `minDistance` still sitting
    // at 18 m frames `ToolbarFocus`, `PropertyTable`'s zoom-to-selection and `Views2DList`'s plan
    // view far too wide. Released to the standoff rather than the vendor baseline, which is looser
    // than both that and `OrbitMode`'s `1`, so it can never block a fit again. Safe to do here and
    // nowhere else: the camera has stopped where the clamp put it, and the re-anchor below restores
    // a healthy radius in the same breath, so releasing cannot resurrect the freeze.
    controls.minDistance = Math.min(
      this._standoff(),
      controls.maxDistance * MAX_DISTANCE_MARGIN,
    );

    void this._pivotOnHoveredSurface(controls);
  };

  /**
   * Re-anchors the orbit target onto the hovered hit's **depth along the current view axis**:
   * `target = position + axis · (toHit · axis)`.
   *
   * The new target stays on the axis the camera is already looking down, so the view direction
   * does not change and **nothing moves on screen**. What changes is `radius`: it becomes the
   * depth of whatever is under the cursor. That is the premise the whole design rests on — the
   * dolly stride is `radius × 0.95^-delta`, so it only feels right when `radius` measures the
   * distance to what you are looking at (ADR-0004 item 1), and it is what keeps `minDistance`
   * from ever meeting `radius` (ADR-0006).
   *
   * `setTarget` is `getPosition()` + `setLookAt()`, and `setLookAt` writes `_sphericalEnd`
   * directly, is never clamped, and sets no focal offset — which is exactly why this is safe
   * where `setOrbitPoint` was not.
   *
   * ⚠️ Callers must only invoke this at a true wheel-burst start or on pointerdown. It rewrites
   * `_spherical` *and* `_sphericalEnd`, so calling it mid-dolly cancels that notch.
   */
  private _reanchorPivot(controls: CameraControls, hit: THREE.Vector3, standoff: number) {
    try {
      const position = controls.getPosition(new THREE.Vector3());
      const target = controls.getTarget(new THREE.Vector3());

      // The axis `minDistance` actually measures along.
      const axis = target.sub(position);
      if (axis.lengthSq() < 1e-8) {
        // Target has collapsed onto the camera — the very state this fix repairs. Fall back to
        // the camera's own forward vector.
        const three = this._world?.camera.three as THREE.PerspectiveCamera | undefined;
        if (!three) return;
        three.getWorldDirection(axis);
      }
      axis.normalize();

      const depth = hit.clone().sub(position).dot(axis);
      // Re-anchoring at or inside the standoff would put the target on the camera and drive
      // radius → 0 — the same collapse by another route.
      if (!Number.isFinite(depth) || depth <= standoff) return;

      // ⚠️ Load-bearing, not an optimisation: `setTarget` sets `_needsUpdate`, which makes `update()`
      // emit another `rest`, which calls straight back in here. Without a no-op bail that is an
      // endless rest→setTarget→rest loop raycasting every frame. 1% of depth is far below anything
      // visible and far above float noise.
      if (Math.abs(depth - controls.distance) <= depth * REANCHOR_EPSILON) return;

      const next = position.clone().addScaledVector(axis, depth);
      controls.setTarget(next.x, next.y, next.z, false);
    } catch {
      // Controls disposed while the raycast was in flight.
    }
  }

  /**
   * Raises `minDistance` so the dolly runs out one standoff short of the hovered surface.
   *
   * ⚠️ **This path must never re-anchor the pivot** — see `_onRest`. So the pivot it works with is
   * usually stale, which is exactly what the trigonometry is for: `dollyToCursor` walks the camera
   * along the **cursor ray**, while `minDistance` bounds `|camera − target|`, so the travel is
   * projected onto the camera→target axis. Without the `cos θ` term the stop is ~13% off at the
   * edge of the 60° frustum.
   */
  private async _clampToHoveredSurface(controls: CameraControls) {
    const point = await this._castRay();
    const standoff = this._standoff();
    if (this._controls !== controls) return;

    try {
      if (!point) {
        this._marker.hide();
        // Cursor over empty space: the loosest bound we ever apply, so zooming toward the existing
        // pivot still works. Zoom-*out* is never bounded by `minDistance`.
        controls.minDistance = Math.min(standoff, controls.maxDistance * MAX_DISTANCE_MARGIN);
        return;
      }

      if (this._markerSuppressed()) this._marker.hide();
      else this._marker.showAt(point);

      const position = controls.getPosition(new THREE.Vector3());
      const target = controls.getTarget(new THREE.Vector3());

      const toHit = point.clone().sub(position);
      const hitDistance = toHit.length();
      // Already parked at the surface. Leaving the clamp alone matters: a negative travel would
      // compute a bound *larger* than the current distance and push the camera off the face.
      if (hitDistance <= standoff) return;

      const axis = target.clone().sub(position);
      const axisLength = axis.length();
      const cosAngle =
        axisLength > 0
          ? THREE.MathUtils.clamp(toHit.dot(axis) / (hitDistance * axisLength), 0.1, 1)
          : 1;

      const travel = (hitDistance - standoff) * cosAngle;
      const limit = Math.max(standoff, controls.distance - travel);
      controls.minDistance = Math.min(limit, controls.maxDistance * MAX_DISTANCE_MARGIN);
    } catch {
      // Controls disposed while the raycast was in flight.
    }
  }

  /**
   * One clip-aware hit under the cursor, or `null`.
   *
   * The world's raycaster is `ClipAwareRaycaster`, so a section cut cannot make the camera stop
   * against geometry the GPU has already discarded. No `snappingClasses` are passed: navigation
   * wants the surface itself, not the nearest vertex.
   */
  private async _castRay(): Promise<THREE.Vector3 | null> {
    const world = this._world;
    if (!world || this._raycastInProgress) return null;
    this._raycastInProgress = true;

    try {
      const hit = await this.components.get(OBC.Raycasters).get(world).castRay();
      return hit?.point ? hit.point.clone() : null;
    } catch {
      return null;
    } finally {
      this._raycastInProgress = false;
    }
  }

  // ─── Dispose ───────────────────────────────────────────────────────────────

  dispose() {
    this._detach();
    this._world = null;
    this.onDisposed.trigger(CursorZoom.uuid);
    this.onDisposed.reset();
  }
}
