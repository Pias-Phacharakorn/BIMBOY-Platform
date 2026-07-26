# CONTEXT

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented and promoted into its domain guide under `.claude/docs/`
(the single source of truth), clear it from here — the domain guides are the
permanent record._

## AR live viewer — glass UI restyle + opacity slider (in flight)

Restyling the in-AR dom-overlay of `ArModelViewer.tsx` to a glassmorphism look,
scoped to exactly **3 controls**. Promote into `.claude/docs/ar-webxr.md` on merge.

- **No real-world dimming.** In immersive-ar the camera passthrough is composited
  by the OS — our renderer cannot dim it. The opacity slider therefore controls
  **only the AR model's material opacity** (0–100%, top = 100% solid). Rejected:
  dark scrim (muddies the model), misleading dual-direction label.
- **3 controls only.** (1) "Load Model" button → slide-up sheet with the existing
  **multi-select** .frag checkbox list; (2) Recenter; (3) vertical opacity slider
  (right-centre). Dropped all showcase chrome (phone frame, dynamic island, status
  bar, telemetry HUD, reticle, 6-tool bar, shutter) — dead UI in a real session.
- **Visibility:** Load button always shown in-session; Recenter + slider appear
  only once a model is loaded (unchanged from today).
- **Opacity is a persistent view setting** — Recenter resets zoom/position but NOT
  opacity; newly loaded models inherit the current slider value.
- **Styling:** convert overlay to Tailwind per CLAUDE.md; custom range-thumb / glass
  bits go in `style.css` `@layer`. (Overlay is normal page DOM, not shadow DOM, so
  Tailwind + global stylesheet apply.)
