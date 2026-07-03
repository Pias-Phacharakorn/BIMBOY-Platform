import { createPortal } from "react-dom";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { useBimStore } from "@/react-components/store/bimStore";

/**
 * Global "loading cloud models" progress modal, driven entirely by bimStore's
 * isModelLoading/loadingFiles state. Shown for both the manual "Load Models"
 * button (CloudModelModal) and automatic loading on project open
 * (useAutoLoadCloudModels) — one shared feedback surface for both paths.
 */
export function CloudModelLoadingModal() {
  const isModelLoading = useBimStore((s) => s.isModelLoading);
  const loadingFiles = useBimStore((s) => s.loadingFiles);
  const setModelLoading = useBimStore((s) => s.setModelLoading);

  if (!isModelLoading) return null;

  const completedCount = loadingFiles.filter(
    (f) => f.status === "done" || f.status === "error"
  ).length;
  const hasError = loadingFiles.some((f) => f.status === "error");
  const isDone = loadingFiles.length > 0 && completedCount === loadingFiles.length;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-[420px] max-w-full flex flex-col items-center justify-center p-8 gap-6 text-fg bg-surface border border-border rounded-radius shadow-xl animate-in zoom-in-95 duration-200">
        <div className="relative flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-accent animate-spin" />
          <span className="absolute text-[10px] font-bold">
            {completedCount}/{loadingFiles.length}
          </span>
        </div>
        <div className="text-center">
          <h3 className="text-sm font-bold">Loading Cloud Models</h3>
          <p className="text-xs text-muted mt-1">
            Please wait while models are loaded into the viewport.
          </p>
        </div>

        <div className="w-full max-h-[250px] overflow-y-auto border border-border rounded-radius bg-surface-alt p-3 flex flex-col gap-2">
          {loadingFiles.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0"
            >
              <span className="truncate max-w-[75%] font-medium text-fg">{file.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {file.status === "pending" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted-2/20 text-muted font-semibold">
                    Pending
                  </span>
                )}
                {file.status === "loading" && (
                  <div className="flex items-center gap-1 text-accent font-semibold text-[10px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Downloading</span>
                  </div>
                )}
                {file.status === "done" && (
                  <span className="flex items-center gap-0.5 text-status-ok font-semibold text-[10px]">
                    <Check className="w-3.5 h-3.5" />
                    <span>Ready</span>
                  </span>
                )}
                {file.status === "error" && (
                  <span className="flex items-center gap-0.5 text-status-danger font-semibold text-[10px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {isDone && hasError && (
          <button
            onClick={() => setModelLoading(false)}
            className="w-full min-h-9 py-2 px-4 rounded-radius bg-surface-raised border border-border hover:bg-surface-alt font-semibold text-xs text-fg transition-all cursor-pointer"
            type="button"
          >
            Close & View Viewer
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
