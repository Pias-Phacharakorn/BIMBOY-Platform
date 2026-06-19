import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, Building2, Save, RotateCcw, Pencil, Compass, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RittaProject } from "@/types/project";
import type { CesiumContext } from "./CesiumViewer";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { updateProjectModelPose } from "@/lib/projects.functions";
import { toast } from "sonner";

interface BimGeoOverlayProps {
  project: RittaProject;
  cesiumCtx: CesiumContext | null;
  onClose: () => void;
  canEdit?: boolean;
  onPoseSaved?: (pose: PoseState) => void;
}

export interface PoseState {
  lat: number;
  lng: number;
  elevation: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

/**
 * Georeferenced BIM overlay (Option 2a).
 *
 * Mounts a transparent THREE.js canvas above Cesium's WebGL canvas and
 * synchronises the THREE camera with Cesium's camera every `preRender`
 * tick. The fragment model is anchored to the project's real-world
 * coordinates via an East-North-Up local frame, so it stays glued to the
 * terrain as the user pans, tilts and zooms the globe.
 *
 * The overlay canvas has `pointer-events: none` so Cesium retains all
 * input (pick, pan, zoom). A small HUD panel is layered on top with
 * normal pointer events for status / close affordance.
 */
export function BimGeoOverlay({ project, cesiumCtx, onClose, canEdit = false, onPoseSaved }: BimGeoOverlayProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error" | "empty">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);

  // ----- Editable pose -----
  const initialPose = useMemo<PoseState>(
    () => ({
      lat: project.coordinates.lat,
      lng: project.coordinates.lng,
      elevation: project.elevation,
      headingDeg: project.bimHeadingDeg ?? 0,
      pitchDeg: project.bimPitchDeg ?? 0,
      rollDeg: project.bimRollDeg ?? 0,
    }),
    [
      project.coordinates.lat,
      project.coordinates.lng,
      project.elevation,
      project.bimHeadingDeg,
      project.bimPitchDeg,
      project.bimRollDeg,
    ],
  );
  const [editMode, setEditMode] = useState(false);
  const [poseOpen, setPoseOpen] = useState(true);
  const [pose, setPose] = useState<PoseState>(initialPose);
  const [saving, setSaving] = useState(false);
  useEffect(() => setPose(initialPose), [initialPose]);

  // Refs the render loop reads
  const enuInverseRef = useRef<unknown>(null);
  const modelRootRef = useRef<import("three").Group | null>(null);
  const cesiumRef = useRef<CesiumContext | null>(null);
  cesiumRef.current = cesiumCtx;

  const savePose = useServerFn(updateProjectModelPose);

  useEffect(() => {
    if (!cesiumCtx) return;
    const { viewer, Cesium } = cesiumCtx;
    const cesiumCanvas = viewer.scene.canvas as HTMLCanvasElement;
    const host = canvasHostRef.current;
    if (!host) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      setStatus("loading");
      try {
        const THREE = await import("three");

        // --- THREE renderer overlaid on Cesium ---------------------------
        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
          logarithmicDepthBuffer: true,
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0x000000, 0);
        renderer.autoClear = true;
        const domEl = renderer.domElement;
        domEl.style.position = "absolute";
        domEl.style.inset = "0";
        domEl.style.width = "100%";
        domEl.style.height = "100%";
        domEl.style.pointerEvents = "none";
        host.appendChild(domEl);

        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(80, 200, 120);
        scene.add(sun);
        // Cyan rim light to match the HUD aesthetic
        const rim = new THREE.DirectionalLight(0x22d3ee, 0.4);
        rim.position.set(-100, 60, -80);
        scene.add(rim);

        // Use Cesium's frustum at runtime — initial values are placeholders.
        const threeCamera = new THREE.PerspectiveCamera(60, 1, 1, 10_000_000);
        threeCamera.up.set(0, 0, 1); // ENU is Z-up

        // --- ENU anchor at the project origin (mutable via pose updates) -
        const origin = Cesium.Cartesian3.fromDegrees(
          initialPose.lng,
          initialPose.lat,
          initialPose.elevation,
        );
        const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
        enuInverseRef.current = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());

        // Root group that holds the BIM model in local ENU space.
        const modelRoot = new THREE.Group();
        // ZYX so heading=Z, pitch=X, roll=Y compose intuitively.
        modelRoot.rotation.order = "ZYX";
        scene.add(modelRoot);
        modelRootRef.current = modelRoot;
        // Many .frag exports use Y-up. We compose a child group with the
        // Y-up→Z-up axis flip so the outer modelRoot remains free for the
        // user's heading / pitch / roll edits.
        const axisFlip = new THREE.Group();
        if (!project.bimWorldCoordinates) {
          axisFlip.rotation.x = Math.PI / 2;
        }
        modelRoot.add(axisFlip);
        // Apply initial pose rotation immediately
        modelRoot.rotation.set(
          THREE.MathUtils.degToRad(initialPose.pitchDeg),
          THREE.MathUtils.degToRad(initialPose.rollDeg),
          THREE.MathUtils.degToRad(initialPose.headingDeg),
        );

        // Reference axes + footprint so the user sees the anchor even with no model.
        const axes = new THREE.AxesHelper(40);
        scene.add(axes);
        const footprint = new THREE.Mesh(
          new THREE.RingGeometry(18, 22, 64),
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide,
          }),
        );
        footprint.rotation.x = -Math.PI / 2; // lay flat on ENU ground (XY plane)
        // Actually ENU ground is XY (Z up); RingGeometry is in XY plane → no rotation needed.
        footprint.rotation.set(0, 0, 0);
        scene.add(footprint);

