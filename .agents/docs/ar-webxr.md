# AR — WebXR model viewing

> Status: seed — expand as you work this area.

## Overview

AR renders the project's BIM model in WebXR. **Only one entry point is live**: the standalone `/ar/$projectId` route (`ModelsView`'s "AR" tab navigates here), a minimal full-screen page with its own single WebGL context (no OBC engine, no competing renderer). It does **not** render at true 1:1 building scale — it auto-scales the loaded model(s) to fit a ~1.5m **miniature**. Placement is **recenter-in-front-of-you**: on load (and whenever the user taps **Recenter**) the model is dropped ~2m in front of the user's *current* camera, turned to face them (yaw only, forced upright), with pinch-zoom reset to the default fit. Manual manipulation is **pinch-to-zoom** (scales the whole model about its base); there is no rotate/pan.

Two other implementations exist in the repo but are **dormant** — not imported by any route, kept for future rounds. Don't assume either is active:

- **QR-code anchoring** (`useArQrAnchor` + `qrPose`) — pins the miniature onto a printed QR code (position + upright yaw) via WebXR Raw Camera Access. Built and documented but **never verified on-device**; put on ice in favour of the simpler recenter button. Kept for the future "pin to a fixed real-world spot / shared across users" use case (site-walk overlay). See `CONTEXT.md`.
- **`ArSession`** OBC component + `useArSession`/`ArViewerPanel` (hit-test/reticle, tap-to-place at real scale) — kept for a possible later "real BIM model in AR at true 1:1 scale" step.

## Key files

**Live path:**
- `src/routes/ar.$projectId.tsx` — standalone AR route (composition only)
- `src/react-components/features/ar-viewer/ArModelViewer.tsx` — the live AR viewer: three.js/WebXR session skeleton, model-group placement (`recenterAndScale` → base-centre at group origin; `recenter` → drop in front of the live camera facing the user, upright, zoom reset), pinch-to-zoom, cloud-model picker + "Recenter in front of me" overlay control. Session requests no raw camera access (nothing scans); XR frame loop just renders
- `src/react-components/features/ar-viewer/useArModelLoader.ts` — isolated `.frag` loader (bare `OBC.Components` + `FragmentsManager`, not wired to any world/renderer) that hands back a `THREE.Object3D` for `ArModelViewer` to add to its scene

**Dormant paths (kept, not wired in):**
- `src/react-components/features/ar-viewer/useArQrAnchor.ts` — in-session QR anchoring hook (raw XR camera frame via `XRWebGLBinding.getCameraImage` → `jsQR` → `qrPose` → world pose + upright yaw). Unimported; revive together with `camera-access` + `jsqr` when QR is picked up
- `src/react-components/features/ar-viewer/qrPose.ts` — **pure**, testable planar-pose solver (homography decomposition / "IPPE-lite"): 4 QR corners + camera intrinsics + known physical size → `THREE.Matrix4` in THREE camera space. No opencv.js
- `src/bim-components/ArSession/src/ArSession.ts` — WebXR session OBC component (hit-test, reticle, tap-to-place at real scale)
- `src/bim-components/ArSession/index.ts` — component export/registration
- `src/react-components/features/ar-viewer/useArSession.ts` — session lifecycle hook for `ArSession`
- `src/react-components/features/ar-viewer/ArViewerPanel.tsx` — AR controls/panel UI for `ArSession`
- `src/react-components/features/ar-viewer/index.ts` — feature entry
- `src/react-components/views/ModelsView.tsx` — hosts the "AR" tab, which only navigates to `/ar/$projectId` (does not render `ArViewerPanel`)

## Patterns & conventions

- The standalone route stays composition-only; logic lives in `ArModelViewer.tsx` (orchestration/placement/gestures) and `useArModelLoader.ts` (model decode). The dormant QR sensing/math lives in `useArQrAnchor.ts` (sensing) + `qrPose.ts` (pure PnP) for when it's revived.
- AR reuses the same fragments/model pipeline as the main viewer (`FragmentsManager`, same `/worker.mjs`) — don't fork model loading, even though the live path runs an isolated `OBC.Components` instance disconnected from any `World`.
- **Group structure**: an outer `modelGroup` owns placement (position + upright yaw) and pinch-zoom (scale about its origin); an inner content group holds all loaded models, offset by `recenterAndScale` so their **base-centre** sits at the outer origin. So zoom grows the model from its base, and recenter plants that base in front of the user. Manipulation is always the whole group, never per-model.
- **Placement is position + yaw only, forced upright** — recenter reads the live camera world pose, drops the model ahead of it, and yaws it to face the user; pitch/roll are never applied so the building never tilts. (The dormant QR path follows the same upright principle with the QR's own pose.)
- **Recenter also resets pinch-zoom** to the default fit, so it doubles as a "lost/over-zoomed the model → clean known state" escape hatch. Model load performs an implicit recenter (relative to the *current* pose, not the session-start origin).
- If a dormant path is revived, it follows the OBC component rules (disposable, dispose XR session + unbind events) — see `bim-viewer.md`. Reviving QR also means re-adding `camera-access` to the session `requiredFeatures` and re-wiring the scan into the frame loop; `QR_PHYSICAL_SIZE_M` in `useArQrAnchor.ts` must match the printed codes.

## Gotchas / watch-outs

- WebXR requires a secure context (HTTPS) and an AR-capable device/browser — desktop dev will not enter XR. AR here is **Android Chrome** in practice; iOS has no WebXR at all.
- **In an immersive-ar session the XR compositor governs render resolution, not `renderer.setPixelRatio()`/`setSize()`** — those apply only to the pre-session page. The lever for in-XR fill rate is `renderer.xr.setFramebufferScaleFactor()`. The live viewer renders at ~0.7× native + `antialias:false` to keep phones smooth (native scale is often 2.5–3.5×, which tanks framerate); this only softens the rendered model's edges, not the camera passthrough. Tune the factor on-device.
- The live `recenter` uses `renderer.xr.getCamera()` while presenting (falls back to the plain camera pre-session) — it reads the pose the last frame set, so it's current at button-tap time.
- Ensure the XR session is disposed on unmount/route-leave to avoid a locked camera or leaked GL context (`setAnimationLoop(null)`, `renderer.dispose()`, remove the AR button, drop refs).
- The live path has no true 1:1 scale (the miniature is placed, not the real building) and no real-world anchoring. Don't reintroduce hit-test real-scale placement or wire up QR without reading the dormant `ArSession` decision **and** the QR-anchor decisions first (see `CONTEXT.md` — QR was deliberately shelved after on-device testing).
- **Reviving QR:** its raw-camera pipeline has empirically-fragile seams that can only be verified on an Android device — the camera-frame vertical flip (`readPixels` is bottom-left origin; rows are flipped for jsQR), intrinsics from `XRView.projectionMatrix` (principal point assumed centred), and the OpenCV→THREE conversion in `qrPose`. `qrPose` rejects out-of-range depths (`0.05–20m`). Decode must stay throttled (every Nth frame) and/or downscaled — full-res decode every frame drops framerate.
