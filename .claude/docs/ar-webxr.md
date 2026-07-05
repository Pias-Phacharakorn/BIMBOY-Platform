# AR — WebXR model viewing

> Status: seed — expand as you work this area.

## Overview

AR renders the project's BIM model in WebXR. Two entry points: a WebXR tab inside `ModelsView`, and a standalone `/ar/$projectId` route (a minimal page meant to be opened on an AR-capable device). The XR session is managed by the `ArSession` OBC component; the React `ar-viewer` feature owns session lifecycle, model loading, and the panel UI.

## Key files

- `src/bim-components/ArSession/src/ArSession.ts` — WebXR session OBC component (enter/exit XR, session state)
- `src/bim-components/ArSession/index.ts` — component export/registration
- `src/routes/ar.$projectId.tsx` — standalone AR route (composition only)
- `src/react-components/features/ar-viewer/ArModelViewer.tsx` — top-level AR viewer
- `src/react-components/features/ar-viewer/ArViewerPanel.tsx` — AR controls/panel UI
- `src/react-components/features/ar-viewer/useArSession.ts` — session lifecycle hook
- `src/react-components/features/ar-viewer/useArModelLoader.ts` — loads the BIM model into the AR scene
- `src/react-components/features/ar-viewer/index.ts` — feature entry
- `src/react-components/views/ModelsView.tsx` — hosts the WebXR AR tab

## Patterns & conventions

- `ArSession` follows the OBC component rules (disposable, dispose XR session + unbind events) — see `bim-viewer.md`.
- The standalone route stays composition-only; all logic is in the `ar-viewer` feature.
- AR reuses the same fragments/model pipeline as the main viewer — don't fork model loading.

## Gotchas / watch-outs

- WebXR requires a secure context (HTTPS) and an AR-capable device/browser — desktop dev will not enter XR.
- Ensure the XR session is disposed on unmount/route-leave to avoid a locked camera or leaked GL context.
- _(fill as encountered)_
