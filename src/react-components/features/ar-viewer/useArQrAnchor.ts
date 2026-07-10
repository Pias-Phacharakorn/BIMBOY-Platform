// @ts-nocheck
// In-session QR anchoring for the live AR viewer. Reads the raw XR camera frame
// (WebXR Raw Camera Access — the `camera-access` feature ArModelViewer already
// requests), decodes a QR with jsQR, recovers its pose via qrPose, composes it
// with the XR camera's world transform, and hands the viewer a world position +
// upright yaw to pin the miniature to.
//
// Nothing here mutates the model directly — the viewer passes an `applyAnchor`
// callback so placement stays the viewer's concern (this hook is the sensing +
// math layer only, per the features/ layering rule).
//
// Everything camera-facing is best-effort and device-specific: on any failure
// we simply keep scanning (or stop quietly), never throw into the render loop —
// so a decode/readback problem degrades to "model stays where it was", never a
// broken session. Verify the fragile seams (Y-flip, intrinsics) on an Android
// Chrome device — desktop can't enter XR.
import { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import jsQR from "jsqr";
import {
  estimateQrPose,
  intrinsicsFromXrView,
  type QrCornerPoints,
} from "./qrPose";

// Physical printed size of the QR, edge length in metres. MUST match the codes
// you print. Placeholder until confirmed; documented in CONTEXT.md.
export const QR_PHYSICAL_SIZE_M = 0.15;

// Decode is expensive (full-frame readPixels + jsQR). Only attempt it every Nth
// XR frame so the session stays smooth while scanning.
const DECODE_EVERY_N_FRAMES = 8;

export type ArQrAnchorStatus = "idle" | "scanning" | "anchored";

export interface ArAnchor {
  position: THREE.Vector3;
  /** Yaw about world-up (radians), forced upright — no pitch/roll. */
  yaw: number;
}

export function useArQrAnchor() {
  const [status, setStatus] = useState<ArQrAnchorStatus>("idle");
  const statusRef = useRef<ArQrAnchorStatus>("idle");
  const scanningRef = useRef(false);
  const frameCountRef = useRef(0);

  // Reused GPU/CPU scratch so we don't allocate per frame.
  const bindingRef = useRef<any>(null);
  const fboRef = useRef<WebGLFramebuffer | null>(null);
  const pixelsRef = useRef<Uint8Array | null>(null);
  const flippedRef = useRef<Uint8ClampedArray | null>(null);

  const setBoth = (s: ArQrAnchorStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  /** Start (or restart) scanning for a QR to (re)anchor on. */
  const beginScan = useCallback(() => {
    scanningRef.current = true;
    setBoth("scanning");
  }, []);

  const stopScan = useCallback(() => {
    scanningRef.current = false;
  }, []);

  /**
   * Read the camera image for a view into a top-left-origin RGBA buffer, or
   * null if unavailable this frame.
   */
  const readCameraPixels = (
    gl: WebGL2RenderingContext,
    session: any,
    view: any
  ): { data: Uint8ClampedArray; width: number; height: number } | null => {
    const camera = view.camera;
    if (!camera) return null; // camera-access not granted / not this view

    if (!bindingRef.current) {
      bindingRef.current = new (window as any).XRWebGLBinding(session, gl);
    }
    const texture = bindingRef.current.getCameraImage(camera);
    if (!texture) return null;

    const width = camera.width;
    const height = camera.height;
    if (!width || !height) return null;

    if (!fboRef.current) fboRef.current = gl.createFramebuffer();
    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboRef.current);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const count = width * height * 4;
    if (!pixelsRef.current || pixelsRef.current.length !== count) {
      pixelsRef.current = new Uint8Array(count);
      flippedRef.current = new Uint8ClampedArray(count);
    }
    const pixels = pixelsRef.current;
    const flipped = flippedRef.current;

    let ok = true;
    try {
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    } catch {
      ok = false;
    }
    // Restore prior FBO binding so we never disturb three's rendering.
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
    if (!ok) return null;

    // readPixels is bottom-left origin; flip rows so jsQR (and our intrinsics)
    // see a natural top-left-origin image.
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * rowBytes;
      const dst = y * rowBytes;
      flipped.set(pixels.subarray(src, src + rowBytes), dst);
    }
    return { data: flipped, width, height };
  };

  /**
   * Drive one XR frame. Call from the viewer's animation loop. When a QR is
   * decoded and its pose recovered, invokes applyAnchor(anchor) once and stops
   * scanning. Cheap no-op when not scanning.
   */
  const processFrame = useCallback(
    (
      renderer: THREE.WebGLRenderer,
      frame: any,
      applyAnchor: (anchor: ArAnchor) => void
    ) => {
      if (!scanningRef.current || !frame) return;

      // Throttle.
      frameCountRef.current = (frameCountRef.current + 1) % DECODE_EVERY_N_FRAMES;
      if (frameCountRef.current !== 0) return;

      const session = frame.session;
      const refSpace = renderer.xr.getReferenceSpace();
      if (!session || !refSpace) return;

      const pose = frame.getViewerPose(refSpace);
      if (!pose || pose.views.length === 0) return;
      const view = pose.views[0];

      const gl = renderer.getContext() as WebGL2RenderingContext;
      const read = readCameraPixels(gl, session, view);
      if (!read) return;

      const result = jsQR(read.data, read.width, read.height);
      if (!result || !result.location) return;

      const loc = result.location;
      const corners: QrCornerPoints = {
        topLeft: loc.topLeftCorner,
        topRight: loc.topRightCorner,
        bottomRight: loc.bottomRightCorner,
        bottomLeft: loc.bottomLeftCorner,
      };

      const intrinsics = intrinsicsFromXrView(
        view.projectionMatrix,
        read.width,
        read.height
      );

      // QR pose in THREE camera space.
      const qrInCam = estimateQrPose(corners, intrinsics, QR_PHYSICAL_SIZE_M);
      if (!qrInCam) return; // degenerate — keep scanning

      // camera→world (view.transform.matrix maps view space to the reference
      // space, i.e. world), then QR→world.
      const cameraWorld = new THREE.Matrix4().fromArray(view.transform.matrix);
      // clone() — multiply() mutates in place, and we still need cameraWorld
      // untouched for the wall-mounted yaw fallback below.
      const qrWorld = cameraWorld.clone().multiply(qrInCam);

      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      qrWorld.decompose(position, quaternion, scale);

      // Forced-upright yaw: take the QR's local +Y (its "up" across the printed
      // face), project onto the horizontal plane, and read its heading. If the
      // code is near-vertical (wall-mounted) that projection is degenerate, so
      // fall back to facing the camera.
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      let yaw: number;
      if (Math.hypot(localUp.x, localUp.z) > 0.15) {
        yaw = Math.atan2(localUp.x, localUp.z);
      } else {
        const camPos = new THREE.Vector3().setFromMatrixPosition(cameraWorld);
        yaw = Math.atan2(camPos.x - position.x, camPos.z - position.z);
      }

      scanningRef.current = false;
      setBoth("anchored");
      applyAnchor({ position, yaw });
    },
    []
  );

  /** Release GL scratch. Call on session end / unmount. */
  const dispose = useCallback((renderer?: THREE.WebGLRenderer) => {
    scanningRef.current = false;
    try {
      if (fboRef.current && renderer) {
        (renderer.getContext() as WebGL2RenderingContext).deleteFramebuffer(
          fboRef.current
        );
      }
    } catch {
      // context already gone
    }
    fboRef.current = null;
    bindingRef.current = null;
    pixelsRef.current = null;
    flippedRef.current = null;
    setBoth("idle");
  }, []);

  return { status, beginScan, stopScan, processFrame, dispose };
}