        let fragments: { dispose: () => Promise<void>; update: (f?: boolean) => Promise<void> } | null =
          null;
        const loadedObjects: import("three").Object3D[] = [];

        // --- Camera sync (Cesium → THREE) every preRender ----------------
        const tmpCamPos = new Cesium.Cartesian3();
        const tmpDir = new Cesium.Cartesian3();
        const tmpUp = new Cesium.Cartesian3();

        const syncCamera = () => {
          const w = cesiumCanvas.clientWidth || cesiumCanvas.width;
          const h = cesiumCanvas.clientHeight || cesiumCanvas.height;
          if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
            renderer.setSize(w, h, false);
          }

          const enuInverse = enuInverseRef.current as InstanceType<typeof Cesium.Matrix4> | null;
          if (!enuInverse) return;
          // Camera position in ECEF → local ENU
          Cesium.Matrix4.multiplyByPoint(enuInverse, viewer.camera.positionWC, tmpCamPos);
          // Direction & up vectors transformed without translation
          Cesium.Matrix4.multiplyByPointAsVector(enuInverse, viewer.camera.directionWC, tmpDir);
          Cesium.Matrix4.multiplyByPointAsVector(enuInverse, viewer.camera.upWC, tmpUp);

          threeCamera.position.set(tmpCamPos.x, tmpCamPos.y, tmpCamPos.z);
          threeCamera.up.set(tmpUp.x, tmpUp.y, tmpUp.z);
          threeCamera.lookAt(
            tmpCamPos.x + tmpDir.x,
            tmpCamPos.y + tmpDir.y,
            tmpCamPos.z + tmpDir.z,
          );

