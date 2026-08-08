import { useCallback, useEffect, useState } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";
import { buildSceneReport } from "./sceneReport";

/**
 * The Scene Diagnostics panel, toggled by the Viewport Settings row of the same name.
 *
 * ⚠️ **Snapshot, not a live view.** {@link buildSceneReport} runs `Box3.setFromObject` over
 * 200k-vertex fill buffers, so it is computed on open and on Refresh only — never on a frame or an
 * event. That is also why "checked" means *the panel is visible*, not *diagnostics are running*.
 */
export function SceneDiagnosticsPanel() {
  const components = useBimStore((s) => s.components);
  const showSceneDiagnostics = useUIStore((s) => s.showSceneDiagnostics);
  const setShowSceneDiagnostics = useUIStore((s) => s.setShowSceneDiagnostics);

  const [report, setReport] = useState("");
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    if (!components) return;
    setRunning(true);
    try {
      setReport(await buildSceneReport(components));
    } catch (error) {
      setReport(`Failed to build the report: ${error}`);
    } finally {
      setRunning(false);
    }
  }, [components]);

  // Snapshot as soon as the panel opens, so ticking the box is one action rather than two.
  useEffect(() => {
    if (showSceneDiagnostics) void run();
  }, [showSceneDiagnostics, run]);

  if (!showSceneDiagnostics) return null;

  return (
    <div className="absolute inset-3 z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-surface/95 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-fg">Scene Diagnostics</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={running || !components}
            className="rounded border border-border px-2 py-1 text-[11px] font-semibold text-fg transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Running…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setShowSceneDiagnostics(false)}
            className="rounded border border-transparent px-2 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-border hover:text-fg"
          >
            Close
          </button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
        {report || (components ? "Running…" : "The viewer is still starting up.")}
      </pre>
    </div>
  );
}
