# ADR-0001: AR overlay is 3 controls, and opacity fades the model — not the real world

**Status:** Accepted
**Date:** 2026-08-03
**Area:** `docs/feature/ar-webxr.md`

## Context

The in-AR dom-overlay of `ArModelViewer.tsx` was restyled to glassmorphism. Two questions had
to be settled first, and neither is recoverable from reading the code afterwards.

**1. "Ghost the model against the room" is ambiguous.** It can mean fading the BIM model, or
dimming the real-world passthrough behind it. Only one of those is physically possible: in an
`immersive-ar` session the camera passthrough is composited **by the OS**, outside our WebGL
output. Nothing a renderer does can touch it. An engineer who does not know this will keep
reaching for the impossible half of the feature.

**2. The overlay had accumulated showcase chrome** from a UI mockup — phone frame, dynamic
island, status bar, telemetry HUD, reticle, 6-tool bar, shutter button. None of it did anything
in a real session, and all of it competed for space on a phone screen held at arm's length while
the user is also physically walking around.

## Decision

**The opacity slider controls the AR model's material opacity only** — 0–100%, top = 100% solid.
It is presented as a model property, never as a "dim the room" control, and the label reflects
that single direction.

**The overlay is exactly 3 controls:** (1) **Load Model** → slide-up sheet holding the existing
multi-select `.frag` checkbox list; (2) **Recenter**; (3) the vertical opacity slider, right-centre.
Everything else was removed.

Supporting rules: opacity is a **persistent view setting** (Recenter resets position/yaw/zoom but
not opacity; newly loaded models inherit the current value), and Recenter + slider render only
once a model is loaded, so no control is ever a no-op.

## Alternatives rejected

- **Dark scrim over the passthrough to fake real-world dimming.** Because the scrim composites
  into *our* layer and the passthrough does not, it darkens the model and the UI while leaving
  the room exactly as bright — muddying the thing the user is trying to see. It reads as a bug,
  and it delivers the opposite of the intent.
- **A dual-direction slider** labelled as trading real-world visibility against model visibility.
  Actively misleading: half the range would have claimed to do something the platform cannot do.
- **Keeping the showcase chrome** (or hiding it behind a toggle). Dead UI in a live session; a
  toggle would have preserved the maintenance cost while admitting it had no use.

## Consequences

- "Dim the real world" is **permanently off the table** for WebXR `immersive-ar`, not merely
  unimplemented. Treat such a request as needing a different platform (or a video-passthrough
  headset where the camera feed *is* ours to composite), and say so rather than attempting it.
- The 3-control ceiling is a real constraint on future AR work. A fourth control needs an
  argument for why it beats the alternative of not existing — that bar is the point.
- Opacity has to be re-applied at every point where meshes enter the scene, since it is state
  the model must inherit rather than a property of the load. `applyOpacity` is the single
  chokepoint; new mesh paths that bypass it will look wrong at 0% and 100%.