          // Match Cesium's perspective frustum
          const frustum = viewer.camera.frustum as {
            fovy?: number;
            fov?: number;
            near: number;
            far: number;
          };
          const fovy = frustum.fovy ?? frustum.fov ?? Math.PI / 3;
          threeCamera.fov = THREE.MathUtils.radToDeg(fovy);
          threeCamera.aspect = w / Math.max(1, h);
          threeCamera.near = Math.max(0.1, frustum.near);
          threeCamera.far = Math.max(threeCamera.near + 1, frustum.far);
          threeCamera.updateProjectionMatrix();
        };

        const renderFrame = () => {
          if (cancelled) return;
          renderer.render(scene, threeCamera);
        };

        // Stream fragments on Cesium ticks so we render in lockstep.
        const onPreRender = () => {
          syncCamera();
          // Let the fragments worker stream new tiles based on the latest camera.
          fragments?.update().catch(() => {});
        };
        const onPostRender = () => renderFrame();
        viewer.scene.preRender.addEventListener(onPreRender);
        viewer.scene.postRender.addEventListener(onPostRender);
        // Force at least one frame even if Cesium is idle.
        viewer.scene.requestRender();

        cleanup = () => {
          viewer.scene.preRender.removeEventListener(onPreRender);
          viewer.scene.postRender.removeEventListener(onPostRender);
          fragments?.dispose().catch(() => {});
          renderer.dispose();
          modelRootRef.current = null;
          enuInverseRef.current = null;
          if (domEl.parentElement === host) host.removeChild(domEl);
        };

        // --- Load fragment model(s) --------------------------------------
        // Sources: explicit URL OR a list of Supabase storage paths in the
        // private `bim-models` bucket (federated, multi-discipline models).
        const sources: Array<{ kind: "url" | "storage"; ref: string }> = [];
        if (project.bimModelUrl) sources.push({ kind: "url", ref: project.bimModelUrl });
        for (const p of project.bimModelPaths ?? []) {
          sources.push({ kind: "storage", ref: p });
        }

        // Also pull live federated models registered in `project_bim_models`.
        // The pin row in `gis_pins` and the project row in `projects` are
        // linked by a name prefix convention (e.g. pin
        // "2534_CDWC - Upper House Residences Bangkok" → project "2534_CDWC").
        try {
          const namePrefix = project.name.split(" - ")[0]?.trim() || project.name;
          const { data: projRows } = await supabase
            .from("projects")
            .select("id,name")
            .ilike("name", `${namePrefix}%`)
            .limit(1);
          const linkedProjectId = projRows?.[0]?.id;
          if (linkedProjectId) {
            const { data: bimRows } = await supabase
              .from("project_bim_models")
              .select("storage_path,file_type")
              .eq("project_id", linkedProjectId)
              .eq("file_type", "frag");
            const seen = new Set(sources.filter((s) => s.kind === "storage").map((s) => s.ref));
            for (const row of bimRows ?? []) {
              if (row.storage_path && !seen.has(row.storage_path)) {
                sources.push({ kind: "storage", ref: row.storage_path });
                seen.add(row.storage_path);
              }
            }
          }
        } catch (err) {
          console.warn("[BimGeoOverlay] could not resolve federated models", err);
        }

        if (sources.length === 0) {
          if (!cancelled) setStatus("empty");
        } else {
          try {
            const { FragmentsModels } = await import("@thatopen/fragments");
            const workerURL = await FragmentsModels.getWorker();
            if (cancelled) return;
            const f = new FragmentsModels(workerURL);
            fragments = f as unknown as typeof fragments;

            let loaded = 0;
            for (const src of sources) {
              try {
                let buffer: ArrayBuffer;
                if (src.kind === "url") {
                  const res = await fetch(src.ref);
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  buffer = await res.arrayBuffer();
                } else {
                  const { data: blob, error: dlErr } = await supabase.storage
                    .from("bim-models")
                    .download(src.ref);
                  if (dlErr) throw dlErr;
                  buffer = await blob.arrayBuffer();
                }
                if (cancelled) return;
                // .slice(0) — fragments.load transfers the buffer to its worker
                const bufferCopy = buffer.slice(0);
                const fmodel = await f.load(bufferCopy, {
                  modelId: `gis::${project.id}::${loaded}`,
                  camera: threeCamera,
                });
                if (cancelled) return;
                axisFlip.add(fmodel.object);
                loadedObjects.push(fmodel.object);
                loaded += 1;
              } catch (err) {
                console.warn(`[BimGeoOverlay] failed source ${src.ref}`, err);
              }
            }
            await f.update(true);
            // Federation uses the .frag's intrinsic coordinates per the
            // official ThatOpen tutorial: each model.object is added to the
            // scene as-is. Models exported from Revit / IFC with shared
            // coordinates already encode their offset from the project base
            // point, so they align with each other automatically. Do NOT
            // recenter the bounding box — that would destroy the shared-
            // coord offsets and slam every discipline onto the pin.
            void loadedObjects;
            if (!cancelled) setStatus(loaded > 0 ? "ready" : "error");
            if (loaded === 0) setErrorMsg("No fragments could be loaded");
          } catch (err) {
            console.error("[BimGeoOverlay] fragment init failed", err);
            setErrorMsg(err instanceof Error ? err.message : "Fragment init failed");
            setStatus("error");
          }
        }
      } catch (err) {
        console.error("[BimGeoOverlay] init failed", err);
        setErrorMsg(err instanceof Error ? err.message : "Init failed");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
    // We deliberately exclude pose fields — pose updates are applied
    // imperatively below to avoid reloading fragments on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cesiumCtx,
    project.id,
    project.bimModelUrl,
    project.bimModelPaths,
    project.bimWorldCoordinates,
  ]);

  // Live-apply pose changes (lat/lng/elev → ENU anchor; HPR → modelRoot rotation)
  useEffect(() => {
    const ctx = cesiumRef.current;
    if (!ctx) return;
    const { viewer, Cesium } = ctx;
    let cancelled = false;
    (async () => {
      const THREE = await import("three");
      if (cancelled) return;
      const origin = Cesium.Cartesian3.fromDegrees(pose.lng, pose.lat, pose.elevation);
      const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
      enuInverseRef.current = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());
      const root = modelRootRef.current;
      if (root) {
        root.rotation.set(
          THREE.MathUtils.degToRad(pose.pitchDeg),
          THREE.MathUtils.degToRad(pose.rollDeg),
          THREE.MathUtils.degToRad(pose.headingDeg),
        );
      }
      viewer.scene.requestRender();
    })();
    return () => {
      cancelled = true;
    };
  }, [pose.lat, pose.lng, pose.elevation, pose.headingDeg, pose.pitchDeg, pose.rollDeg]);

  const dirty =
    pose.lat !== initialPose.lat ||
    pose.lng !== initialPose.lng ||
    pose.elevation !== initialPose.elevation ||
    pose.headingDeg !== initialPose.headingDeg ||
    pose.pitchDeg !== initialPose.pitchDeg ||
    pose.rollDeg !== initialPose.rollDeg;

  const handleSave = async () => {
    if (!project.projectDbId) {
      toast.error("This pin is not linked to a project — cannot save pose.");
      return;
    }
    setSaving(true);
    try {
      await savePose({ data: { projectId: project.projectDbId, ...pose } });
      toast.success("Model pose saved");
      onPoseSaved?.(pose);
      setEditMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save pose");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Overlay THREE canvas — sits inside the Cesium host */}
      <div
        ref={canvasHostRef}
        className="pointer-events-none absolute inset-0 z-[5]"
        aria-hidden
      />

      {/* Floating status / close HUD */}
      <div className="pointer-events-auto absolute right-[22rem] top-16 z-20 rounded-md border border-cyan-500/40 bg-slate-950/80 backdrop-blur-md shadow-[0_0_24px_rgba(6,182,212,0.25)] px-3 py-2 flex items-center gap-3 font-mono">
        <Building2 className="h-4 w-4 text-cyan-300" />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-widest text-cyan-300/80">
            Geo-BIM Overlay
          </span>
          <span className="text-xs text-cyan-100">{project.name}</span>
        </div>
        <div className="ml-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
          {status === "loading" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />
              <span className="text-cyan-300">Streaming…</span>
            </>
          )}
          {status === "ready" && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
              <span className="text-emerald-300">Anchored</span>
            </>
          )}
          {status === "empty" && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="text-amber-300">No .frag wired</span>
            </>
          )}
          {status === "error" && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span className="text-rose-300" title={errorMsg ?? undefined}>
                Failed
              </span>
            </>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setPoseOpen((v) => !v)}
            className={cn(
              "ml-1 flex items-center gap-1 rounded-sm border px-2 py-1 text-[10px] font-mono uppercase tracking-wider transition-all",
              poseOpen
                ? "border-cyan-400/70 bg-cyan-500/10 text-cyan-200 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                : "border-slate-700/60 bg-slate-900/40 text-slate-400 hover:text-cyan-200",
            )}
            title="Toggle Model Pose"
          >
            <SlidersHorizontal className="h-3 w-3" />
            Pose
          </button>
        )}
        <button
          onClick={onClose}
          className="ml-2 text-slate-400 hover:text-cyan-300 transition-colors"
          aria-label="Close BIM overlay"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Edit pose panel (visible to admins / BIM editors) */}
      {canEdit && poseOpen && (
        <div className="pointer-events-auto absolute right-[22rem] top-32 z-20 w-[22rem] rounded-md border border-cyan-500/40 bg-slate-950/85 backdrop-blur-md shadow-[0_0_24px_rgba(6,182,212,0.25)] p-3 font-mono text-xs text-cyan-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-cyan-300" />
              <span className="uppercase tracking-widest text-[10px] text-cyan-300/80">
                Model Pose
              </span>
            </div>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 rounded-sm border border-cyan-400/60 bg-cyan-500/10 px-2 py-1 text-[10px] uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/20"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setPose(initialPose);
                  }}
                  disabled={!dirty || saving}
                  className="flex items-center gap-1 rounded-sm border border-slate-600/60 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300 hover:text-cyan-200 disabled:opacity-40"
                  title="Reset to saved values"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
                <button
                  onClick={() => {
                    setPose(initialPose);
                    setEditMode(false);
                  }}
                  className="rounded-sm border border-slate-600/60 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300 hover:text-rose-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saving}
                  className="flex items-center gap-1 rounded-sm border border-emerald-400/60 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PoseField label="Lat" value={pose.lat} step={0.0000001} disabled={!editMode}
              onChange={(v) => setPose((p) => ({ ...p, lat: v }))} />
            <PoseField label="Lng" value={pose.lng} step={0.0000001} disabled={!editMode}
              onChange={(v) => setPose((p) => ({ ...p, lng: v }))} />
            <PoseField label="Elev (m)" value={pose.elevation} step={0.1} disabled={!editMode}
              onChange={(v) => setPose((p) => ({ ...p, elevation: v }))} />
            <PoseField label="Heading °" value={pose.headingDeg} step={0.5} disabled={!editMode}
              onChange={(v) => setPose((p) => ({ ...p, headingDeg: v }))} />
            <PoseField label="Pitch °" value={pose.pitchDeg} step={0.5} disabled={!editMode}
              onChange={(v) => setPose((p) => ({ ...p, pitchDeg: v }))} />
            <PoseField label="Roll °" value={pose.rollDeg} step={0.5} disabled={!editMode}
              onChange={(v) => setPose((p) => ({ ...p, rollDeg: v }))} />
          </div>
          {!project.projectDbId && (
            <p className="mt-2 text-[10px] text-amber-300">
              Pin is not linked to a project — saving is disabled.
            </p>
          )}
        </div>
      )}
    </>
  );
}

function PoseField({
  label,
  value,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-cyan-300/70">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="rounded-sm border border-slate-700/60 bg-slate-900/60 px-2 py-1 text-[11px] text-cyan-100 focus:border-cyan-400/60 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
      />
    </label>
  );
}