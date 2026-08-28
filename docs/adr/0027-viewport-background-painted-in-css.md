# ADR-0027: The viewport background is painted in CSS, not in three.js

**Status:** Accepted
**Date:** 2026-08-27
**Area:** [`docs/feature/bim-viewport-toolbars.md`](../feature/bim-viewport-toolbars.md) § Settings → Background

## Context

A Navisworks-style Background dialog, behind a row in Viewport Settings, with two styles — Graduated
(top/bottom) and Plain.

The instinctive answer is `world.scene.three.background`, because it is a 3D viewer. But this app
already paints the viewport's backdrop in CSS: `.viewport-container` carries a
`linear-gradient(135deg, …)` plus a radial highlight, showing through a canvas whose
`scene.three.background` is deliberately `null`.

## Decision

Drive a CSS custom property on that existing mechanism. The store never touches
`world.scene.three.background`, which stays `null`.

`viewportBackground` starts `null`, and `.viewport-container` reads
`background: var(--viewport-bg, <the two existing layers>)` — so **the branded look is the `var()`
fallback**, untouched, glow included, until the user picks something. "Reset to defaults" removes the
property rather than writing a colour.

State is `{ style, topColor, bottomColor }` in `uiStore`, session-only, alongside
`backgroundModalOpen`. Plain shows one row labelled Color bound to `topColor`, so Graduated → Plain →
Graduated is lossless. The dialog applies live, with Cancel restoring an open-time snapshot; buttons
are Reset to defaults / Cancel / Done.

## Alternatives rejected

- **`scene.three.background`.** The "correct" 3D answer, and it buys nothing here. A graduated
  backdrop needs a generated `CanvasTexture` rebuilt and disposed on every colour change; it renders
  through the base pass every frame; and it puts a new full-screen surface in front of AO and edge
  detection that nothing has tested. The one real argument for it — appearing in a canvas screenshot —
  is moot: `src/` has no `toDataURL` and no `preserveDrawingBuffer`, and the clash thumbnails come
  from BCF images.
- **Make Graduated-with-sampled-colours the new default.** A two-state model instead of three, at the
  cost of the app booting subtly different from today: vertical instead of 135°, and the blue radial
  highlight gone for good.
- **Keep the glow layered over every choice.** A "Plain" background with a blue glow in the corner is
  not plain, and the preview pane would have to either lie or replicate it.
- **A separate `plainColor` field.** Lets two unrelated looks coexist, at the cost of switching to
  Plain showing a colour unrelated to the gradient just on screen.
- **Faithful OK/Cancel/Apply.** Three buttons with three meanings, and it makes a small preview square
  stand in for a full viewport. The real viewport *is* the preview; the modal's pane is a convenience.
- **Live apply with no Cancel.** Consistent with every other viewport setting, but a background is a
  look you experiment with, and there is no undo once the old hex is gone.
- **Local `useState` in `ToolbarSettings`.** What `ToolbarLoadModel` does for `CloudModelModal`, and
  what that file already does for `hoverColor` and `gridVisible`, so it would read as consistent — but
  the CSS variable lives on `documentElement` and survives a `ToolbarSettings` remount, so local state
  could reset and leave the settings row's swatch disagreeing with what the viewport is showing. One
  owner, no drift.
- **Per-user `localStorage` or per-project Supabase persistence.** Considered and declined: the
  background behaves like every other viewport setting for now, and Supabase would need a migration
  and a mutation before a single pixel changed.
- **Build the dialog on `components/ui/Modal`.** That shared primitive is a bare box with an unstyled
  "Close" text button, no header and no footer; matching the reference through it would mean
  rebuilding the chrome inside it anyway. Improving the shared primitive first was rejected as scope —
  it turns a viewport feature into a refactor of a component used by other screens. The dialog copies
  `CloudModelModal`'s chrome and lives beside it in `components/bim/`.

## Consequences

- **Scope is automatic.** `.viewport-container` has exactly one user, `ViewportWrapper`, so the
  setting reaches every ModelsView tab and nothing else.
- **"No override" is a real state, and it is the default** — three states, not two. Code reading
  `viewportBackground` must handle `null` as "the branded look", not as "unset, pick something".
- **The Realistic tab is unaffected and will ignore the setting.** `RealisticView` adds a `Sky`
  *mesh* to the scene rather than setting `scene.background`, so it hides the backdrop entirely
  regardless of which mechanism paints it ([ADR-0024](0024-realistic-view-on-three-0182-primitives.md)).
- The choice does not survive a reload. That is the same contract as every other viewport setting
  today.
