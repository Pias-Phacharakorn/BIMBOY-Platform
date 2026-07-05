import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw, Pencil } from "lucide-react";
import { useClashStore } from "@/react-components/store/clashStore";
import { useClashViewpoints, useUpdateClashViewpoint } from "./useClashViewpoints";
import { format } from "date-fns";

interface ClashPreviewProps {
  projectId: string;
}

export function ClashPreview({ projectId }: ClashPreviewProps) {
  const { selectedClashId, setSelectedClashId } = useClashStore();
  const { data: clashItems = [] } = useClashViewpoints(projectId);
  const updateMutation = useUpdateClashViewpoint();

  // Find the selected clash item from the fetched list
  const item = clashItems.find((c) => c.id === selectedClashId);
  const clashIndex = selectedClashId ? clashItems.findIndex((c) => c.id === selectedClashId) + 1 : 0;

  // Local state for comments, solution edits, and image pop-up modal
  const [comments, setComments] = useState("");
  const [solution, setSolution] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Gallery Active Image Key state and solution notes edit state
  const [activeImageKey, setActiveImageKey] = useState<"viewpoint" | "plan" | "section">("viewpoint");
  const [modalSolution, setModalSolution] = useState("");

  // Zoom & Pan states
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const resetZoomPan = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
  };

  // Reset zoom, pan, and active tab when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      resetZoomPan();
      setActiveImageKey("viewpoint");
    } else if (item) {
      setModalSolution(item.solution || "");
    }
  }, [isModalOpen, item]);

  // Sync local state when selected item changes
  useEffect(() => {
    if (item) {
      setComments(item.comments || "");
      setSolution(item.solution || "");
      setModalSolution(item.solution || "");
    } else {
      setComments("");
      setSolution("");
      setModalSolution("");
    }
    setIsModalOpen(false); // Close image preview modal on item change
    setActiveImageKey("viewpoint");
  }, [item]);

  // Handle ESC key close for modal
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Mouse zoom & pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || zoomScale <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const zoomStep = 0.15;
    const minZoom = 1;
    const maxZoom = 5;
    const delta = e.deltaY < 0 ? zoomStep : -zoomStep;
    
    setZoomScale((prev) => {
      const newScale = Math.min(Math.max(minZoom, prev + delta), maxZoom);
      if (newScale <= 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(prev + 0.25, 5));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const newScale = Math.max(prev - 0.25, 1);
      if (newScale <= 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return newScale;
    });
  };

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center text-center select-none py-10 min-h-[300px]">
        <div className="w-12 h-12 rounded-full border border-border border-dashed flex items-center justify-center text-muted mb-3">
          🔎
        </div>
        <div className="text-muted text-[11px] font-bold tracking-wider uppercase mb-1">Clash Preview</div>
        <p className="text-xs text-muted max-w-[200px] leading-relaxed">
          Select a clash from the report table to inspect viewpoints and update its status.
        </p>
      </div>
    );
  }

  const handleStatusChange = (newStatus: any) => {
    updateMutation.mutate({
      id: item.id,
      updates: { status: newStatus },
    });
  };

  const handleSeverityChange = (newSeverity: any) => {
    updateMutation.mutate({
      id: item.id,
      updates: { type: newSeverity },
    });
  };

  const handleSaveTextChanges = () => {
    updateMutation.mutate({
      id: item.id,
      updates: { comments, solution },
    });
  };

  const handleSaveModalSolution = (newVal: string) => {
    setModalSolution(newVal);
    updateMutation.mutate({
      id: item.id,
      updates: { solution: newVal },
    });
  };

  const isSaving = updateMutation.isPending;

  return (
    <div className="flex flex-col gap-5">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div className="text-muted text-[10px] font-bold tracking-wider uppercase">Clash Details</div>
        <button
          className="text-muted hover:text-fg text-xs cursor-pointer bg-transparent border-0"
          type="button"
          onClick={() => setSelectedClashId(null)}
        >
          Close
        </button>
      </div>

      {/* Snapshot Preview */}
      <div
        className={`relative group overflow-hidden border border-border rounded-radius bg-surface-alt aspect-video flex items-center justify-center ${
          item.imageUrl ? "cursor-pointer" : "select-none"
        }`}
        onClick={() => {
          if (item.imageUrl) setIsModalOpen(true);
        }}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted text-[11px] font-mono select-none">NO SNAPSHOT AVAILABLE</div>
        )}
        {isSaving && (
          <div className="absolute inset-0 bg-bg/50 backdrop-blur-[1px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="flex flex-col gap-1">
        <h4 className="text-fg font-semibold text-sm leading-tight break-words">{item.name}</h4>
        <div className="text-muted text-[11px] font-mono break-all mt-0.5">
          GUID: <span className="text-fg/80">{item.guid}</span>
        </div>
        <div className="text-muted text-[11px] mt-0.5">
          Disciplines: <span className="text-fg font-medium">{item.path || "(root)"}</span>
        </div>
        <div className="text-muted text-[11px] mt-0.5">
          Created: <span className="text-fg font-mono">{format(new Date(item.occurredAt), "yyyy-MM-dd HH:mm")}</span>
        </div>
      </div>

      {/* Status & Severity Selectors */}
      <div className="grid grid-cols-2 gap-3 p-3 border border-border rounded-radius bg-surface-alt">
        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="clash-status-select">Status</label>
          <select
            id="clash-status-select"
            value={item.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={isSaving}
            className="bg-bg text-fg border border-border rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-accent cursor-pointer disabled:opacity-50"
          >
            <option value="new">New</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
            <option value="approved_as_note">Approved</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="clash-severity-select">Severity</label>
          <select
            id="clash-severity-select"
            value={item.type}
            onChange={(e) => handleSeverityChange(e.target.value)}
            disabled={isSaving}
            className="bg-bg text-fg border border-border rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-accent cursor-pointer disabled:opacity-50"
          >
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="regulation">Regulation</option>
          </select>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="clash-comments-input">Comments</label>
          <textarea
            id="clash-comments-input"
            rows={2}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            disabled={isSaving}
            placeholder="Add comments about this clash..."
            className="bg-surface border border-border rounded p-2 text-xs text-fg leading-normal focus:outline-none focus:border-accent resize-none disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase" htmlFor="clash-solution-input">Solution Notes</label>
          <textarea
            id="clash-solution-input"
            rows={2}
            value={solution}
            onChange={(e) => setSolution(e.target.value)}
            disabled={isSaving}
            placeholder="Add mitigation or solution details..."
            className="bg-surface border border-border rounded p-2 text-xs text-fg leading-normal focus:outline-none focus:border-accent resize-none disabled:opacity-50"
          />
        </div>

        <button
          onClick={handleSaveTextChanges}
          disabled={isSaving || (comments === (item.comments || "") && solution === (item.solution || ""))}
          className="inline-flex items-center justify-center min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          type="button"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Redline Markup display */}
      {item.markup && (
        <div className="flex flex-col gap-1.5 p-3 border border-border border-dashed rounded-radius bg-surface-alt/50">
          <div className="text-muted text-[10px] font-bold tracking-wider uppercase">Redline Markup</div>
          <p className="text-xs text-fg leading-normal whitespace-pre-wrap font-mono bg-bg/40 p-1.5 rounded border border-border/30">
            {item.markup}
          </p>
        </div>
      )}

      {/* Full-screen Image Popup Modal */}
      {isModalOpen && item.imageUrl && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 md:p-6 animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-6xl h-[85vh] bg-[#0e1017] border border-border rounded-radius shadow-2xl flex flex-row overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Image Area (Left Viewport) */}
            <div
              className="flex-1 h-full overflow-hidden flex items-center justify-center bg-[#090a0f] relative select-none"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{ cursor: zoomScale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
            >
              {activeImageKey === "plan" && item.planImageUrl ? (
                <img
                  src={item.planImageUrl}
                  alt="Plan View"
                  className={`max-w-full max-h-full object-contain rounded-sm select-none ${
                    isDragging ? "" : "transition-transform duration-100 ease-out"
                  }`}
                  draggable="false"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  }}
                />
              ) : activeImageKey === "section" && item.sectionImageUrl ? (
                <img
                  src={item.sectionImageUrl}
                  alt="Section View"
                  className={`max-w-full max-h-full object-contain rounded-sm select-none ${
                    isDragging ? "" : "transition-transform duration-100 ease-out"
                  }`}
                  draggable="false"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  }}
                />
              ) : (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className={`max-w-full max-h-full object-contain rounded-sm select-none ${
                    isDragging ? "" : "transition-transform duration-100 ease-out"
                  }`}
                  draggable="false"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  }}
                />
              )}

              {/* Floating Zoom Controls */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-[#0e1017]/90 backdrop-blur border border-border rounded-full shadow-lg z-10 select-none">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomScale <= 1}
                  className="p-1.5 rounded-full hover:bg-surface-alt hover:text-fg text-muted disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center"
                  type="button"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <span className="text-xs font-semibold text-fg min-w-[40px] text-center">
                  {Math.round(zoomScale * 100)}%
                </span>

                <button
                  onClick={handleZoomIn}
                  disabled={zoomScale >= 5}
                  className="p-1.5 rounded-full hover:bg-surface-alt hover:text-fg text-muted disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center"
                  type="button"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-border/60" />

                <button
                  onClick={resetZoomPan}
                  disabled={zoomScale === 1 && panOffset.x === 0 && panOffset.y === 0}
                  className="p-1.5 rounded-full hover:bg-surface-alt hover:text-fg text-muted disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center"
                  type="button"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Modal Details Panel (Right Sidebar) */}
            <div className="w-[360px] shrink-0 border-l border-border bg-[#0e1017] flex flex-col h-full overflow-y-auto p-6 text-fg relative">
              {/* Header Index & Close Button */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-bold text-fg">#{clashIndex}</span>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-radius hover:bg-surface-alt text-muted hover:text-fg transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center"
                  type="button"
                  aria-label="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Clash Name */}
              <div className="text-[13px] text-muted-2 font-medium break-all mb-4 leading-normal">
                {item.name}
              </div>

              {/* Badges */}
              <div className="flex gap-2 mb-6">
                <span
                  className={`inline-flex items-center min-h-5 px-2.5 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    item.type === "major"
                      ? "border-[oklch(63%_0.18_28_/_42%)] bg-[oklch(63%_0.18_28_/_13%)] text-status-danger"
                      : item.type === "regulation"
                      ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                      : "border-border-strong bg-[oklch(18%_0.02_255)] text-muted"
                  }`}
                >
                  {item.type}
                </span>
                <span
                  className={`inline-flex items-center min-h-5 px-2.5 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${
                    item.status === "resolved" || item.status === "approved_as_note"
                      ? "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok"
                      : "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
                  }`}
                >
                  {item.status === "approved_as_note" ? "approved" : item.status.replace(/_/g, " ")}
                </span>
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1 mb-5">
                <span className="text-muted text-[10px] font-bold tracking-wider uppercase">Date</span>
                <span className="text-xs text-fg font-mono">
                  {format(new Date(item.occurredAt), "yyyy-MM-dd HH:mm:ss")}
                </span>
              </div>

              {/* Markup */}
              <div className="flex flex-col gap-1.5 mb-5">
                <span className="text-muted text-[10px] font-bold tracking-wider uppercase">Markup</span>
                <div className="border border-border rounded px-3 py-2 bg-surface-alt/40 text-xs text-muted leading-normal whitespace-pre-wrap font-mono min-h-[40px]">
                  {item.markup || "No markup available"}
                </div>
              </div>

              {/* Solution Notes */}
              <div className="flex flex-col gap-1.5 mb-6">
                <span className="text-muted text-[10px] font-bold tracking-wider uppercase">Solution</span>
                <div className="relative border border-border rounded bg-surface-alt/40 focus-within:border-accent flex items-center">
                  <textarea
                    value={modalSolution}
                    onChange={(e) => setModalSolution(e.target.value)}
                    onBlur={() => handleSaveModalSolution(modalSolution)}
                    placeholder="No solution details available"
                    rows={2}
                    className="w-full bg-transparent border-0 outline-none text-xs text-fg px-3 py-2 resize-none pr-8 focus:ring-0 leading-normal"
                  />
                  <Pencil className="w-3.5 h-3.5 text-muted absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Gallery Thumbnails Grid */}
              <div className="flex flex-col gap-3 mb-6">
                <span className="text-muted text-[10px] font-bold tracking-wider uppercase">Gallery Views</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Viewpoint Thumbnail */}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted text-[8px] font-bold truncate uppercase tracking-wider text-center">Viewpoint</span>
                    <button
                      onClick={() => {
                        setActiveImageKey("viewpoint");
                        resetZoomPan();
                      }}
                      className={`aspect-video rounded border overflow-hidden bg-[#090a0f] flex items-center justify-center p-0 cursor-pointer transition-all hover:border-accent ${
                        activeImageKey === "viewpoint" ? "border-accent ring-1 ring-accent" : "border-border"
                      }`}
                    >
                      <img src={item.imageUrl || ""} className="w-full h-full object-cover" alt="Viewpoint Thumbnail" />
                    </button>
                  </div>

                  {/* Plan View Thumbnail */}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted text-[8px] font-bold truncate uppercase tracking-wider text-center">Plan View</span>
                    <button
                      onClick={() => {
                        if (item.planImageUrl) {
                          setActiveImageKey("plan");
                          resetZoomPan();
                        }
                      }}
                      disabled={!item.planImageUrl}
                      className={`aspect-video rounded border overflow-hidden bg-[#090a0f] flex items-center justify-center p-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent ${
                        activeImageKey === "plan" ? "border-accent ring-1 ring-accent" : "border-border"
                      }`}
                    >
                      {item.planImageUrl ? (
                        <img src={item.planImageUrl} className="w-full h-full object-cover" alt="Plan Thumbnail" />
                      ) : (
                        <span className="text-[9px] text-muted font-bold">PL</span>
                      )}
                    </button>
                  </div>

                  {/* Section View Thumbnail */}
                  <div className="flex flex-col gap-1">
                    <span className="text-muted text-[8px] font-bold truncate uppercase tracking-wider text-center">Section View</span>
                    <button
                      onClick={() => {
                        if (item.sectionImageUrl) {
                          setActiveImageKey("section");
                          resetZoomPan();
                        }
                      }}
                      disabled={!item.sectionImageUrl}
                      className={`aspect-video rounded border overflow-hidden bg-[#090a0f] flex items-center justify-center p-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:border-accent ${
                        activeImageKey === "section" ? "border-accent ring-1 ring-accent" : "border-border"
                      }`}
                    >
                      {item.sectionImageUrl ? (
                        <img src={item.sectionImageUrl} className="w-full h-full object-cover" alt="Section Thumbnail" />
                      ) : (
                        <span className="text-[9px] text-muted font-bold">SE</span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Footer Banner */}
              <div className="mt-auto pt-4">
                <div className="p-3 rounded bg-status-danger/10 border border-status-danger/20 flex items-center justify-between gap-2 text-status-danger text-[11px] font-medium leading-normal">
                  <div className="flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>{format(new Date(item.occurredAt), "yyyy-MM-dd HH:mm")}</span>
                  </div>
                  <span className="uppercase font-bold tracking-wide text-[10px]">
                    {item.status === "new" || item.status === "unresolved" ? "Pending" : "Resolved"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
