import { Fragment, useMemo, useState } from "react";
import { format } from "date-fns";
import { Search, Download, GitCompareArrows, Plus, Trash2, Upload, ChevronDown, ChevronRight, X } from "lucide-react";
import { AddDrawingDialog, type NewDrawingInput } from "@/react-components/components/shop-drawings/AddDrawingDialog";
import { UploadPdfDialog, type UploadRevisionInput } from "@/react-components/components/shop-drawings/UploadPdfDialog";
import { DeleteDrawingDialog } from "@/react-components/components/shop-drawings/DeleteDrawingDialog";
import { CompareDrawingsModal } from "@/react-components/components/shop-drawings/CompareDrawingsModal";
import { PdfViewerModal } from "@/react-components/components/shop-drawings/PdfViewerModal";
import { useAuth } from "@/react-components/features/auth/useAuth";
import { useShopDrawings, useCreateShopDrawing, useAddShopDrawingRevision, useDeleteShopDrawing } from "./useShopDrawings";
import { mapShopDrawingRow, type GroupedDrawing, type ShopDrawing } from "./shopDrawingTypes";
import { DISCIPLINES, type DisciplineCode } from "./disciplines";
import type { AppProject } from "@/types";

interface ShopDrawingTableProps {
  project: AppProject;
  isAdmin: boolean;
  initialDisciplineFilter?: DisciplineCode;
}

