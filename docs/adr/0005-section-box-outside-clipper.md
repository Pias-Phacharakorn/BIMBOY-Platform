# ADR-0005: The section box clips with bare `THREE.Plane`s, outside `OBC.Clipper`

**Status:** Accepted
**Date:** 2026-08-04
**Area:** `docs/feature/bim-viewer.md` § Section box

## Context

The section box needs six clipping planes that crop the model to a volume. The repo already has a component that makes clipping planes — `ClipperCursor`, on top of `OBC.Clipper` — so reusing it looked like the default, and its `ClipperDragManager` already implemented exactly the drag a box face needs.

Four vendor facts, established by reading `node_modules/@thatopen/components/dist/index.mjs` rather than the docs, decided it otherwise:

1. **`SimplePlane`'s constructor calls `world.renderer.setPlane(true, this.three)`** (`:17408`). A plane clips from the moment it exists, and `SimplePlane.enabled` (`:17463`) — which calls `setPlane(state, …)` — is the real on/off switch.
2. **`Clipper.enabled` clips nothing.** Its setter stores `_enabled` and triggers `onStateChanged` (`:17806`); no path in `Clipper` reads it to add or remove a plane from the renderer.
3. **`Clipper`'s `size`, `material` and `visible` setters, and `getAllPlaneMeshes()`/`pickPlane()`, all iterate `Clipper.list` in full**, with no notion of which component created an entry.
4. **`OBC.Views` already clips with a bare `THREE.Plane`** pushed through `renderer.setPlane` (`:18999`, `:19256`) — so not going through `Clipper` is a path the vendor takes itself.

Fact 3 is the decisive one: a box built from `SimplePlane`s puts six entries into a shared list that any other consumer can restyle, resize or hide wholesale.

## Decision

`SectionBox` owns **six bare `THREE.Plane`s**, each with its normal pointing **inward** so the kept half-space is the box interior, registered through `world.renderer.setPlane(true, plane)`. It never touches `OBC.Clipper`.

Its 12-edge outline is a single `LineSegments` with **`depthTest: false`**, hosted in `GizmoAxis`'s existing overlay pass through a new `overlay.add()` API rather than in `world.scene`.

`ClipperDragManager` is generalised into `GizmoAxis/src/AxisDragManager.ts`, its two `OBC.Clipper.list` reads replaced by `getAxis`/`getOrigin`/`onDrag` callbacks, and is shared by `ClipperCursor` and `SectionBox`.

## Alternatives rejected

- **Six `Clipper.createFromNormalAndCoplanarPoint()` planes** — the drag manager would have worked unchanged and plane ids came free. Lost on fact 3 above: `clipper.visible = false` from anywhere reaches into the box. It also gives each face a plane mesh, a helper *and* a `TransformControls` whose arrow must be re-suppressed after **every** `visible` write (the triple-duty setter documented in the guide), and consumes `ClipperCursor`'s entire `MAX_PLANES = 6` budget with one box.
- **Growing box support inside `ClipperCursor`** — fewest new files, and its drag manager, gizmo map and outline manager were all right there. But `ToolbarClip` subscribes to its `onStateChanged`, so box state would push re-renders into the Clip menu, and the class already coordinates three managers plus a plane budget.
- **Six `GizmoAxis` handles in the existing `"axes"` form** — zero engine change. Rejected on geometry: `buildAxisGizmo` draws all three axes double-headed with a centre diamond, so a box would carry six diamonds and eighteen arrows, and its picker is a cylinder *centred on the origin* — on a thin box the +X and −X pickers overlap through the middle, so the near face's handle grabs the far one.
- **`SectionBox` building its own pad handles at face centres** — full control of shape, at the cost of duplicating the overlay scene, the clipping-suspend render pass, the `depthTest: false` rules and `_scaleAt`'s screen-constant sizing. That duplication is what `GizmoAxis` was extracted to prevent.
- **A depth-tested outline in `world.scene`**, consistent with the cut planes' outlines — clipping was *not* the obstacle (three.js discards at signed distance `< 0`, so coplanar geometry survives, which is why the plane outlines render at all). Depth was: every box edge borders the cross-sections its own planes cut, so a depth-tested wire z-fights and stipples out exactly where the crop is most interesting.
- **Wiring the box to `bimStore.activeTool`** — the reserved `'section'` member was sitting there unused. But `ViewportRightToolbar` suppresses `Hoverer`, `Outliner` **and `postproduction`** for as long as `activeTool !== "select"`, so the box would cost selection outlines and the whole post pass for as long as it cropped, and switching on Measure would silently drop the crop.
- **A second `SectionBoxDragManager`** — would have left the shipped section tool untouched. Rejected because ~180 of ~230 lines would be identical, including the `window`-capture subtlety that needed a paragraph of explanation; CONTEXT.md already records this exact duplication as the measure cursors' mistake.
- **Renaming `GizmoAxis` to `SceneOverlay`** now that it hosts non-gizmo objects — honest, but the rename reaches `ClipperCursor`, the guide, ADR-0002 and this file for no behaviour change.

## Consequences

- **We own the plane bookkeeping `Clipper` would have done.** `SectionBox.dispose()` must `setPlane(false, …)` all six, and nothing central catches a miss — a leaked plane keeps cropping with no UI left to switch it off. `BoxFacesManager.detach()` drops its `_attached` flag even when the renderer is already gone, so a later call cannot become a silent no-op.
- **Picking came free.** `ClipAwareRaycaster` filters against `renderer.three.clippingPlanes`, which `setPlane` maintains, so selection, hover and measurement inside the box were correct with no extra work. This is the payoff for having written that raycaster against the renderer's array instead of `Clipper.list`.
- **All twelve edges show through the model.** With no depth test, far edges are never occluded by near geometry. Correct for a volume boundary and how Revit and Navisworks draw theirs, but it is the same trade the pivot dot takes and will read as wrong to anyone expecting an in-scene wire.
- **The box is not mutually exclusive with Measure/Clip/Coordinate.** Intended — a crop is not a pointer mode — but it is a **fourth** activation pattern on a rail whose guide already flags the three it carries.
- **`ClipperCursor`'s drag path changed in the same commit that introduced the box.** Nothing about the section tool was meant to change; if plane dragging regresses, `AxisDragManager` is where to look, and the behaviour to compare against is `git show fc285d2:src/bim-components/ClipperCursor/src/ClipperDragManager.ts`.
- **`GizmoAxis` now has two jobs**, and its name says one. Recorded here and in its docstring rather than fixed.
- **`OBC.Views` writes to the same renderer array**, so opening a 2D view while a box is live crops by both. Left alone: forcing an interlock means teaching each feature about the other.
