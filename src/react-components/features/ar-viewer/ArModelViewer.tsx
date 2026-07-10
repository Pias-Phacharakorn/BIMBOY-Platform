// @ts-nocheck
// Renders a real BIM model in AR. Uses the proven single-WebGL-context,
// camera-access immersive-ar session skeleton; the user picks .frag model(s)
// from an in-AR dom-overlay ("Load Cloud Model"), which are decoded via the
// isolated useArModelLoader and dropped into the XR scene auto-centered +
// scaled-to-fit ~1.5 m.
//
// Placement: the model loads at a fixed spot ~2 m in front (the fallback), then
// an in-session QR scan (useArQrAnchor, via the camera-access raw camera frame)
// snaps it onto a printed QR code — position + upright yaw. No QR found ⇒ it
// just stays in front. Manipulation is pinch-to-zoom (scales the whole model
// about its anchored base); the old drag-to-rotate turntable is gone.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { useProject } from "@/react-components/features/projects/useProjects";
import { useCloudModelFiles } from "@/react-components/features/cloud-models/useCloudModels";
import { useArModelLoader } from "./useArModelLoader";
import { useArQrAnchor } from "./useArQrAnchor";

interface ArModelViewerProps {
  projectId: string;
}

// Fallback placement (no QR anchored yet): base of the model, in metres,
// relative to the session's starting reference space (~eye height origin).
const FALLBACK_POSITION = new THREE.Vector3(0, -0.9, -2);
// Pinch-to-zoom scale clamp (multiplier on the auto-fit miniature size).
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;