export function ShopDrawingTable({ project, isAdmin, initialDisciplineFilter }: ShopDrawingTableProps) {
  const { user } = useAuth();
  const { data: rows, isLoading } = useShopDrawings(project.id);
  const createShopDrawing = useCreateShopDrawing();
  const addRevision = useAddShopDrawingRevision();
  const deleteShopDrawing = useDeleteShopDrawing();

  const drawings = useMemo<ShopDrawing[]>(() => (rows ?? []).map(mapShopDrawingRow), [rows]);

  const [sheetNumberFilter, setSheetNumberFilter] = useState("");
  const [sheetNameFilter, setSheetNameFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<DisciplineCode | "">(initialDisciplineFilter ?? "");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<ShopDrawing | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShopDrawing | null>(null);
  const [compareGroup, setCompareGroup] = useState<GroupedDrawing | null>(null);
  const [viewerTarget, setViewerTarget] = useState<ShopDrawing | null>(null);

  const groupedDrawings = useMemo<GroupedDrawing[]>(() => {
    const filtered = drawings.filter((d) => {
      if (sheetNumberFilter && !d.no.toLowerCase().includes(sheetNumberFilter.toLowerCase())) return false;
      if (sheetNameFilter && !d.name.toLowerCase().includes(sheetNameFilter.toLowerCase())) return false;
      if (authorFilter && !(d.author ?? "").toLowerCase().includes(authorFilter.toLowerCase())) return false;
      if (disciplineFilter && d.discipline !== disciplineFilter) return false;
      return true;
    });

    const groups = new Map<string, ShopDrawing[]>();
    filtered.forEach((drawing) => {
      const key = drawing.sheetId || drawing.no;
      const existing = groups.get(key) ?? [];
      existing.push(drawing);
      groups.set(key, existing);
    });

    const result: GroupedDrawing[] = [];
    groups.forEach((versions, sheetId) => {
      versions.sort((a, b) => b.currentRevision - a.currentRevision);
      result.push({ sheetId, versions });
    });
    result.sort((a, b) => a.versions[0].no.localeCompare(b.versions[0].no));

    return result;
  }, [drawings, sheetNumberFilter, sheetNameFilter, authorFilter, disciplineFilter]);

  const toggleGroup = (sheetId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(sheetId)) next.delete(sheetId);
      else next.add(sheetId);
      return next;
    });
  };

  const describeError = (error: unknown, fallback: string) => {
    const code = (error as { code?: string })?.code;
    if (code === "23505") {
      return "Someone just uploaded a newer revision — refresh and try again.";
    }
    return error instanceof Error ? error.message : fallback;
  };

  const handleAdd = (input: NewDrawingInput) => {
    createShopDrawing.mutate(
      {
        project,
        discipline: input.discipline,
        sheetNo: input.no,
        sheetName: input.name,
        author: user?.email ?? null,
        pdfFile: input.pdfFile,
        createdBy: user?.id ?? null,
      },
      {
        onSuccess: () => setNote(`Added ${input.no} — ${input.name}.`),
        onError: (error) => setNote(describeError(error, "Failed to add drawing.")),
      }
    );
  };

  const handleUpload = (input: UploadRevisionInput) => {
    if (!uploadTarget || !input.pdfFile) return;
    addRevision.mutate(
      {
        project,
        discipline: uploadTarget.discipline,
        sheetNo: uploadTarget.sheetId,
        sheetName: uploadTarget.name,
        author: uploadTarget.author,
        revision: input.revision,
        reason: input.reason,
        pdfFile: input.pdfFile,
        createdBy: user?.id ?? null,
      },
      {
        onSuccess: () => setNote(`Uploaded Rev ${input.revision} for ${uploadTarget.no}.`),
        onError: (error) => setNote(describeError(error, "Failed to upload revision.")),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteTarget || !deleteTarget.pdfPath) return;
    deleteShopDrawing.mutate(
      { projectId: project.id, id: deleteTarget.id, pdfPath: deleteTarget.pdfPath },
      {
        onSuccess: () => setNote(`Deleted ${deleteTarget.no} - ${deleteTarget.name}.`),
        onError: (error) => setNote(describeError(error, "Failed to delete drawing.")),
      }
    );
  };

  const handleView = (drawing: ShopDrawing) => {
    if (!drawing.pdfUrl) return;
    setViewerTarget(drawing);
  };

  const handleDownload = (drawing: ShopDrawing) => {
    if (!drawing.pdfUrl) return;
    const link = document.createElement("a");
    link.href = drawing.pdfUrl;
    link.download = `${drawing.no}_Rev${drawing.currentRevision}.pdf`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCompare = (group: GroupedDrawing) => {
    const withPdf = group.versions.filter((v) => v.pdfUrl);
    if (withPdf.length < 2) {
      setNote("Need at least 2 versions with PDFs to compare.");
      return;
    }
    setCompareGroup(group);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {note && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-surface-alt border border-border rounded-radius text-xs text-muted">
          <span>{note}</span>
          <button onClick={() => setNote(null)} type="button" className="text-muted hover:text-fg cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-muted text-sm font-bold tracking-wider uppercase">
          Shop Drawing Register ({groupedDrawings.length} sheets)
        </h3>
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            type="button"
            className="inline-flex items-center gap-1.5 min-h-8 px-3 py-1.5 rounded-radius bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Drawing
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 overflow-x-auto">
          <table className="w-full border-collapse text-fg text-[13px]">
            <thead>
              <tr className="border-b border-border-strong">
                <th className="sticky top-0 z-1 w-8 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong" />
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">No.</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Name</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Discipline</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Date/Time</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Author</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Revision</th>
                <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-4 py-8 text-muted text-sm text-center" colSpan={8}>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
                      <span>Loading shop drawings...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && groupedDrawings.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-muted text-sm text-center" colSpan={8}>
                    No shop drawings match the current filters.
                  </td>
                </tr>
              )}
              {!isLoading &&
                groupedDrawings.map((group) => {
                  const latest = group.versions[0];
                  const hasMultiple = group.versions.length > 1;
                  const isExpanded = expandedGroups.has(group.sheetId);
                  const comparable = group.versions.filter((v) => v.pdfUrl).length >= 2;

                  return (
                    <Fragment key={group.sheetId}>
                      <tr
                        className="hover:bg-[oklch(18%_0.02_255)] transition-colors duration-120 border-b border-border/60 cursor-pointer"
                        onClick={() => hasMultiple && toggleGroup(group.sheetId)}
                      >
                        <td className="px-4 py-3">
                          {hasMultiple && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup(group.sheetId);
                              }}
                              className="text-muted hover:text-fg cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold">{latest.no}</td>
                        <td className="px-4 py-3 text-accent">{latest.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">{latest.discipline}</td>
                        <td className="px-4 py-3 font-mono text-sm">{format(new Date(latest.lastUpdated), "yyyy-MM-dd HH:mm")}</td>
                        <td className="px-4 py-3">{latest.author || "-"}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-accent">{latest.currentRevision}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <RowIconButton
                              title={latest.pdfUrl ? "View PDF" : "No PDF available"}
                              disabled={!latest.pdfUrl}
                              onClick={() => handleView(latest)}
                            >
                              <Search className="w-4 h-4" />
                            </RowIconButton>
                            <RowIconButton
                              title={latest.pdfUrl ? "Download PDF" : "No PDF available"}
                              disabled={!latest.pdfUrl}
                              onClick={() => handleDownload(latest)}
                            >
                              <Download className="w-4 h-4" />
                            </RowIconButton>
                            <RowIconButton
                              title={comparable ? "Compare versions" : "Need at least 2 versions with PDFs"}
                              disabled={!comparable}
                              onClick={() => handleCompare(group)}
                            >
                              <GitCompareArrows className="w-4 h-4" />
                            </RowIconButton>
                            {isAdmin && (
                              <>
                                <RowIconButton title="Upload PDF / Add Revision" onClick={() => setUploadTarget(latest)}>
                                  <Upload className="w-4 h-4" />
                                </RowIconButton>
                                <RowIconButton title="Delete drawing" danger onClick={() => setDeleteTarget(latest)}>
                                  <Trash2 className="w-4 h-4" />
                                </RowIconButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded &&
                        group.versions.slice(1).map((version) => (
                          <tr key={version.id} className="border-b border-border/40 bg-[oklch(11%_0.014_255)]">
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2 pl-8 text-muted">{version.no}</td>
                            <td className="px-4 py-2 text-muted">{version.name}</td>
                            <td className="px-4 py-2 font-mono text-xs text-muted">{version.discipline}</td>
                            <td className="px-4 py-2 font-mono text-xs text-muted">
                              {format(new Date(version.lastUpdated), "yyyy-MM-dd HH:mm")}
                            </td>
                            <td className="px-4 py-2 text-muted">{version.author || "-"}</td>
                            <td className="px-4 py-2 font-mono text-muted">{version.currentRevision}</td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <RowIconButton
                                  title={version.pdfUrl ? "View PDF" : "No PDF available"}
                                  disabled={!version.pdfUrl}
                                  onClick={() => handleView(version)}
                                  small
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </RowIconButton>
                                <RowIconButton
                                  title={version.pdfUrl ? "Download PDF" : "No PDF available"}
                                  disabled={!version.pdfUrl}
                                  onClick={() => handleDownload(version)}
                                  small
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </RowIconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-1 h-fit flex flex-col gap-4 p-4 bg-surface border border-border rounded-radius">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Sheet number
            <input
              value={sheetNumberFilter}
              onChange={(e) => setSheetNumberFilter(e.target.value)}
              placeholder="Filter by number..."
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Sheet name
            <input
              value={sheetNameFilter}
              onChange={(e) => setSheetNameFilter(e.target.value)}
              placeholder="Filter by name..."
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Author
            <input
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              placeholder="Filter by author..."
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Discipline
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value as DisciplineCode | "")}
              className="h-9 px-3 text-xs bg-surface-alt border border-border rounded-radius text-fg focus:outline-none focus:border-accent transition-colors"
            >
              <option value="">All</option>
              {DISCIPLINES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.value} — {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <AddDrawingDialog isOpen={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} authorEmail={user?.email ?? ""} />

      <UploadPdfDialog
        isOpen={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        drawing={uploadTarget}
        onUpload={handleUpload}
      />

      <DeleteDrawingDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        drawing={deleteTarget}
        onConfirm={handleDelete}
      />

      {compareGroup && (
        <CompareDrawingsModal
          isOpen={!!compareGroup}
          onClose={() => setCompareGroup(null)}
          drawingNo={compareGroup.versions[0].no}
          versions={compareGroup.versions}
        />
      )}

      <PdfViewerModal
        isOpen={!!viewerTarget}
        onClose={() => setViewerTarget(null)}
        title={viewerTarget ? `${viewerTarget.no} - ${viewerTarget.name} (Rev ${viewerTarget.currentRevision})` : ""}
        pdfUrl={viewerTarget?.pdfUrl ?? null}
      />
    </div>
  );
}

interface RowIconButtonProps {
  title: string;
  disabled?: boolean;
  danger?: boolean;
  small?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function RowIconButton({ title, disabled, danger, small, onClick, children }: RowIconButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-radius transition-colors ${small ? "w-7 h-7" : "w-8 h-8"} ${
        disabled
          ? "text-muted/40 cursor-not-allowed"
          : danger
            ? "text-status-danger hover:bg-status-danger/10 cursor-pointer"
            : "text-accent hover:bg-accent/10 cursor-pointer"
      }`}
    >
      {children}
    </button>
  );
}
