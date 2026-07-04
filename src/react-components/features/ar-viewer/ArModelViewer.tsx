// @ts-nocheck
// Renders a real BIM model in AR. Uses the proven single-WebGL-context,
// camera-access immersive-ar session skeleton; the user picks .frag model(s)
// from an in-AR dom-overlay ("Load Cloud Model"), which are decoded via the
// isolated useArModelLoader and dropped into the XR scene auto-centered +
// scaled-to-fit ~2 m in front. Milestone: model just appears (fixed placement;
// hit-test / 1:1 walk-around deferred).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { useProject } from "@/react-components/features/projects/useProjects";
import { useCloudModelFiles } from "@/react-components/features/cloud-models/useCloudModels";
import { useArModelLoader } from "./useArModelLoader";

interface ArModelViewerProps {
  projectId: string;
}

export function ArModelViewer({ projectId }: ArModelViewerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);

  const { loadFrag } = useArModelLoader();

  const { data: project } = useProject(projectId);
  const prefix = project ? `${project.projectnumber}_${project.projectName}/02_frag` : "";
  const { data: fragFiles = [], isLoading: isListing } = useCloudModelFiles(prefix, !!project);

  const [inSession, setInSession] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const sortedFiles = useMemo(
    () => [...fragFiles].sort((a, b) => a.name.localeCompare(b.name)),
    [fragFiles]
  );

  // ─── three.js + WebXR session setup (verbatim skeleton from ArWebXRTest) ──────
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
    scene.add(modelGroup);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    sceneRef.current = scene;
    cameraRef.current = camera;
    modelGroupRef.current = modelGroup;

    const sessionInit: any = {
      requiredFeatures: ["camera-access"],
      optionalFeatures: ["dom-overlay"],
    };
    if (overlay) sessionInit.domOverlay = { root: overlay };
    const arButton = ARButton.createButton(renderer, sessionInit);
    document.body.appendChild(arButton);

    const onSessionStart = () => setInSession(true);
    const onSessionEnd = () => setInSession(false);
    renderer.xr.addEventListener("sessionstart", onSessionStart);
    renderer.xr.addEventListener("sessionend", onSessionEnd);

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
      modelGroupRef.current = null;
    };
  }, []);

  // ─── Recenter + scale-to-fit the accumulated model group, place in front ──────
  const recenterAndScale = () => {
    const group = modelGroupRef.current;
    if (!group || group.children.length === 0) return;

    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    group.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    const targetSize = 1.5; // metres — miniature that fits comfortably in front
    const scale = targetSize / maxDim;
    group.scale.setScalar(scale);

    // Put the scaled model's centre at (0, 0, -2): ~2 m ahead, at eye height.
    group.position.set(-scale * center.x, -scale * center.y, -2 - scale * center.z);
  };

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleLoadSelected = async () => {
    if (!cameraRef.current || !modelGroupRef.current) return;
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
          modelGroupRef.current.add(object);
          setLoadedIds((prev) => new Set(prev).add(file.modelId));
        }
      } catch (err) {
        console.error(`AR: failed to load ${file.name}`, err);
        setStatus(`Failed: ${file.name}`);
      }
    }
    recenterAndScale();
    setStatus("");
    setIsLoading(false);
  };

  const hasSelection = sortedFiles.some(
    (f) => selected.has(f.name) && !loadedIds.has(f.modelId)
  );

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
            model to load.
          </div>
        </div>
      )}

      {/* dom-overlay root — the in-AR model picker */}
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
