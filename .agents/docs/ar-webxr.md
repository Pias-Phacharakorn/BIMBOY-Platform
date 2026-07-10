# AR — WebXR model viewing

> Status: seed — expand as you work this area.

## Overview

AR renders the project's BIM model in WebXR. **Only one entry point is live**: the standalone `/ar/$projectId` route (`ModelsView`'s "AR" tab navigates here), a minimal full-screen page with its own single WebGL context (no OBC engine, no competing renderer). It does **not** attempt real-world (1:1) scale or hit-test placement — no coordinate/georeferencing snap exists for that yet — instead it auto-scales the loaded model(s) to fit ~1.5m and drops them fixed 2m in front of the camera, with one-finger drag-to-rotate (Y-axis turntable) as the only manual manipulation.

A second implementation — `ArSession` OBC component + `useArSession`/`ArViewerPanel` (hit-test/reticle, tap-to-place at real scale) — exists in the repo but is **dormant**: not imported by any route, kept for a possible later "real BIM model in AR at true scale" step once a coordinate/snap solution exists. Don't assume it's active.

## Key files

**Live path:**
- `src/routes/ar.$projectId.tsx` — standalone AR route (composition only)
- `src/react-components/features/ar-viewer/ArModelViewer.tsx` — the live AR viewer: three.js/WebXR session skeleton, model-group placement (`recenterAndScale`), drag-to-rotate, cloud-model picker overlay
- `src/react-components/features/ar-viewer/useArModelLoader.ts` — isolated `.frag` loader (bare `OBC.Components` + `FragmentsManager`, not wired to any world/renderer) that hands back a `THREE.Object3D` for `ArModelViewer` to add to its scene

**Dormant path (kept, not wired in):**
- `src/bim-components/ArSession/src/ArSession.ts` — WebXR session OBC component (hit-test, reticle, tap-to-place at real scale)
- `src/bim-components/ArSession/index.ts` — component export/registration
- `src/react-components/features/ar-viewer/useArSession.ts` — session lifecycle hook for `ArSession`
- `src/react-components/features/ar-viewer/ArViewerPanel.tsx` — AR controls/panel UI for `ArSession`
- `src/react-components/features/ar-viewer/index.ts` — feature entry
- `src/react-components/views/ModelsView.tsx` — hosts the "AR" tab, which only navigates to `/ar/$projectId` (does not render `ArViewerPanel`)

## Patterns & conventions

- The standalone route stays composition-only; all logic is in `ArModelViewer.tsx`/`useArModelLoader.ts`.
- AR reuses the same fragments/model pipeline as the main viewer (`FragmentsManager`, same `/worker.mjs`) — don't fork model loading, even though the live path runs an isolated `OBC.Components` instance disconnected from any `World`.
- Model manipulation is a turntable, not free-trackball: rotation is Y-axis only, applied to the whole accumulated `modelGroup` (all loaded models together), never per-model.
- If `ArSession` (dormant path) is ever revived, it follows the OBC component rules (disposable, dispose XR session + unbind events) — see `bim-viewer.md`.

## Gotchas / watch-outs

- WebXR requires a secure context (HTTPS) and an AR-capable device/browser — desktop dev will not enter XR.
- Ensure the XR session is disposed on unmount/route-leave to avoid a locked camera or leaked GL context.
- The live path has no coordinate system or real-world snap — placement is always a fixed offset in front of the camera, not tied to any physical anchor. Don't reintroduce hit-test-based real-scale placement here without reading the dormant `ArSession` decision first (see `CONTEXT.md`).
- _(fill as encountered)_
