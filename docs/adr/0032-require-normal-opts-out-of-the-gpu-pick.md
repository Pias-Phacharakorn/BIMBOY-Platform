# ADR-0032: `requireNormal` opts out of the 3.4.8 GPU pick rather than patching around it

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Picking

## Context

Right after a model load, the **first** section plane silently failed to place: "Add plane" armed,
the click landed, the panel closed, no plane appeared, nothing logged. Retrying two or three times
eventually worked. Ordinary click-to-select was unaffected, and once one plane existed every
subsequent plane was reliable.

The cause is a behaviour change in `@thatopen/components@3.4.8` ([ADR-0018](0018-thatopen-3-4-8-patch-bump.md))
that our code never caught up with. `OBC.SimpleRaycaster.castRay` is **no longer a worker raycast**.
It is a GPU pick — `FastModelPickers.get(world).getFullPick(position)` — composed from three
render-and-readback passes:

```js
const item   = await this.getItemAt(position);    // id pass, then AWAITS a worker round-trip
const point  = await this.getPointAt(position);   // re-renders the scene, reads depth
const normal = await this.getNormalAt(position);  // re-renders the scene, reads the normal
return { ...item, point, normal, distance };      // normal may be null — the pick still "succeeds"
```

Across that worker await the scene keeps streaming: tiles arrive, LODs swap. If the pixel under the
cursor changes in that window `getNormalAt` returns `null` and **the hit is returned anyway, with no
normal**; a null from `getPointAt` sinks the pick outright. Neither is an error, so a consumer that
needs orientation just sees an ordinary miss. Tile churn peaks right after a load, which is why the
bug clustered there and why a retry was a coin flip.

`ClipperPlacementManager._surfaceOf` then discarded the hit: it accepts `result.normal`, else falls
back to `result.face && result.object` — but **`FRAGS.RaycastResult` has no `face` field at all**, so
that branch was dead code for every fragment hit. Null surface → `exit()` → no plane, no message.
Selection survived because `Highlighter` consumes the id pass alone.

Why only the *first* plane: `ClipAwareRaycaster` takes the vendor fast path only while
`renderer.clippingPlanes` is empty. From the first plane onward every pick already ran its own
`_nearestVisibleFragment` → `model.raycastAll` → a real face normal.

⚠️ The `_vendor/engine_components` clone (3.4.2) is actively misleading here — it still shows the old
`fragments.raycast(...)` shape. `clip-aware-raycaster.ts`'s own warning predicted this exact hazard.

## Decision

`ClipAwareRaycaster.castRay({ requireNormal: true })` changes only the early-return guard, so the
pick goes down `_nearestVisibleFragment` — which already exists, already clip-filters, and already
yields real face normals from `model.raycastAll`. `ClipperPlacementManager` passes it on both its
hover and its click raycast. Opt-in, not always-on, because `Hoverer` picks on every settle and
[ADR-0020](0020-one-render-per-frame-and-hover-on-settle.md) exists precisely because that cost
matters.

**A second, sharper case followed and is covered by the same flag.** The 3.4.8 pick passes hide
non-BIM objects only where `child.isMesh`, so every `Line`, `LineSegments` and `LineLoop` in
`world.scene` renders into the id/depth/normal target *with its own material*, and its colour is
decoded as a packed depth. Measured on VOCO: on a pixel covered by a measurement line the pick
returned a point **897 m** from the camera where the worker returned **59 m** — correct ray, garbage
distance; 10 px off the line the two agreed to within 5 cm. That lands on the measure tools because
`LengthMeasurement`'s preview line ends at the cursor, so the second click of every length reads its
own preview. `MeasureHoverManager` therefore passes `requireNormal: true` as well.

## Alternatives rejected

- **A surgical fallback on the fast path** — keep the GPU pick, re-pick that one model through the
  worker to borrow a normal. New code that covers only the missing-normal case and not the
  null-`getPointAt` one, and it mixes a GPU depth point with a worker face normal, which can
  disagree across an LOD swap — the very event that caused the miss.
- **Guarantee a normal on every `castRay`.** One code path, no flag, and it makes hover pay a worker
  round-trip on every settle. See ADR-0020.
- **Raycast the worker directly from `ClipperCursor`.** Bypasses clip filtering, and
  `clip-aware-raycaster.ts` names plane placement by name as a consumer that would otherwise place
  planes on geometry a cut has already removed.
- **Drop the GPU fast path entirely.** Surrenders the hover optimisation the fast path exists for.
- **A local structural type for the widened `castRay`** instead of importing `ClipAwareRaycaster`.
  `Raycasters.get()` is typed to the base `SimpleRaycaster`, so the getter must be typed to the
  subclass somehow — but redeclaring the shape duplicates a contract with nothing to catch the two
  drifting apart. The import is `import type … from "../../setup/src/clip-aware-raycaster"`:
  module-deep rather than through the barrel, because `setup/index.ts` imports `../ClipperCursor`
  and a value import through `../../setup` would close a cycle; type-only, so it is erased at build.
- **Promote `ClipAwareRaycaster` to its own `bim-components/` folder.** Better layering, but a
  refactor opened by a bug fix, and the coupling it removes is one type import.

## Consequences

- **Placement's hover pass is heavier at zero planes.** This is exactly the cost it already paid from
  the first plane onward, so it is proven acceptable rather than speculative.
- **Three orientation consumers are still unfixed, and knowingly so:** `SpotCoordinate`,
  `SurfaceMeasureEngine` and `ViewportWrapper`'s align mode all derive a normal from `castRay` and
  all take the fast path at zero planes. Each is a one-line `requireNormal: true` when someone
  reproduces it. `CursorZoom` reads only a point and is a fourth.
- ⚠️ **`Hoverer`/`Highlighter` cannot be fixed here at all.** Selection keeps the cheap path by
  design, so a click on a pixel crossed by a measurement line can still miss or hit the wrong item.
  Only an upstream fix to `FastModelPicker` covers that.
- **A genuine miss still exits placement silently.** `.finally(() => this.exit())` fires on every
  outcome and the click chain has no `.catch`. Filed, not fixed — it is coupled to `ToolbarClip`'s
  click-outside handler closing the panel on the very click that places, so "stay armed on a miss"
  is incoherent while the only *Placing (ESC to cancel)* affordance lives in a panel that just closed.
- **The bug report that opened this (*Section Plane Misfire*, 28 Aug 2026) has a wrong diagnosis.**
  It blames `castRay()` reading "the hover pass's cached hit"; the fallback is really OBC's `Mouse`,
  updated on every canvas `pointermove`, so for a human the cached position *is* the click point. Its
  Trial C is the signature of a browser agent dispatching synthetic clicks that emit no
  `pointermove`. Keep the symptom, discard the evidence table.
