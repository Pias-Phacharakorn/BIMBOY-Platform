# AR — WebXR model viewing

> Status: seed — expand as you work this area.

## Overview

AR renders the project's BIM model in WebXR. **Only one entry point is live**: the standalone `/ar/$projectId` route (`ModelsView`'s "AR" tab navigates here), a minimal full-screen page with its own single WebGL context (no OBC engine, no competing renderer). It does **not** render at true 1:1 building scale — it auto-scales the loaded model(s) to fit a ~1.5m **miniature**. Placement is a **QR-code anchor**: the model first loads at a fixed fallback spot ~2m in front, and an in-session QR scan (WebXR Raw Camera Access) then pins the miniature onto a printed QR code — position + upright yaw. If no QR is ever found, the model simply stays in the fallback position. Manual manipulation is **pinch-to-zoom** (scales the whole model about its anchored base); there is no rotate/pan.

A second implementation — `ArSession` OBC component + `useArSession`/`ArViewerPanel` (hit-test/reticle, tap-to-place at real scale) — exists in the repo but is **dormant**: not imported by any route, kept for a possible later "real BIM model in AR at true 1:1 scale" step. Don't assume it's active. QR anchoring does **not** use it (the QR pose is the anchor, so no hit-test is needed).

## Key files

**Live path:**
- `src/routes/ar.$projectId.tsx` — standalone AR route (composition only)
- `src/react-components/features/ar-viewer/ArModelViewer.tsx` — the live AR viewer: three.js/WebXR session skeleton, model-group placement (`recenterAndScale` → base-centre at group origin), fallback placement, pinch-to-zoom, cloud-model picker + "Place on QR" overlay controls; drives the QR scan from its XR frame loop
- `src/react-components/features/ar-viewer/useArQrAnchor.ts` — in-session QR anchoring hook: reads the raw XR camera frame (via `XRWebGLBinding.getCameraImage`), decodes with `jsQR`, recovers pose via `qrPose`, composes with the XR camera world transform, returns a world position + upright yaw through an `applyAnchor` callback. Throttled decode; never throws into the render loop
- `src/react-components/features/ar-viewer/qrPose.ts` — **pure**, testable planar-pose solver (homography decomposition / "IPPE-lite"): 4 QR corners + camera intrinsics + known physical size → `THREE.Matrix4` in THREE camera space. No opencv.js
- `src/react-components/features/ar-viewer/useArModelLoader.ts` — isolated `.frag` loader (bare `OBC.Components` + `FragmentsManager`, not wired to any world/renderer) that hands back a `THREE.Object3D` for `ArModelViewer` to add to its scene

**Dormant path (kept, not wired in):**
- `src/bim-components/ArSession/src/ArSession.ts` — WebXR session OBC component (hit-test, reticle, tap-to-place at real scale)
- `src/bim-components/ArSession/index.ts` — component export/registration
- `src/react-components/features/ar-viewer/useArSession.ts` — session lifecycle hook for `ArSession`
- `src/react-components/features/ar-viewer/ArViewerPanel.tsx` — AR controls/panel UI for `ArSession`
- `src/react-components/features/ar-viewer/index.ts` — feature entry
- `src/react-components/views/ModelsView.tsx` — hosts the "AR" tab, which only navigates to `/ar/$projectId` (does not render `ArViewerPanel`)

## Patterns & conventions

- The standalone route stays composition-only; logic lives in `ArModelViewer.tsx` (orchestration/placement/gestures), `useArQrAnchor.ts` (sensing + anchor math), `qrPose.ts` (pure PnP), and `useArModelLoader.ts` (model decode).
- AR reuses the same fragments/model pipeline as the main viewer (`FragmentsManager`, same `/worker.mjs`) — don't fork model loading, even though the live path runs an isolated `OBC.Components` instance disconnected from any `World`.
- **Group structure**: an outer `modelGroup` owns placement (position + upright yaw) and pinch-zoom (scale about its origin); an inner content group holds all loaded models, offset by `recenterAndScale` so their **base-centre** sits at the outer origin. So zoom grows the model from its base, and anchoring plants that base on the QR. Manipulation is always the whole group, never per-model.
- **QR anchoring is position + yaw only, forced upright** — pitch/roll from the QR are discarded so the building never tilts, whether the code is table- or wall-mounted (mirrors the old turntable's "keep it upright" principle).
- The QR payload is **ignored** in v1 (any QR works); pose depends on a fixed printed size, `QR_PHYSICAL_SIZE_M` in `useArQrAnchor.ts` — keep it in sync with the actual codes you print. A lookup-key payload (→ per-anchor model/coords) is a deferred follow-up (see `CONTEXT.md`).
- If `ArSession` (dormant path) is ever revived, it follows the OBC component rules (disposable, dispose XR session + unbind events) — see `bim-viewer.md`.

## Gotchas / watch-outs

- WebXR requires a secure context (HTTPS) and an AR-capable device/browser — desktop dev will not enter XR. QR anchoring additionally needs **Raw Camera Access** (`camera-access`), which is **Android Chrome only** — no iOS (no WebXR at all), Quest support is variable.
- Ensure the XR session is disposed on unmount/route-leave to avoid a locked camera or leaked GL context. `useArQrAnchor`'s `dispose()` frees the readback FBO and `XRWebGLBinding`; the viewer calls it on `sessionend` and on unmount.
- QR anchoring has several **empirically-fragile seams that can only be verified on an Android device** — the camera-frame vertical flip (WebGL `readPixels` is bottom-left origin; we flip rows for jsQR), the intrinsics derived from `XRView.projectionMatrix` (principal point assumed centred), and the OpenCV→THREE coordinate conversion in `qrPose`. If the anchor lands rotated/offset/at the wrong depth, start here. `qrPose` rejects out-of-range depths (`0.05–20m`) so a degenerate solve keeps the model where it was rather than teleporting it.
- Decode is throttled (every Nth XR frame) and reads the full camera frame — do not decode every frame or the session framerate drops.
- The live path still has no true 1:1 scale (the miniature is anchored, not the real building). Don't reintroduce hit-test-based real-scale placement here without reading the dormant `ArSession` decision + the QR-anchor decision first (see `CONTEXT.md`).
