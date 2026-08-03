# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

_No decisions in flight._

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
