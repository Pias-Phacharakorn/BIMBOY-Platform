# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

## In flight — Section tool: outline cut planes, gizmo-only drag

Target: `src/bim-components/setup/src/clipper-cursor.ts` (`ClipperCursor`). No
React/UI change beyond what the `ToolbarClip.tsx` dropdown already does.

**Revision note.** An earlier round of this feature shipped a *filled* white/blue
quad that was itself draggable. Both were wrong in use: the fill fought element
selection for clicks, and a translucent sheet over the model was not what was
wanted. The decisions below supersede that round — where a decision replaces an
earlier one, the earlier one is named so the reversal is not re-litigated later.

**Terminology.** A *cut plane* is one `OBC.SimplePlane` in `OBC.Clipper.list`,
mirrored by a `ClipperPlaneState` row in `ClipperCursor.planes`. Its parts:

| Part | What it is | Lives in |
|------|-----------|----------|
| **outline** | `LineLoop` tracing the plane's rectangle, child of `_planeMesh` so `plane.size` scales it | `world.scene` (depth-tests against the model, and is clipped by *other* planes) |
| **quad** | `SimplePlane._planeMesh` — kept as the invisible carrier for the outline and for `plane.size`, never rendered | `world.scene` |
| **axis gizmo** | BIMBOY's own 3-axis lines + cones + centre diamond, plus one invisible grab cylinder | `_gizmoScene` — 2nd render pass, clipping suspended, `depthTest: false` |
| ~~**drag arrow**~~ | native `TransformControls` — hidden and `enabled = false` on every visibility pass, because the `SimplePlane.visible` setter keeps springing it back | `world.scene`, added by `SimplePlane` itself |

1. **The plane renders as an outline only — no fill of any kind.**
   `plane.planeMaterial` becomes an invisible material (the same
   `visible: false` trick `SimplePlane` uses for its own `_arrowBoundBox`) and the
   `LineLoop` child carries the whole visual. Note it must be the *material* that
   is invisible, not `_planeMesh.visible` — hiding the mesh would skip its
   children and take the outline with it. Supersedes the earlier white/blue
   translucent fill. Rejected keeping a whisper of fill (α 0.04–0.06) for
   edge-on legibility: any fill tints what is behind it, which is the thing being
   reacted against. Also rejected corner brackets only — the reference reads as a
   closed rectangle.
2. **Outline colour is the plane normal's dominant world axis:** `absX` → green
   `0x00ff00`, `absY` → blue `0x0000ff`, `absZ` → red `0xff0000`, ties going to X
   then Y (i.e. the exact `if / else if` order the developer supplied). Supersedes
   the white-idle / accent-blue-active scheme, which carried interaction state in
   the one channel that now carries orientation.
3. **State rides on opacity, not hue or width:** idle 0.45 → selected 0.85 →
   hovered-or-dragging 1.0, same hue throughout. **`LineBasicMaterial.linewidth`
   is ignored by `WebGLRenderer`** (lines are always 1px), so a thickness change
   would need `Line2`/fat-line geometry from three's examples — not worth the
   dependency for a hover cue, hence three opacity tiers instead of two plus a
   weight change.
4. **The plane is not a drag handle and intercepts no clicks.** Supersedes the
   quad-grab decision outright: the pointer conflict with element selection was the
   reported failure, and with the fill gone there is no surface left to grab. This
   deletes the whole occlusion-arbitration mechanism the earlier round needed — the
   async `castRay` depth compare on hover, and the clipped-hit filter that existed
   only because fragment raycasting ignores clipping planes.
5. **The gizmo is world-axis-aligned:** it takes the helper's *position* but not
   its rotation, so green always runs along world X, blue straight up along Y, red
   along Z. Supersedes copying the helper's quaternion. This is what makes the
   colour scheme cohere — a mostly-`+Y` plane wears a blue outline *and* the arrow
   you drag it along is the vertical blue one. Rejected keeping it plane-aligned:
   truer to a skewed normal, but then gizmo colour means a local axis while
   outline colour means a world axis, so the same red denotes two different things.
6. **Gizmo axis colours follow the same table** (X green, Y blue, Z red), not
   three.js' X-red/Y-green/Z-blue convention. One table for gizmo and outline
   both; the alternative has every row contradicting itself.