export function ArModelViewer({ projectId }: ArModelViewerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // Outer group = placement (position + upright yaw) and pinch-zoom (scale about
  // its origin). Inner content group holds the loaded models, offset so their
  // base-centre sits at the outer origin — so zoom grows the model from its base
  // and anchoring plants that base on the QR.
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);

  const { loadFrag } = useArModelLoader();
  const { status: anchorStatus, beginScan, processFrame, dispose: disposeAnchor } =
    useArQrAnchor();

  const { data: project } = useProject(projectId);
  const prefix = project ? `${project.projectnumber}_${project.projectName}/02_frag` : "";
  const { data: fragFiles = [], isLoading: isListing } = useCloudModelFiles(prefix, !!project);

  const [inSession, setInSession] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  // "shown" fully opaque, "fading" transitioning to 0, "hidden" unmounted.
  const [hintPhase, setHintPhase] = useState<"shown" | "fading" | "hidden">("hidden");
  const [hintText, setHintText] = useState<string>("");

  // Refs read by the animation loop / pinch handlers without re-subscribing.
  const inSessionRef = useRef(false);
  const anchoredRef = useRef(false);
  const zoomRef = useRef(1);
  const processFrameRef = useRef(processFrame);
  const hintTimersRef = useRef<number[]>([]);

  // Pinch (two-pointer) gesture state.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);

  useEffect(() => {
    inSessionRef.current = inSession;
  }, [inSession]);

  // Keep the loop's view of processFrame current (it's bound once).
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  const sortedFiles = useMemo(
    () => [...fragFiles].sort((a, b) => a.name.localeCompare(b.name)),
    [fragFiles]
  );

  // ─── three.js + WebXR session setup ───────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      100
    );
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 3);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(1, 2, 1);
    scene.add(dirLight);

    const modelGroup = new THREE.Group();
    const contentGroup = new THREE.Group();
    modelGroup.add(contentGroup);
    modelGroup.position.copy(FALLBACK_POSITION);
    scene.add(modelGroup);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    modelGroupRef.current = modelGroup;
    contentGroupRef.current = contentGroup;

    const sessionInit: any = {
      requiredFeatures: ["camera-access"],
      optionalFeatures: ["dom-overlay"],
    };
    if (overlay) sessionInit.domOverlay = { root: overlay };
    const arButton = ARButton.createButton(renderer, sessionInit);
    document.body.appendChild(arButton);

    const onSessionStart = () => setInSession(true);
    const onSessionEnd = () => {
      setInSession(false);
      anchoredRef.current = false;
      disposeAnchor(renderer);
    };
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);

    // XR frame loop: drive the QR scan (throttled internally), then render.
    renderer.setAnimationLoop((_time, frame) => {
      if (frame) {
        processFrameRef.current(renderer, frame, applyAnchor);
      }
      renderer.render(scene, camera);
    });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.xr.removeEventListener("sessionstart", onSessionStart);
      renderer.xr.removeEventListener("sessionend", onSessionEnd);
      renderer.setAnimationLoop(null);
      disposeAnchor(renderer);
      arButton.remove();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      modelGroupRef.current = null;
      contentGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Pinch-to-zoom → scale the whole model about its anchored base ────────
  // Two-finger pinch only. Scaling the outer group (whose origin is the model's
  // base-centre) grows/shrinks the miniature from where it's pinned. One-finger
  // gestures do nothing (no free-trackball, no reposition-by-drag).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dist = () => {
      const pts = [...pointersRef.current.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!inSessionRef.current) return;
      const group = modelGroupRef.current;
      if (!group || contentGroupRef.current?.children.length === 0) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size === 2) {
        pinchStartDistRef.current = dist();
        pinchStartZoomRef.current = zoomRef.current;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointersRef.current.size !== 2 || pinchStartDistRef.current <= 0) return;
      const group = modelGroupRef.current;
      if (!group) return;
      const ratio = dist() / pinchStartDistRef.current;
      const next = THREE.MathUtils.clamp(
        pinchStartZoomRef.current * ratio,
        MIN_ZOOM,
        MAX_ZOOM
      );
      zoomRef.current = next;
      group.scale.setScalar(next);
    };
    const onPointerUp = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchStartDistRef.current = 0;
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  // Flash a transient hint, then fade it out.
  const flashHint = (text: string) => {
    hintTimersRef.current.forEach((id) => window.clearTimeout(id));
    hintTimersRef.current = [];
    setHintText(text);
    setHintPhase("shown");
    hintTimersRef.current.push(
      window.setTimeout(() => setHintPhase("fading"), 3000),
      window.setTimeout(() => setHintPhase("hidden"), 3800)
    );
  };

  useEffect(
    () => () => hintTimersRef.current.forEach((id) => window.clearTimeout(id)),
    []
  );

  // ─── Recenter + scale-to-fit the loaded content; base-centre at group origin ─
  const recenterAndScale = () => {
    const content = contentGroupRef.current;
    if (!content || content.children.length === 0) return;

    content.position.set(0, 0, 0);
    content.scale.setScalar(1);
    content.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(content);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const targetSize = 1.5; // metres — miniature that fits comfortably in front
    const scale = targetSize / maxDim;
    content.scale.setScalar(scale);

    // Base-centre (x/z centre, y minimum) to the outer group's origin, so the
    // model sits on whatever the group origin is placed at, and pinch-zoom grows
    // it up from its base.
    content.position.set(-scale * center.x, -scale * box.min.y, -scale * center.z);
  };

  // Apply the current placement (anchor if we have one, else the fallback).
  const applyFallbackPlacement = () => {
    const group = modelGroupRef.current;
    if (!group) return;
    group.position.copy(FALLBACK_POSITION);
    group.rotation.set(0, 0, 0);
  };

  // Called by the anchor hook when a QR is decoded: pin base at the QR, upright.
  const applyAnchor = (anchor: { position: THREE.Vector3; yaw: number }) => {
    const group = modelGroupRef.current;
    if (!group) return;
    anchoredRef.current = true;
    group.position.copy(anchor.position);
    group.rotation.set(0, anchor.yaw, 0);
    flashHint("✓ Placed on QR — pinch to zoom");
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleLoadSelected = async () => {
    if (!cameraRef.current || !contentGroupRef.current) return;
    const toLoad = sortedFiles.filter(
      (f) => selected.has(f.name) && !loadedIds.has(f.modelId)
    );
    if (toLoad.length === 0) return;

    setIsLoading(true);
    for (const file of toLoad) {
      try {
        setStatus(`Loading ${file.name}…`);
        const object = await loadFrag(prefix, file.name, file.modelId, cameraRef.current);
        if (object) {
          contentGroupRef.current.add(object);
          setLoadedIds((prev) => new Set(prev).add(file.modelId));
        }
      } catch (err) {
        console.error(`AR: failed to load ${file.name}`, err);
        setStatus(`Failed: ${file.name}`);
      }
    }
    recenterAndScale();
    if (!anchoredRef.current) applyFallbackPlacement();
    beginScan();
    flashHint("Point at a QR code to place it");
    setStatus("");
    setIsLoading(false);
  };

  const handleReposition = () => {
    beginScan();
    flashHint("Point at a QR code to place it");
  };

  const hasSelection = sortedFiles.some(
    (f) => selected.has(f.name) && !loadedIds.has(f.modelId)
  );
  const hasModel = loadedIds.size > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Back button — visible pre-session over the black page */}
      {!inSession && (
        <button
          type="button"
          onClick={() => router.history.back()}
          style={backBtnStyle}
        >
          ← Back
        </button>
      )}

      {/* Pre-AR instruction over the black landing page */}
      {!inSession && (
        <div style={introStyle}>
          <div style={{ fontSize: 22 }}>📷</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>View this model in AR</div>
          <div style={{ opacity: 0.75, fontSize: 13, maxWidth: 260 }}>
            Tap <strong>START AR</strong> below to open the camera, then choose a
            model to load and point at a QR code to place it.
          </div>
        </div>
      )}

      {/* Transient hint — non-interactive so it never eats a gesture. */}
      {hintPhase !== "hidden" && (
        <div
          style={{
            ...rotateHintStyle,
            opacity: hintPhase === "shown" ? 1 : 0,
          }}
        >
          {hintText}
        </div>
      )}

      {/* dom-overlay root — the in-AR model picker + reposition control */}
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {inSession && (
          <div style={pickerStyle}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>☁ Load Cloud Model</div>
            {isListing ? (
              <div style={{ opacity: 0.7 }}>Loading model list…</div>
            ) : sortedFiles.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No .frag models in this project.</div>
            ) : (
              <div style={{ maxHeight: "40vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {sortedFiles.map((f) => {
                  const isLoaded = loadedIds.has(f.modelId);
                  const isChecked = selected.has(f.name);
                  return (
                    <label
                      key={f.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: isChecked ? "rgba(80,160,255,0.18)" : "rgba(255,255,255,0.06)",
                        opacity: isLoaded ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked || isLoaded}
                        disabled={isLoaded}
                        onChange={() => toggle(f.name)}
                      />
                      <span style={{ fontSize: 13 }}>
                        {f.name.replace(/\.frag$/i, "")}
                        {isLoaded ? " ✓" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={!hasSelection || isLoading}
              onClick={handleLoadSelected}
              style={{
                ...loadBtnStyle,
                opacity: !hasSelection || isLoading ? 0.5 : 1,
              }}
            >
              {isLoading ? status || "Loading…" : "Load Cloud Model"}
            </button>

            {hasModel && (
              <button
                type="button"
                onClick={handleReposition}
                style={repositionBtnStyle}
              >
                {anchorStatus === "scanning"
                  ? "⟳ Scanning for QR…"
                  : anchorStatus === "anchored"
                  ? "⟳ Reposition on QR"
                  : "⟳ Place on QR code"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  zIndex: 10,
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  font: "600 13px system-ui, sans-serif",
  cursor: "pointer",
};

const introStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  textAlign: "center",
  color: "#fff",
  font: "400 14px system-ui, sans-serif",
  padding: 24,
};

const rotateHintStyle: React.CSSProperties = {
  position: "absolute",
  top: 24,
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 10,
  padding: "8px 16px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  font: "600 13px system-ui, sans-serif",
  pointerEvents: "none",
  transition: "opacity 0.8s ease",
};

const pickerStyle: React.CSSProperties = {
  position: "absolute",
  left: 12,
  right: 12,
  bottom: 12,
  padding: 12,
  borderRadius: 12,
  background: "rgba(15,16,20,0.88)",
  color: "#fff",
  font: "400 13px system-ui, sans-serif",
  pointerEvents: "auto",
  backdropFilter: "blur(6px)",
};

const loadBtnStyle: React.CSSProperties = {
  marginTop: 10,
  width: "100%",
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  background: "#3b82f6",
  color: "#fff",
  font: "700 14px system-ui, sans-serif",
  cursor: "pointer",
};

const repositionBtnStyle: React.CSSProperties = {
  marginTop: 8,
  width: "100%",
  padding: "9px 16px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  font: "600 13px system-ui, sans-serif",
  cursor: "pointer",
};
