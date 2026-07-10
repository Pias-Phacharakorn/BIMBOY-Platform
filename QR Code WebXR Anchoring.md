---
type: concept
tags: [webxr, threejs, ar, qr-code, computer-vision, web-development]
last_updated: 2026-07-10
sources:
  - "[[QR Code WebXR Anchoring — NotebookLM Research]]"
---

## Overview

There is no native WebXR image/marker-tracking feature. QR-code-based real-world anchoring is a **userland technique**: decode a QR code from a 2D camera frame, run pose estimation (PnP) to get a 3D transform relative to the camera, and apply that transform to a WebXR `XRReferenceSpace` via `getOffsetReferenceSpace()`. WebXR's `XRAnchor` API only *records* a position to fight drift — it never *finds* the position for you.

This page is written for BIM-BOY's actual stack: plain three.js **r0.182**, native WebXR via `ARButton` (no react-three-fiber, no AR.js/8th Wall/MindAR), with an existing dormant `ArSession.ts` that already does hit-test + reticle + tap-to-place at 1:1 scale. Model loading once anchored is already implemented and out of scope here.

## Open Decision: Which AR Pipeline Does This Attach To?

**This is unresolved and must be decided before implementation starts — do not assume either path.**

A scrutinize review of the codebase found a routing mismatch that the rest of this page does not account for:

1. The pipeline described below (scan → PnP → offset reference space → hit-test) is written assuming integration into `ArSession.ts`'s existing hit-test/reticle/tap-to-place logic. But `ArSession.ts` is **dormant and not wired into any live route** — confirmed by reading `ModelsView.tsx:13-14` and the app's actual AR route table.
2. The route users actually reach, `/ar/$projectId` → `ArModelViewer.tsx`, has **no hit-test or reticle logic at all**. It does fixed placement only, and its own header comment states that "hit-test / 1:1 walk-around" is deferred.
3. That leaves two options, and this page does not pick one:
   - **(a) Revive `ArSession.ts`** — wire it onto a real route, then build QR-anchoring against its existing hit-test/reticle flow (i.e. the pipeline as written below).
   - **(b) Port/build hit-test logic into `ArModelViewer.tsx` first**, then add QR-anchoring on top of that, since it's the pipeline actually live in production.