7. **Only the arrow matching the plane's colour is grabbable**, via one invisible
   cylinder on that axis. Dragging slides the plane along its **true normal**, not
   along the snapped world axis, so a tilted plane still moves exactly
   perpendicular to itself. Rejected a sphere picker over the whole gizmo (the
   three arrows would then be decoration) and making all three arrows grabbable
   (two of the three would move the plane in a direction other than the one pulled).
8. **Outline extent = bounding-box diagonal × 1.0** (was × 0.6), via
   `OBC.BoundingBoxer.addFromModels()`, `autoScale = false`, debounced off
   `FragmentsManager.list`. At 0.6 a long thin building gets an outline running
   *inside* its own plan; the diagonal clears the footprint from any angle.
9. **Gizmo stays screen-constant** — `GIZMO_VIEW_FRACTION` of the viewport's
   world-space height, per-frame, handling both perspective and orthographic
   cameras. Unchanged from the previous round and still the only reason the gizmo
   stays usable across a 10 m villa and a 500 m masterplan.

Accepted consequence (unchanged from the previous round): the outline lives in
`world.scene`, so another enabled plane can clip part of it away. Immunity would
mean moving it into `_gizmoScene`, which would also make it immune to *depth* —
drawing over the model instead of behind it. `WebGLRenderer.clippingPlanes` is
global with no per-material opt-out, so those two properties cannot be separated.

## In flight — ClipperCursor: promote out of `setup/`, split by manager

Follows the outline-cut-plane work above, and should land as its own commit: a
984-line file split produces a diff that is almost entirely moved code, and mixing
it with the feature diff makes both unreviewable.

**Why it reached 984 lines** (703 code / 124 comment / 157 blank). Five causes,
biggest first:

1. **Five concerns in one class** — plane registry (the state React subscribes
   to), placement tool, visual styler, 3D mesh builder, pointer/drag controller.
   Each is independently 100–200 lines. None is wrong; there are simply five.
2. **It sits in the bootstrap folder, so it had no room to grow properly.**
   `setup/src/` is glue — its other 14 files are 9–200 lines and mostly wire up an
   OBC singleton. Every genuine custom `OBC.Component` here gets
   `bim-components/<Name>/index.ts` + `src/` and splits by manager (MiniMap 3,
   PropertyTable 6). `ClipperCursor` never got that, and is now the largest file
   in `setup/src` by 60% — `surface-measure-cursor.ts` (615) is the same family
   with the same problem.
3. **Hand-rolled plumbing** — 8 nullable listener fields with matching manual
   teardown ≈ an 89-line `dispose`; NDC maths written out twice; raycast normal
   extraction written out twice.
4. **Debug narration** — 20 `console.log`, 12 inside placement mode.
5. **Dead code** — `createPlane()`, public, 25 lines, zero callers in `src/`.

Decisions:

1. **Promote to `src/bim-components/ClipperCursor/`**, mirroring MiniMap exactly:
   `index.ts` holds the component class itself (not a re-export), `src/` holds the
   managers, `src/index.ts` re-exports them. Rejected splitting in place under
   `setup/src/clipper/` — smaller blast radius, but it leaves a full custom
   component inside the folder CLAUDE.md calls world/engine bootstrap, which is
   what let it grow unchecked. Rejected trim-only (≈700 lines, tiny diff): still
   one file doing five jobs, back over 900 after the next feature.
2. **Each manager owns its own per-plane slice**; the component keeps only what
   React reads (`planes`, `selectedPlaneId`, `placing`) and calls
   `add(id, plane)` / `remove(id)`. This is what retires cause 3 — disposal stops
   being a central 89-line routine and becomes each manager freeing what it
   allocated. The shared `PlaneVisuals` struct disappears. `ClipperDragManager`
   takes `ClipperGizmoManager` in its constructor to ask for picker meshes, the
   same shape as `MiniMapCameraManager(this, uiManager, cacheManager)`. Rejected
   the component owning the map (keeps it the hub every concern reaches through)
   and managers holding a back-reference to the component (mutual pointers, any
   manager mutating shared state from anywhere — how the concerns entangled in the
   first place).
3. **`axisOf(normal)` becomes a shared pure module**, not a method. Both the
   outline (colour) and the gizmo (axis colours + which picker to build) need it,
   so it cannot live in either manager without one importing the other.
