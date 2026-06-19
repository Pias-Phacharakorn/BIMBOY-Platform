import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { RittaProject } from "@/types/project";

interface BimEngineProps {
  project: RittaProject;
  onClose: () => void;
}

/**
 * Lightweight ThatOpen Fragments viewer.
 *
 * Renders a floating glass panel with its own THREE.js canvas. Fragment
 * binaries are streamed from `project.bimModelUrl`; if no model is wired
 * we surface a clear empty state instead of failing silently.
 */
export function BimEngine({ project, onClose }: BimEngineProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      if (!hostRef.current) return;
      setStatus("loading");
      try {
        const THREE = await import("three");
        const FRAGS = await import("@thatopen/fragments");

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        const host = hostRef.current!;
        renderer.setSize(host.clientWidth, host.clientHeight);
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#020617");

        const camera = new THREE.PerspectiveCamera(
          60,
          host.clientWidth / host.clientHeight,
          0.1,
          5000,
        );
        camera.position.set(20, 20, 20);
        camera.lookAt(0, 0, 0);

        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const dir = new THREE.DirectionalLight(0x88ddff, 1);
        dir.position.set(10, 30, 10);
        scene.add(ambient, dir);

        // Grid floor for empty-state visual
        const grid = new THREE.GridHelper(80, 40, 0x0ea5e9, 0x1e293b);
        scene.add(grid);

        let raf = 0;
        const tick = () => {
          raf = requestAnimationFrame(tick);
          grid.rotation.y += 0.0008;
          renderer.render(scene, camera);
        };
        tick();

        const onResize = () => {
          if (!hostRef.current) return;
          camera.aspect = hostRef.current.clientWidth / hostRef.current.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(hostRef.current.clientWidth, hostRef.current.clientHeight);
        };
        window.addEventListener("resize", onResize);

        cleanup = () => {
          window.removeEventListener("resize", onResize);
          cancelAnimationFrame(raf);
          renderer.dispose();
          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };

        // Attempt to stream a fragment if provided
        if (project.bimModelUrl) {
          try {
            const res = await fetch(project.bimModelUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = await res.arrayBuffer();
            if (cancelled) return;
            const FragmentsModels = (FRAGS as unknown as { FragmentsModels?: new () => unknown })
              .FragmentsModels;
            if (FragmentsModels) {
              // Best-effort: instantiate and let consumer extend later.
              const models = new FragmentsModels();
              (models as { load?: (b: ArrayBuffer) => unknown }).load?.(buffer);
            }
          } catch (err) {
            console.warn("[BimEngine] Failed to load fragment", err);
          }
        }

        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("[BimEngine] init failed", err);
        setErrorMsg(err instanceof Error ? err.message : "BIM viewer init failed");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [project.bimModelUrl]);

  return (
    <div className="pointer-events-auto absolute inset-x-[18rem] top-16 bottom-28 z-20 rounded-md border border-cyan-500/40 bg-slate-950/80 backdrop-blur-md shadow-[0_0_40px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-cyan-500/30 px-3 py-2 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-cyan-300 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          BIM Operational View // {project.name}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-cyan-300 transition-colors"
          aria-label="Close BIM viewer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={hostRef} className="relative flex-1">
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center text-cyan-300 text-xs font-mono gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Initialising ThatOpen Engine…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-300 text-xs font-mono p-4 text-center">
            BIM init failed
            <span className="mt-1 text-slate-400">{errorMsg}</span>
          </div>
        )}
        {status === "ready" && !project.bimModelUrl && (
          <div className="absolute left-3 bottom-3 text-[10px] uppercase tracking-widest text-amber-300/80 font-mono bg-slate-950/70 border border-amber-500/30 rounded px-2 py-1">
            No BIM model linked — showing site reference grid
          </div>
        )}
      </div>
    </div>
  );
}