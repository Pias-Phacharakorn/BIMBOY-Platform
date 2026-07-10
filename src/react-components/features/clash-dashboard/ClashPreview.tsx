import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useClashStore } from "@/react-components/store/clashStore";
import { useUpdateClashViewpoint } from "./useClashViewpoints";
import { useFilteredClashItems } from "./useFilteredClashItems";
import type { ClashViewpointRow } from "./clashService";
import {
  statusLabelMap,
  statusToneClassMap,
  statusAccentClassMap,
  typeLabelMap,
  typeDotClassMap,
  typeAccentClassMap,
  TYPE_DOT_BASE_CLASS,
  getClashSeqId,
} from "./clashDisplayHelpers";
import { EditableTextField, EditableSelectField } from "./EditableClashField";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  { value: "new", label: statusLabelMap.new, accentClassName: statusAccentClassMap.new },
  { value: "unresolved", label: statusLabelMap.unresolved, accentClassName: statusAccentClassMap.unresolved },
  { value: "resolved", label: statusLabelMap.resolved, accentClassName: statusAccentClassMap.resolved },
  { value: "approved_as_note", label: statusLabelMap.approved_as_note, accentClassName: statusAccentClassMap.approved_as_note },
];

const TYPE_OPTIONS = [
  { value: "major", label: typeLabelMap.major, accentClassName: typeAccentClassMap.major },
  { value: "minor", label: typeLabelMap.minor, accentClassName: typeAccentClassMap.minor },
  { value: "regulation", label: typeLabelMap.regulation, accentClassName: typeAccentClassMap.regulation },
];

interface ClashPreviewProps {
  projectId: string;
}