4. **The gizmo mesh builder is a pure function file**, separate from the gizmo
   manager: ~120 lines of geometry with no state, versus the manager's scene,
   render pass, scale and map. Splitting them is what keeps the largest new file
   near 200.
5. **Fold in three fixes rather than carry them across**: delete dead
   `createPlane`, strip all 20 `console.log`s, and **drop `@ts-nocheck`** on the
   new files — verified: the file already type-checks with the pragma lifted, the
   one gap (`TransformControls.getHelper` absent from the resolved three types)
   being isolated behind `_suppressDefaultArrow(plane: any)`. Note this breaks
   with the family convention, since MiniMap carries `@ts-nocheck` in every file.
6. **Leave the `components.get(ClipperCursor as any)` cast alone.** Deliberately
   *not* fixed here: the same compile-time lie exists in all three measure
   cursors, and spot-fixing one creates a special case in shared infra. The real
   fix is family-wide — a typed `getCursor()` accessor, or migrating all four to
   the post-construction world-setter pattern `ArSession`/`Hoverer` already use.

Target layout (largest file ~200 lines):

```
bim-components/ClipperCursor/
  index.ts                          ~200  component: state, public API, events,
                                          _syncVisibility, arrow suppression, dispose
  src/
    ClipperGizmoManager.ts          ~130  overlay scene, render pass, screen-constant
                                          scale, planeId -> group/picker map
    gizmo-mesh.ts                   ~120  pure builder: axes, cones, diamond, picker
    ClipperOutlineManager.ts        ~170  outline + materials, opacity tiers, bbox sizing
    ClipperDragManager.ts           ~200  pointer listeners, hover, drag maths
    ClipperPlacementManager.ts      ~110  place-by-click mode
    plane-axis.ts                    ~35  AXIS_COLORS + axisOf(normal)
    types.ts                         ~30  ClipperPlaneState, DragSession
    index.ts                          ~7  re-exports
```

Import updates (only three call sites reference it today): `setup/index.ts`,
`setup/src/index.ts` (drop the `export *`), `ToolbarClip.tsx`.
`setupClipperCursor(components, world, viewport)` keeps its name and signature, so
those call sites change only their import path.

## In flight — `GizmoAxis`: extract the overlay axis gizmo as its own component

Follows the `ClipperCursor` split above. Two findings framed it:

- **The overlay render pass exists nowhere else in the repo.** `ClipperGizmoManager`
  is the only thing doing a second pass with its own scene, so one shared owner
  means one extra pass however many tools use it — versus one pass each if every
  tool rolls its own.
- **There is no second consumer today.** Nothing else builds axis gizmos, so the
  reuse argument is speculative. The *cohesion* argument is not: the mesh and the
  pass that draws it belong together, and neither is about clipping.

Every one of the 11 members of `bim-components/` is an `OBC.Component` with a
uuid, so a bare module folder would have been the only exception.

1. **`GizmoAxis` absorbs `ClipperGizmoManager` entirely** — it owns the one overlay
   scene, the one render pass, the meshes and the screen-constant scaling.
   `ClipperGizmoManager.ts` is deleted. Rejected wrapping only the mesh builder in
   a component: with no state and no lifecycle, its uuid and `dispose()` would be
   ceremony, and the mesh would stay split from the pass that draws it. Rejected a
   plain non-component module folder — it would make the folder convention
   unreliable.
2. **1-arg constructor plus a `world` setter**, as `SpotCoordinate`, `ArSession`
   and `Hoverer` already do. This is the point: a 1-arg constructor is what
   `OBC.Components.get()` expects, so `components.get(GizmoAxis)` needs **no cast**
   — unlike `ClipperCursor`, whose 3-arg constructor forces
   `get(ClipperCursor as any)` in `ToolbarClip`. The new component therefore starts
   on the right side of the documented family-wide cursor-typing debt instead of
   adding a fresh instance of it. Setting `world` (re)registers the render pass.
   Rejected a per-world map: more machinery than one overlay scene needs while the
   app runs a single main world.
3. **`create(opts)` returns an opaque `AxisGizmoHandle`** carrying `picker`,
   `grabAxis`, `visible` and `dispose()`. No shared key namespace, so two tools can
   never stomp each other's gizmo and a disposed handle cannot be reused. Rejected
   id-keyed methods (`add(key)` / `setVisible(key)` / `remove(key)`), which would
   have been a drop-in for the existing `ClipperDragManager` but would make a
   shared component own a key namespace every future consumer has to avoid
   colliding in.
