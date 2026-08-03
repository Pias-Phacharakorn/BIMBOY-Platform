# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

## In flight — Bug: clicking into a cut selects invisible geometry

**`OBC.SimpleRaycaster.castRay()` is not clipping-aware for model geometry.** Verified
in both the `components` and `components-front` bundles:

```js
c = await fragments.raycast({ camera, dom, mouse });  // fragment hit
if (items.length === 0) return c;                     // <- returned UNFILTERED
const u = this.intersect(items);                      // only this path is clip-filtered
```

`filterClippingPlanes` is applied **only** to the plain-THREE `items` path. Its JSDoc
claims `castRay` "also takes into account the clipping planes used by the renderer" —
that is true for `items` and false for fragments.

Consequence: viewed from the cut side, removed geometry sits between camera and the
visible surface. `OBF.Highlighter` picks that invisible geometry, so clicking a cut
face selects something you cannot see — or appears to select nothing, because the
outline is drawn on hidden geometry. **Not a regression from our work** — it is
pre-existing OBC behaviour that only surfaced once section planes became usable. Every
`castRay` consumer has it: highlighter, hoverer, all three measure cursors,
`SpotCoordinate`, and our own `ClipperPlacementManager` (which would otherwise place a
second plane on removed geometry).

1. **Fall through to the nearest *visible* hit**, not merely reject the clipped one.
   Rejecting (return `null` when the first hit is clipped) is five lines and stops the
   wrong element being selected, but leaves the reported symptom in place: the visible
   element still cannot be selected. `raycastAll` is on **`FragmentsModel`**, not the
   manager, so this means iterating `fragments.list`, merging, filtering and taking the
   nearest survivor.
2. **Fix it by swapping the world's raycaster**, not by reimplementing selection. The
   Highlighter picks through `Raycasters` internally and exposes no veto hook
   (`onBeforeHighlight` is a plain `OBC.Event`, not cancellable), so changing what that
   raycaster returns is the only route to correct selection. Rejected disabling the
   Highlighter's pointer wiring and driving selection ourselves: it would mean
   reimplementing multi-select, modifier keys, the `selectable` maps and the highlight
   events. One override fixes every consumer instead.
3. **Fast-path when nothing is clipped:** no enabled clipping plane → delegate straight
   to `super.castRay()`. This matters because `Hoverer` raycasts on every
   `pointermove`, and the merged `raycastAll` path replaces a call the vendor has
   optimised. Rejected always taking the merged path (one code path, no divergence
   risk — but a per-model `raycastAll` on every hover with no section active).
4. **Filter against `renderer.three.clippingPlanes`, not `Clipper.list`.** The renderer's
   array is what actually removes geometry, so it matches exactly what the user sees —
   including the Drawing Editor's own section clip — and it mirrors OBC's own
   `filterClippingPlanes`.
5. **Snapping and fast picking delegate to `super`.** Nothing in `src/` passes
   `snappingClasses` and `useFastModelPicking` defaults to `false`, so reimplementing
   those two branches would fork ~60 lines of vendored logic for paths this app never
   takes. Documented as a limitation rather than covered.

6. **Sectioning stays render-only; picking is taught to follow the view.** Confirmed
   with the developer against the observed repro (cut at the roof, drag down, click a
   revealed element, the *roof* selects). Decisive reason a section cannot be made to
   hide items instead: **a plane cuts through elements**, and `Hider.set()` is per item
   — hiding the cut-away part of a floor slab means hiding the whole slab, losing the
   cut face, which is the point of a section. Only a render-time clip can draw half an
   element. Rejected additionally driving `Hider` for items that fall *entirely* on the
   removed side: it needs a per-item bbox test against the plane on every drag frame,
   and elements straddling the plane still need the pick fix — additive work, not a
   replacement. Also rejected documenting it as a known limitation: the tool's whole
   purpose is inspecting what a cut reveals.
7. **Axis naming in the docs: world letters, plus what each cut is, plus the IFC note.**
   `axisOf()` reads world X/Y/Z, so those stay primary and greppable — but the table
   gets a "what it cuts" column, because a reader who thinks Z-up reads the vertical row
   as red and concludes the mapping is broken. ⚠️ **Vertical is world Y here.** IFC
   authors Z-up; FRAGS presents the model Y-up, which is why a plan/level cut wears a
   **blue** outline and not a red one.

   | normal | colour | what it cuts |
   |--------|--------|--------------|
   | ±Y | blue | a plan / level cut (horizontal) |
   | ±X | green | an elevation cut facing X |
   | ±Z | red | an elevation cut facing Z |

Install: `Raycasters.list` is keyed by `world.uuid`, and `get()` registers a
`world.onDisposed → delete(world)` hook. So call `get(world)` first (so teardown is
registered), dispose the default instance, then `list.set(world.uuid, ours)`. Safe to do
after `create-world.ts` has already created the default, because every consumer resolves
`Raycasters.get(world)` per pick rather than caching the instance.

Lives in `setup/src/clip-aware-raycaster.ts` and is wired from `setup/index.ts` — this is
world/engine infrastructure, not something the section tool owns.

_No other decisions in flight._

Recently promoted (for reference — do not re-stage here):

- **Section tool — outline cut planes + shared `GizmoAxis` component** (shipped
  `6c9ce18`) → how it works, plus the three-part plane anatomy, the
  `SimplePlane.visible` triple-duty setter, the `BoundingBoxer` load-time race, the
  `window`-capture pointerdown, the `GizmoAxis` handle API, the cone-aiming trap and
  the relative-imports-inside-`bim-components/` rule:
  `docs/feature/bim-viewer.md` § Section tool. Why outline-only and never pickable,
  with the shipped-then-reversed grabbable quad and the axis-colour inversion:
  `docs/adr/0002-section-plane-outline-only.md`.
- **Viewport toolbar — Visibility dropdown group** (shipped `d733b22`) → how it
  works, plus the two-rail geometry, the hand-rolled dropdown idiom, the right
  rail's FX suppression, and the rejected `^` caret affordance:
  `docs/feature/bim-viewer.md` § Viewport toolbars.
- **AR live viewer — glass UI restyle + opacity slider** (shipped `9b255d6`) → how it
  works: `docs/feature/ar-webxr.md`; why, with rejected alternatives:
  `docs/adr/0001-ar-overlay-model-opacity.md`.
