// @ts-nocheck
// Renders a real BIM model in AR. Single-WebGL-context immersive-ar session;
// the user picks .frag model(s) from an in-AR dom-overlay ("Load Cloud Model"),
// which are decoded via the isolated useArModelLoader and dropped into the XR
// scene auto-centered + scaled-to-fit ~1.5 m.
//
// Placement: on load (and whenever the user taps "Recenter") the model is
// dropped ~2 m in front of the user's current camera, turned to face them
// (yaw only, forced upright), with pinch-zoom reset to the default fit.
// Manipulation is pinch-to-zoom (scales the whole model about its base).
//
// QR-code real-world anchoring (useArQrAnchor / qrPose) is DORMANT — kept in
// the tree, unimported, for a future "pin to a fixed physical spot" round,
// mirroring the dormant ArSession.ts. See CONTEXT.md.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { useProject } from "@/react-components/features/projects/useProjects";
import { useCloudModelFiles } from "@/react-components/features/cloud-models/useCloudModels";
import { cn } from "@/lib/utils";
import { useArModelLoader } from "./useArModelLoader";

interface ArModelViewerProps {
  projectId: string;
}

// Where a recenter drops the model relative to the user's current camera:
// DISTANCE metres straight ahead (horizontally), DROP metres below eye height
// so it sits on an imaginary floor rather than floating at eye level.
const RECENTER_DISTANCE_M = 2;
const RECENTER_DROP_M = 0.9;
// Initial group placement before the first model loads (session-start
// relative). Once a model loads, recenter() takes over relative to the live
// camera, so this is only ever the pre-load resting spot of an empty group.
const INITIAL_POSITION = new THREE.Vector3(0, -0.9, -2);
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
  // and recenter plants that base in front of the user.
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);

  const { loadFrag } = useArModelLoader();

  const { data: project } = useProject(projectId);
  const prefix = project ? `${project.projectnumber}_${project.projectName}/02_frag` : "";
  const { data: fragFiles = [], isLoading: isListing } = useCloudModelFiles(prefix, !!project);

  const [inSession, setInSession] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  // "Load Model" opens a slide-up sheet holding the file list.
  const [sheetOpen, setSheetOpen] = useState(false);
  // AR-model opacity, 0–100 (%). 100 = fully solid. The real-world camera
  // passthrough can't be dimmed in immersive-ar, so this affects the model only.
  const [opacity, setOpacity] = useState(100);

  // "shown" fully opaque, "fading" transitioning to 0, "hidden" unmounted.
  const [hintPhase, setHintPhase] = useState<"shown" | "fading" | "hidden">("hidden");
  const [hintText, setHintText] = useState<string>("");

  // Refs read by the animation loop / pinch handlers without re-subscribing.
  const inSessionRef = useRef(false);
  const zoomRef = useRef(1);
  const hintTimersRef = useRef<number[]>([]);
  // Persisted opacity (0–100) so newly loaded models inherit the current value.
  const opacityRef = useRef(100);

  // Pinch (two-pointer) gesture state.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);

  useEffect(() => {
    inSessionRef.current = inSession;
  }, [inSession]);

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
    modelGroup.position.copy(INITIAL_POSITION);
    scene.add(modelGroup);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    // In an immersive-ar session the XR compositor governs render resolution
    // (not setPixelRatio/setSize), defaulting to the device's native scale —
    // often 2.5-3.5x on a phone, which tanks fill rate. Render the 3D layer at
    // ~0.7x native so the session stays smooth; only the model's edges soften,
    // the camera passthrough is unaffected. Tune on-device.
    renderer.xr.setFramebufferScaleFactor(0.7);
    container.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    modelGroupRef.current = modelGroup;
    contentGroupRef.current = contentGroup;

    // No raw camera-access required anymore — nothing scans the frame. (QR
    // anchoring, which needed it, is dormant.) dom-overlay stays for the picker.
    const sessionInit: any = {
      optionalFeatures: ["dom-overlay"],
    };
    if (overlay) sessionInit.domOverlay = { root: overlay };
    const arButton = ARButton.createButton(renderer, sessionInit);
    document.body.appendChild(arButton);

    const onSessionStart = () => setInSession(true);
    const onSessionEnd = () => setInSession(false);
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);

    // XR frame loop: just render. (No per-frame scanning anymore.)
    renderer.setAnimationLoop(() => {
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

  // ─── Pinch-to-zoom → scale the whole model about its base ─────────────────
  // Two-finger pinch only. Scaling the outer group (whose origin is the model's
  // base-centre) grows/shrinks the miniature from where it's planted. One-finger
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

  // Recenter: one-shot drop of the model in front of the user's *current*
  // camera, turned to face them (yaw only, forced upright), with pinch-zoom
  // reset to the default fit. Also used as the implicit placement on load.
  const recenter = () => {
    const group = modelGroupRef.current;
    const renderer = rendererRef.current;
    if (!group || !renderer) return;

    // Reset zoom so recenter always yields a clean, known size.
    zoomRef.current = 1;
    group.scale.setScalar(1);

    // Current camera world pose (the live XR camera while presenting).
    const cam = renderer.xr.isPresenting
      ? renderer.xr.getCamera()
      : cameraRef.current;
    if (!cam) return;
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    cam.getWorldPosition(camPos);
    cam.getWorldQuaternion(camQuat);

    // Horizontal forward (camera looks down -z), flattened so the model never
    // drops above/below the user when they're looking up or down.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQuat);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();

    group.position.copy(camPos).addScaledVector(forward, RECENTER_DISTANCE_M);
    group.position.y = camPos.y - RECENTER_DROP_M;

    // Face me: rotate so the model's local front (-Z) turns back toward the
    // camera. Upright — yaw about world-up only, never pitch/roll.
    group.rotation.set(0, Math.atan2(forward.x, forward.z), 0);
  };

  // Apply AR-model opacity (0–100) to every mesh in the loaded content. At 100%
  // we restore opaque rendering (transparent=false, depthWrite=true) to avoid
  // depth-sort artifacts; at 0% the meshes are hidden outright. In between, the
  // model renders as a translucent ghost over the live camera.
  const applyOpacity = (pct: number) => {
    const content = contentGroupRef.current;
    if (!content) return;
    const o = THREE.MathUtils.clamp(pct, 0, 100) / 100;
    content.traverse((child: any) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m: any) => {
        if (!m) return;
        m.transparent = o < 1;
        m.opacity = o;
        m.depthWrite = o >= 1;
        m.needsUpdate = true;
      });
      child.visible = o > 0;
    });
  };

  const handleOpacity = (pct: number) => {
    setOpacity(pct);
    opacityRef.current = pct;
    applyOpacity(pct);
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
    recenter();
    // Newly loaded models inherit the current opacity (persistent view setting).
    applyOpacity(opacityRef.current);
    setSheetOpen(false);
    flashHint("Pinch to zoom · tap Recenter to bring it back");
    setStatus("");
    setIsLoading(false);
  };

  const handleRecenter = () => {
    recenter();
    flashHint("Recentered · pinch to zoom");
  };

  const selectedCount = sortedFiles.filter(
    (f) => selected.has(f.name) && !loadedIds.has(f.modelId)
  ).length;
  const hasSelection = selectedCount > 0;
  const hasModel = loadedIds.size > 0;

  // Glass control shared look (pill button over the camera passthrough).
  const glassBtn =
    "pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 font-semibold text-white shadow-xl backdrop-blur-md transition active:scale-95 disabled:opacity-50";

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Back button — visible pre-session over the black page */}
      {!inSession && (
        <button
          type="button"
          onClick={() => router.history.back()}
          className={cn(glassBtn, "absolute left-4 top-4 z-10 text-[13px]")}
        >
          ← Back
        </button>
      )}

      {/* Pre-AR instruction over the black landing page */}
      {!inSession && (
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 p-6 text-center text-white">
          <div className="text-2xl">📷</div>
          <div className="text-base font-bold">View this model in AR</div>
          <div className="max-w-[260px] text-[13px] opacity-75">
            Tap <strong>START AR</strong> below to open the camera, then choose a
            model to load. It appears in front of you — pinch to zoom, drag the
            opacity slider to ghost it, or tap Recenter to bring it back.
          </div>
        </div>
      )}

      {/* Transient hint — non-interactive so it never eats a gesture. */}
      {hintPhase !== "hidden" && (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-md transition-opacity duration-700",
            hintPhase === "shown" ? "opacity-100" : "opacity-0"
          )}
        >
          {hintText}
        </div>
      )}

      {/* dom-overlay root — the 3 in-AR controls (Load / Recenter / opacity) */}
      <div ref={overlayRef} className="pointer-events-none absolute inset-0">
        {inSession && (
          <>
            {/* (3) Vertical opacity slider — AR model only, appears with a model */}
            {hasModel && (
              <div className="pointer-events-auto absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-2 rounded-2xl border border-white/15 bg-black/40 px-2 py-3 shadow-2xl backdrop-blur-md">
                <span className="font-mono text-[10px] font-semibold text-white/85">
                  {opacity}%
                </span>
                <div className="relative flex h-40 w-6 items-center justify-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={opacity}
                    onChange={(e) => handleOpacity(Number(e.target.value))}
                    className="ar-opacity-slider -rotate-90"
                    aria-label="AR model opacity"
                  />
                </div>
                <span className="text-sm leading-none">🧊</span>
              </div>
            )}

            {/* (1)+(2) Bottom control bar: Load Model, Recenter */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 p-4">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={cn(glassBtn, "text-[14px]")}
              >
                📁 Load Model
              </button>
              {hasModel && (
                <button
                  type="button"
                  onClick={handleRecenter}
                  className={cn(glassBtn, "text-[14px]")}
                >
                  ⟳ Recenter
                </button>
              )}
            </div>

            {/* (1) Slide-up sheet with the multi-select .frag list */}
            {sheetOpen && (
              <button
                type="button"
                aria-label="Close model list"
                onClick={() => setSheetOpen(false)}
                className="pointer-events-auto absolute inset-0 z-30 bg-black/40"
              />
            )}
            <div
              className={cn(
                "pointer-events-auto absolute inset-x-0 bottom-0 z-40 mx-auto max-w-md rounded-t-2xl border border-white/15 bg-black/70 p-4 text-white shadow-2xl backdrop-blur-md transition-transform duration-300",
                sheetOpen ? "translate-y-0" : "translate-y-full"
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="font-bold">☁ Load Cloud Model</div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="p-1 text-lg text-white/70 transition hover:text-white"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {isListing ? (
                <div className="opacity-70">Loading model list…</div>
              ) : sortedFiles.length === 0 ? (
                <div className="opacity-70">No .frag models in this project.</div>
              ) : (
                <div className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
                  {sortedFiles.map((f) => {
                    const isLoaded = loadedIds.has(f.modelId);
                    const isChecked = selected.has(f.name);
                    return (
                      <label
                        key={f.name}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5",
                          isChecked ? "bg-accent/20" : "bg-white/5",
                          isLoaded && "opacity-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked || isLoaded}
                          disabled={isLoaded}
                          onChange={() => toggle(f.name)}
                        />
                        <span className="text-[13px]">
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
                className="mt-3 w-full rounded-lg bg-accent px-4 py-2.5 text-[14px] font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                {isLoading
                  ? status || "Loading…"
                  : hasSelection
                    ? `Load ${selectedCount} model${selectedCount > 1 ? "s" : ""}`
                    : "Load Cloud Model"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