4. **`AXIS_COLORS`, `PlaneAxis` and `axisOf()` all move to `GizmoAxis`** — "which
   world axis does this vector point down, and what colour is that axis" is generic
   geometry with nothing to do with clipping. `ClipperCursor/src/plane-axis.ts` is
   deleted; `ClipperOutlineManager` imports `axisOf` to colour its rectangle. One
   table, one definition, dependency pointing from clipper → gizmo. This matters
   because the gizmo's arrows and the outline matching each other *is* the colour
   scheme; two tables would let them drift.
5. **World-aligned only, one scale constant, exactly one grabbable axis.** The
   limitation is documented in the class doc rather than parameterised: adding an
   `orientation: "world" | "follow"` option is about four lines, and with one
   consumer any knob shipped now is a guess rather than an answer. Note the
   world-aligned constraint is a *clipper* rationale (outline/arrow colour
   coherence), not a universal one — so it is the first thing a second consumer
   will want changed.
6. **Refinement found while specifying, not in the approved option list:**
   `GizmoAxis` gets **no `pickTargets()`**. Since the handle already exposes
   `picker` and `visible`, a caller that holds its own handles can build its target
   list itself, and `ClipperCursor` does exactly that — which also means
   `ClipperDragManager` never learns `GizmoAxis` exists. Its
   `gizmos: ClipperGizmoManager` option becomes
   `pickTargets: () => { mesh, planeId }[]`, supplied by the component. Smaller
   surface on the shared component, and one less dependency edge.

Target layout:

```
bim-components/GizmoAxis/
  index.ts                    ~150  GizmoAxis component: world setter, overlay scene,
                                    render pass, screen-constant scale, create()
  src/
    axis-gizmo-mesh.ts        ~115  pure builder (moved from ClipperCursor unchanged)
    axis.ts                    ~37  AXIS_COLORS · PlaneAxis · axisOf()
    types.ts                   ~30  AxisGizmoHandle · AxisGizmoOptions
    index.ts                    ~5  re-exports

bim-components/ClipperCursor/
  index.ts                    ~270  + Map<planeId, AxisGizmoHandle>, + pickTargets supplier
  src/ClipperDragManager.ts   ~250  takes a pickTargets callback, not the gizmo manager
  src/ClipperOutlineManager.ts ~160  imports axisOf from GizmoAxis
  src/ClipperGizmoManager.ts        DELETED (−132)
  src/gizmo-mesh.ts                 MOVED to GizmoAxis (−115)
  src/plane-axis.ts                 DELETED, absorbed by GizmoAxis/src/axis.ts (−37)
```

`setup/index.ts` gains `const gizmoAxis = new GizmoAxis(components); gizmoAxis.world
= world;` before `setupClipperCursor(...)`. Registration order is not strictly
required — `components.get()` would construct it on demand and the constructor
`add`s itself — but `world` must be set before any gizmo is created.

## In flight — Gizmo highlight, grab-axis emphasis, and an outline-size race

Amends the three blocks above. Two visual changes plus one real bug.

**The bug: the outline size read races model loading.** `BoundingBoxer.addFromModels()`
unions each `model.box`, which FRAGS derives as
`_bbox.clone().applyMatrix4(object.matrixWorld)`. A model is in `fragments.list`
while still loading — FRAGS exposes `isBusy` as
`!_isLoaded || _isProcessing || pendingRequests` — so at `onItemSet` the box can
still be empty. `ClipperOutlineManager` is the **only** boxer consumer in the repo
that reads at load time; `view-cube.ts` and `ToolbarSettings.tsx` both read on user
action, long after. On an empty box we fell through to
`FALLBACK_PLANE_SIZE = 10`, and a 10-unit outline on a ~40 m tower is exactly the
symptom reported. Corroborating detail: in the model where it *does* work, the red
and blue outlines look like different sizes but are not — the blue one is the
horizontal (Y) plane receding toward the horizon, the red one the vertical (Z) plane
nearly face-on.

1. **Measure at plane creation, and keep the load-time hook.** A plane is only ever
   created by a click, therefore always long after processing finishes, so the race
   cannot bite. The load hook stays so existing outlines still resize when a second
   model arrives. `_measure()` returns `null` on an empty box and callers **keep the
   last known good size** — the fallback now only applies when no model has ever
   been measured, which is the one case where 10 is right. Rejected only bumping the
   ratio (treats the symptom: a raced read still yields a size unrelated to the
   model) and awaiting `isBusy` (a polling loop for a value a click-time read gets
   free).