4. Whoever implements this needs to make that call explicitly (with whoever owns BIM-BOY's AR roadmap) before writing code — the pipeline below is only directly applicable as-is under option (a).

## Recommended Approach for BIM-BOY

**Scan before entering the immersive-ar session, using `getUserMedia` + `jsQR`, then feed the resulting offset transform into the existing hit-test/reference-space flow in `ArSession.ts`.**

Why, concretely:
- On today's headsets/browsers (Quest Browser, Chrome/Edge Android), entering `immersive-ar` typically gives the session exclusive control of the camera — a `getUserMedia()` stream started *during* the session will generally fail or return nothing. The one documented in-session alternative (`WebXRCameraBackground`, mentioned on the Needle forum) is thin/experimental — do not build a shipping feature on it without a fallback.
- **jsQR** over zxing-js/html5-qrcode/qr-scanner because it is decoder-only: you pass it raw pixel data (a canvas frame) and get back the corner pixel coordinates, with no camera UI or scan-loop of its own. That matters here because you need to manually own the camera lifecycle (open it, scan, stop it, then hand the camera to WebXR) — full-stack libraries manage their own camera/permission/worker lifecycle and would fight that handoff. Avoid `qrcode-reader` (unmaintained).
- QR over ARUCO: QR is the right call if you want the code to carry a payload (see below) or if end users are expected to print/scan an ordinary QR code with a phone/generic printer. If you only need the most robust possible pose tracking and don't care about payload, ARUCO markers are more failure-resistant to motion blur/low focus and have first-class OpenCV support — worth keeping as a fallback option if QR proves flaky in the field.

## Implementation Pipeline (concrete)

### 1. Get camera frames for QR decoding (before AR session)

```js
// Runs on the normal 2D page, BEFORE the user taps "Enter AR"
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment' }
});
videoEl.srcObject = stream;
await videoEl.play();

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function scanLoop() {
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const qr = jsQR(imageData.data, imageData.width, imageData.height);
  if (qr) {
    onQRDetected(qr); // qr.location gives the 4 corner points; qr.data is the payload
    stream.getTracks().forEach(t => t.stop()); // release camera before entering AR
    return;
  }
  requestAnimationFrame(scanLoop);
}
scanLoop();
```

Gotcha (flagged as an explicit gap in the research — sources didn't cover this at code level): there's no documented guarantee on exact release timing between `track.stop()` completing and the camera being free for the subsequent `immersive-ar` session to claim it. Build in a defensive delay/retry (e.g. wait for the `stop()` to resolve, then a short buffer) before calling `ARButton`'s session request, and test on-device — this is exactly the kind of platform-specific timing issue that only shows up empirically.

### 2. Decode QR corners into a real-world pose (PnP)

`jsQR`'s result gives you the four corner points in 2D pixel space (`qr.location.topLeftCorner`, etc.). To get a 3D pose you need Perspective-n-Point:

- You need the camera's intrinsic parameters (focal length, optical center) — either read from device metadata where available, or use a reasonable calibrated approximation.
- Feed the 4 known 2D corners + the QR's known real-world physical size into a PnP solver (e.g. OpenCV.js `solvePnP`, or a JS port of the P4P algorithm) to get a rotation matrix `R` and translation vector `t` describing the camera's pose relative to the QR code.
- Reference implementation for the corner-to-pose math (Python, but the CV logic ports directly): `TemugeB/QR_code_orientation_OpenCV` (cited by the research session).

**Gap flagged by the research**: no source in this session provided ready-made JS/three.js PnP code — only the OpenCV/Python reference and the general math. Plan to either pull in `opencv.js` for `solvePnP`, or find/port a lightweight JS PnP implementation; this is real implementation work, not copy-paste.

### 3. Convert the pose into a WebXR reference-space offset

**Timing clarification**: the offset can only be applied *after* `renderer.xr.setSession(session)` has succeeded and *before* the hit-test source/loop starts — not before session entry. In `ArSession.ts` the base reference space is negotiated at session-start (around line 167), and the hit-test source is requested shortly after (around lines 172-175); the offset-space swap has to land in the gap between those two lines, or hit-test will run against the wrong (un-anchored) reference space.

```js
// R, t come out of your PnP step, converted to a three.js Matrix4
const m = new THREE.Matrix4().fromArray(poseMatrixColumnMajor); // R + t combined
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
m.decompose(position, quaternion, scale);

// Once the immersive-ar session has started and you have the base reference space:
const rigidTransform = new XRRigidTransform(
  { x: position.x, y: position.y, z: position.z },
  { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
);

const offsetReferenceSpace = baseReferenceSpace.getOffsetReferenceSpace(rigidTransform);
renderer.xr.setReferenceSpace(offsetReferenceSpace);
```

`XRReferenceSpace` objects are immutable — you never mutate the base space, you derive a new offset space and hand it to three.js's `WebXRManager` (`renderer.xr.setReferenceSpace(...)`). Because `ArSession.ts`'s existing hit-test/reticle/tap-to-place logic reads from whatever reference space is active, once you swap in the offset space, that existing code should keep working unchanged — hit-test results will now come back relative to the QR-defined origin instead of the session's default origin. This is the concrete integration point with the existing dormant hit-test code: do the QR scan and offset-space swap *before* wiring up/enabling the hit-test loop, so hit-test never runs against the un-anchored default space.

Known coordinate-frame gotcha: a developer-forum source reports the `immersive-ar` session's starting orientation frequently does **not** match the pre-session `getUserMedia` camera's orientation (observed mismatches around 180° or 90°) — don't assume the two frames are already aligned; the whole point of computing and applying the offset transform is to correct for this, but budget time to empirically verify the correction on-device rather than trusting the math sight-unseen.

## What the QR Code Should Encode

Two patterns exist in the source material, without the sources directly weighing tradeoffs between them (flagged as a research gap):

- **Direct embedded coordinates**: the QR payload itself contains the real-world reference point definition (e.g. known physical marker size, and/or absolute project coordinates). Self-contained — no external lookup needed — but the printed code is tied to that specific location and can't be silently repointed.
- **Lookup key**: the QR payload is just an ID; your app looks up the actual anchor definition (position, orientation convention, associated model) from a server/config. Keeps the QR code simpler (fewer characters, easier to scan reliably) and lets you update the anchor data without reprinting the physical code — likely the better fit for a BIM tool where project coordinates may be revised.

Recommendation for BIM-BOY: prefer the lookup-key pattern (short ID → server-side anchor record), since project/model coordinate systems in BIM workflows are the kind of thing that gets revised, and reprinting physical QR codes on-site is not something you want to depend on.

## Pitfalls / Gotchas Specific to This Combination

- **Camera resource contention**: `getUserMedia` and `immersive-ar` generally cannot both hold the camera at once on current headsets/browsers. Scan-then-enter-AR is the only pattern with solid grounding from this research; treat in-session camera access (`WebXRCameraBackground` or the draft Raw Camera Access Module) as experimental/unreliable, not a foundation to build on yet.
- **Permission prompts**: it is not documented whether granting `getUserMedia` camera permission also satisfies WebXR's own camera permission for the AR session, or whether the user gets double-prompted. Test this explicitly on target devices (Quest Browser, Chrome Android) and design the UX to tolerate a possible second prompt.
- **iOS Safari**: has no WebXR Device API support at all (confirmed via MDN, consistent with the existing [[Three.js Web AR]] findings). This entire approach is Android/Quest-only. If iOS support is required, the sources point only to paid ARKit-bridging services or fully-userland WebGL/WebRTC engines like `open-webar-sdk` (which sidesteps native WebXR entirely and has its own dedicated QR-anchored tracking mode worth evaluating as an alternative architecture, not just a fallback).
- **Motion blur / focus sensitivity**: QR corner detection (and therefore PnP accuracy) degrades under camera motion or poor focus more than ARUCO markers would. If field reliability becomes an issue, ARUCO is the documented fallback.

## Open-Source References Worth Pulling Up Directly

- `WebAR-Studio/open-webar-sdk` — lightweight open-source WebAR engine with an explicit QR-anchored tracking mode (alternative to AR.js/MindAR); also notable as an iOS-Safari-capable path since it avoids native WebXR.
- `YulesRules/WebXR_Marker_Hacks` — GitHub repo cited by WebXR developers specifically for hacking marker tracking into standard WebXR apps.
- `TemugeB/QR_code_orientation_OpenCV` — Python/OpenCV reference implementation for the 2D-corners-to-3D-pose math; port the logic, not the language.
- MDN `XRReferenceSpace` docs and the `getOffsetReferenceSpace()` method — canonical reference for the offset-space mechanism used above.

## Explicit Research Gaps (not covered by NotebookLM's sources — verify empirically)

- Exact camera release/handoff timing between stopping a `getUserMedia` track and successfully starting an `immersive-ar` session on the same hardware.
- Whether `getUserMedia` camera permission grants carry over to WebXR's own permission flow, or double-prompt.
- No ready-made JS/three.js PnP (`solvePnP`) code was found — only Python/OpenCV reference logic and the general math; this needs real implementation work (e.g. via `opencv.js` or a ported PnP routine).
- No concrete JSON payload schema for the QR code was found in sources; the lookup-key vs. direct-coordinate tradeoff discussion above is partly general engineering reasoning, not a grounded citation.

## Related

- [[Three.js Web AR]] — general WebXR/three.js API surface and platform limitations (iOS/Vision Pro gaps carry over directly to this topic).
- [[NotebookLM]] — research tool used for this session.