export function ClashPreview({ projectId }: ClashPreviewProps) {
  const {
    selectedClashId,
    setSelectedClashId,
    isClashModalOpen: isModalOpen,
    setIsClashModalOpen: setIsModalOpen,
  } = useClashStore();
  // Same report/quick-filtered set as ClashTable, so the same clash gets the same #ID in both places.
  const { data: clashItems } = useFilteredClashItems(projectId);
  const updateMutation = useUpdateClashViewpoint();

  // Find the selected clash item from the fetched list
  const item = clashItems.find((c) => c.id === selectedClashId);
  const selectedIndex = selectedClashId ? clashItems.findIndex((c) => c.id === selectedClashId) : -1;
  const clashIndex = selectedIndex >= 0 ? getClashSeqId(clashItems, selectedIndex) : 0;

  // Gallery Active Image Key state
  const [activeImageKey, setActiveImageKey] = useState<"viewpoint" | "plan" | "section">("viewpoint");

  // Loading spinner state for the snapshot thumbnail and the full-screen modal's main image
  const [isThumbLoaded, setIsThumbLoaded] = useState(false);
  const [isMainImageLoaded, setIsMainImageLoaded] = useState(false);

  useEffect(() => {
    setIsThumbLoaded(false);
  }, [item?.imageUrl]);

  useEffect(() => {
    setIsMainImageLoaded(false);
  }, [activeImageKey, item?.imageUrl, item?.planImageUrl, item?.sectionImageUrl]);

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

  // Reset zoom & pan when modal closes
  useEffect(() => {
    if (!isModalOpen) resetZoomPan();
  }, [isModalOpen]);

  // isClashModalOpen lives in the global store (so ClashTable's title click can
  // open it too), which means it survives this component unmounting. Close it
  // on unmount so switching tabs/views away and back doesn't reopen a stale modal.
  useEffect(() => {
    return () => setIsModalOpen(false);
  }, [setIsModalOpen]);

  // Reset the active gallery tab when the selected item changes
  useEffect(() => {
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

  const saveField = (updates: Partial<Pick<ClashViewpointRow, "name" | "status" | "type" | "comments" | "solution">>) => {
    updateMutation.mutate({ id: item.id, updates });
  };

  const isSaving = updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <h2 className="text-sm font-medium text-fg">Clash #{clashIndex}</h2>
        <button
          className="text-muted hover:text-fg p-1 cursor-pointer bg-transparent border-0 flex items-center justify-center transition-colors"
          type="button"
          aria-label="Close panel"
          onClick={() => setSelectedClashId(null)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Snapshot Preview */}
      <div className="flex flex-col gap-1.5">
        <label className="text-muted text-[10px] font-bold tracking-wider uppercase">Snapshot</label>
        <div
          className={`relative group overflow-hidden border border-border rounded-radius bg-surface-alt aspect-video flex items-center justify-center ${
            item.imageUrl ? "cursor-pointer" : "select-none"
          }`}
          onClick={() => {
            if (item.imageUrl) setIsModalOpen(true);
          }}
        >
          {item.imageUrl ? (
            <>
              {!isThumbLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
                </div>
              )}
              <img
                src={item.imageUrl}
                alt={item.name}
                onLoad={() => setIsThumbLoaded(true)}
                className={`w-full h-full object-cover transition-transform transition-opacity duration-200 group-hover:scale-105 ${
                  isThumbLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </>
          ) : (
            <div className="text-muted text-[11px] font-mono select-none">NO SNAPSHOT AVAILABLE</div>
          )}
          {isSaving && (
            <div className="absolute inset-0 bg-bg/50 backdrop-blur-[1px] flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Info Fields */}
      <div className="flex flex-col gap-4">
        <EditableTextField
          label="Name"
          value={item.name}
          disabled={isSaving}
          onSave={(newVal) => saveField({ name: newVal })}
        />

        <EditableSelectField
          label="Status"
          value={item.status}
          options={STATUS_OPTIONS}
          disabled={isSaving}
          onSave={(newVal) => saveField({ status: newVal as ClashViewpointRow["status"] })}
          renderView={(value) => (
            <span
              className={`inline-flex items-center min-h-6 px-2.5 py-1 border rounded-full text-[10px] font-bold tracking-wider uppercase ${statusToneClassMap[value as ClashViewpointRow["status"]]}`}
            >
              {statusLabelMap[value as ClashViewpointRow["status"]]}
            </span>
          )}
        />

        <EditableSelectField
          label="Type"
          value={item.type}
          options={TYPE_OPTIONS}
          disabled={isSaving}
          onSave={(newVal) => saveField({ type: newVal as ClashViewpointRow["type"] })}
          renderView={(value) => (
            <span className="inline-flex items-center gap-2 text-sm text-fg font-medium">
              <span className={`${TYPE_DOT_BASE_CLASS} ${typeDotClassMap[value as ClashViewpointRow["type"]]}`} />
              {typeLabelMap[value as ClashViewpointRow["type"]]}
            </span>
          )}
        />

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase">Path</label>
          <p className="text-sm text-fg font-medium">{item.path || "(root)"}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase">Created</label>
          <p className="text-sm text-fg font-mono">{format(new Date(item.occurredAt), "yyyy-MM-dd HH:mm")}</p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-muted text-[10px] font-bold tracking-wider uppercase">GUID</label>
          <p className="text-xs text-muted font-mono break-all">{item.guid}</p>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="flex flex-col gap-3 pt-1 border-t border-border">
        <div className="mt-3">
          <EditableTextField
            label="Comments"
            value={item.comments || ""}
            multiline
            disabled={isSaving}
            placeholder="Add comments about this clash..."
            valueClassName="text-xs text-fg"
            onSave={(newVal) => saveField({ comments: newVal })}
          />
        </div>

        <EditableTextField
          label="Solution Notes"
          value={item.solution || ""}
          multiline
          disabled={isSaving}
          placeholder="Add mitigation or solution details..."
          valueClassName="text-xs text-fg"
          onSave={(newVal) => saveField({ solution: newVal })}
        />
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
              {!isMainImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center z-[5]">
                  <div className="w-8 h-8 border-2 border-border border-t-accent rounded-full animate-spin" />
                </div>
              )}

              {activeImageKey === "plan" && item.planImageUrl ? (
                <img
                  src={item.planImageUrl}
                  alt="Plan View"
                  onLoad={() => setIsMainImageLoaded(true)}
                  className={`max-w-full max-h-full object-contain rounded-sm select-none transition-opacity duration-150 ${
                    isMainImageLoaded ? "opacity-100" : "opacity-0"
                  } ${isDragging ? "" : "transition-transform duration-100 ease-out"}`}
                  draggable="false"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  }}
                />
              ) : activeImageKey === "section" && item.sectionImageUrl ? (
                <img
                  src={item.sectionImageUrl}
                  alt="Section View"
                  onLoad={() => setIsMainImageLoaded(true)}
                  className={`max-w-full max-h-full object-contain rounded-sm select-none transition-opacity duration-150 ${
                    isMainImageLoaded ? "opacity-100" : "opacity-0"
                  } ${isDragging ? "" : "transition-transform duration-100 ease-out"}`}
                  draggable="false"
                  style={{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                  }}
                />
              ) : (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  onLoad={() => setIsMainImageLoaded(true)}
                  className={`max-w-full max-h-full object-contain rounded-sm select-none transition-opacity duration-150 ${
                    isMainImageLoaded ? "opacity-100" : "opacity-0"
                  } ${isDragging ? "" : "transition-transform duration-100 ease-out"}`}
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
              <div className="mb-4">
                <EditableTextField
                  label="Name"
                  value={item.name}
                  disabled={isSaving}
                  valueClassName="text-[13px] text-muted-2 font-medium leading-normal"
                  onSave={(newVal) => saveField({ name: newVal })}
                />
              </div>

              {/* Badges */}
              <div className="flex gap-2 mb-6">
                <span
                  className={`inline-flex items-center min-h-5 px-2.5 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${statusToneClassMap[item.status]}`}
                >
                  {statusLabelMap[item.status]}
                </span>
                <span className="inline-flex items-center gap-1.5 min-h-5 px-2.5 py-0.5 border border-border-strong rounded-full text-[10px] font-bold tracking-wider uppercase text-fg">
                  <span className={`${TYPE_DOT_BASE_CLASS} ${typeDotClassMap[item.type]}`} />
                  {typeLabelMap[item.type]}
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

              {/* Comments */}
              <div className="mb-5">
                <EditableTextField
                  label="Comments"
                  value={item.comments || ""}
                  multiline
                  disabled={isSaving}
                  placeholder="No comments available"
                  valueClassName="text-xs text-muted"
                  editClassName="w-full bg-surface-alt/40 border border-border rounded px-3 py-2 text-xs text-fg resize-none focus:outline-none focus:border-accent leading-normal"
                  onSave={(newVal) => saveField({ comments: newVal })}
                />
              </div>

              {/* Solution Notes */}
              <div className="mb-6">
                <EditableTextField
                  label="Solution"
                  value={item.solution || ""}
                  multiline
                  disabled={isSaving}
                  placeholder="No solution details available"
                  valueClassName="text-xs text-muted"
                  editClassName="w-full bg-surface-alt/40 border border-border rounded px-3 py-2 text-xs text-fg resize-none focus:outline-none focus:border-accent leading-normal"
                  onSave={(newVal) => saveField({ solution: newVal })}
                />
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
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