2. **Extent stays `diagonal × 1.0`.** The "want" screenshot is what this ratio
   already produces when the read is correct, so the fix alone should deliver it.
   Deliberately not bumped in the same change: doing both would make it impossible
   to attribute the result, and raising the multiplier later is one line on a
   known-good baseline.
3. **Hover or drag turns the grabbable arrow yellow** (`0xffff00`, the three.js
   TransformControls convention). Only that arrow: the other two and the centre
   diamond keep their axis colours, and the outline keeps signalling through its
   opacity tiers. `AxisGizmoHandle` gains a `highlighted` flag, which
   `ClipperCursor` drives from the same hover/drag state that already repaints
   outlines. Rejected yellowing the whole gizmo or the outline too — both discard
   the axis colour precisely while you are working, and axis colour is the only
   thing saying which way the cut faces.
4. **The grabbable arrow is drawn at ×1.5** (`GRAB_AXIS_EMPHASIS`), scaling length,
   cone height, cone radius **and the invisible grab cylinder**. Scaling the picker
   with it is the point: what you can grab stays identical to what you can see.
   Rejected leaving the picker alone (the arrow's outer third would look live and
   not be) and scaling length only (the reference clearly shows a bigger head).

Because `buildAxisGizmo` creates fresh materials per call, recolouring one gizmo's
grab arrow cannot leak into another's — the builder returns those materials so the
handle can swap them.

| | grab axis | other axes |
|---|---|---|
| length | 2.40 | 1.60 |
| cone height | 0.45 | 0.30 |
| cone radius | 0.12 | 0.08 |
| picker | half-length 2.40, r 0.525 | — |
| colour | axis colour → `0xffff00` when hovered/dragged | axis colour |

## In flight — Bug: the −Z gizmo cone points inward

Amends the gizmo block above. `createAxis` orients its two cones from a `rotZ`/`rotX`
pair, with `else coneNeg.rotation.z = Math.PI` covering the axes whose `rotZ` is 0.
For the **Z axis** that `else` fires (its `rotZ` *is* 0) *on top of*
`rotation.x = rotX + Math.PI`. Worked through three's `makeRotationFromEuler` for
order `XYZ`, those compose to send local +Y to **+Z**: the extra π about Z
double-flips the cone that `rotation.x + π` had already flipped correctly. So both
red cones point +Z, and one of them points inward.

Only that one cone is affected — X and Y both check out in each direction:

| axis | positive | negative |
|---|---|---|
| X (green) | +X ✓ | −X ✓ |
| Y (blue) | +Y ✓ | −Y ✓ |
| Z (red) | +Z ✓ | **+Z ✗** |

**Fix: orient cones by direction vector, not by Euler bookkeeping.**
`ConeGeometry`'s apex is at +Y, so `quaternion.setFromUnitVectors(+Y, direction)` is
correct for all six cones with no per-axis constants — `createAxis` loses its `rotZ`
and `rotX` parameters and six conditional lines, and the bug class becomes
unrepresentable because there is no longer an order to get wrong. three.js handles
the antiparallel −Y case explicitly (falling back to a 180° turn about Z), so the
negative blue cone is safe.

Rejected the one-line guard (`else if (rotX === 0)`): fixes the red cone, but keeps
the per-axis rotation table and its ordering assumption, so the trap is still armed
for the next axis or variant — and it reads as correct without explaining why.
Rejected baking a pre-flipped cone geometry for negative directions: doubles the
geometries per axis and hides the arrow's direction inside geometry rather than
stating it in the transform.

Recently promoted (for reference — do not re-stage here):

- **Viewport toolbar — Visibility dropdown group** (shipped `d733b22`) → how it
  works, plus the two-rail geometry, the hand-rolled dropdown idiom, the right
  rail's FX suppression, and the rejected `^` caret affordance:
  `docs/feature/bim-viewer.md` § Viewport toolbars.
- **AR live viewer — glass UI restyle + opacity slider** (shipped `9b255d6`) →
  how it works: `docs/feature/ar-webxr.md`; why, with rejected alternatives:
  `docs/adr/0001-ar-overlay-model-opacity.md`.
