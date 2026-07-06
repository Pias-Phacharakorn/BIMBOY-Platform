import { useState } from "react";
import { format } from "date-fns";
import {
  Folder,
  FolderOpen,
  FileText,
  Plus,
  Search,
  Download,
  GitCompareArrows,
  Upload,
  FileDown,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppProject } from "@/types";
import { RowActionsMenu, type RowAction } from "@/react-components/components/shop-drawings/RowActionsMenu";
import { AddDrawingDialog } from "@/react-components/components/shop-drawings/AddDrawingDialog";
import { UploadPdfDialog, type UploadRevisionInput } from "@/react-components/components/shop-drawings/UploadPdfDialog";
import { PdfViewerModal } from "@/react-components/components/shop-drawings/PdfViewerModal";
import { CompareDrawingsModal } from "@/react-components/components/shop-drawings/CompareDrawingsModal";
import { shopDrawingsService, type ShopDrawingRow } from "./shopDrawingsService";
import { mapShopDrawingRow } from "./shopDrawingTypes";
import { useGroupedShopDrawings, sheetKey, type SheetBucket } from "./useGroupedShopDrawings";
import { useShopDrawingActions } from "./useShopDrawingActions";
import type { DisciplineCode } from "./disciplines";

interface DrawingFolderExplorerProps {
  project: AppProject;
  isAdmin: boolean;
}

type Selection =
  | { level: "discipline"; discipline: DisciplineCode }
  | { level: "sheet"; discipline: DisciplineCode; sheetNo: string };

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (cell: string | number) => {
    const str = String(cell);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DrawingFolderExplorer({ project, isAdmin }: DrawingFolderExplorerProps) {
  const { groupedByDiscipline, loading, error } = useGroupedShopDrawings(project.id);
  const { handleAddDrawing, handleUploadRevision, handleDownload, authorEmail } = useShopDrawingActions(project);

  const [expandedDisciplines, setExpandedDisciplines] = useState<Set<DisciplineCode>>(new Set());
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [addDrawingOpen, setAddDrawingOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<ShopDrawingRow | null>(null);
  const [viewerTarget, setViewerTarget] = useState<ShopDrawingRow | null>(null);
  const [compareSheet, setCompareSheet] = useState<SheetBucket | null>(null);

  const selectDiscipline = (discipline: DisciplineCode) => {
    setExpandedDisciplines((prev) => {
      const next = new Set(prev);
      if (next.has(discipline)) next.delete(discipline);
      else next.add(discipline);
      return next;
    });
    setSelection({ level: "discipline", discipline });
    setSearchQuery("");
  };

  const selectSheet = (discipline: DisciplineCode, sheetNo: string) => {
    const key = sheetKey(discipline, sheetNo);
    setExpandedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSelection({ level: "sheet", discipline, sheetNo });
    setSearchQuery("");
  };

  const selectedDisciplineGroup =
    selection && groupedByDiscipline.find((d) => d.code === selection.discipline) ? groupedByDiscipline.find((d) => d.code === selection.discipline)! : null;
  const selectedSheet =
    selection?.level === "sheet" ? selectedDisciplineGroup?.sheets.find((s) => s.sheetNo === selection.sheetNo) ?? null : null;

  const query = searchQuery.trim().toLowerCase();
  const filteredSheets =
    selection?.level === "discipline" && selectedDisciplineGroup
      ? selectedDisciplineGroup.sheets.filter((sheet) => !query || `${sheet.sheetNo}_${sheet.sheetName}`.toLowerCase().includes(query))
      : [];
  const sortedRevisions = selectedSheet ? [...selectedSheet.versions].sort((a, b) => b.revision - a.revision) : [];
  const filteredRevisions = sortedRevisions.filter(
    (row) => !query || `Rev ${row.revision} ${row.author ?? ""} ${row.reason ?? ""}`.toLowerCase().includes(query)
  );

  const handleUploadRevisionSubmit = (input: UploadRevisionInput) => {
    if (!uploadTarget) return;
    handleUploadRevision(uploadTarget, input);
  };

  const handleExport = () => {
    if (selection?.level === "discipline" && selectedDisciplineGroup) {
      const rows = filteredSheets.map((sheet) => {
        const latest = sheet.versions[sheet.versions.length - 1];
        return [`${sheet.sheetNo}_${sheet.sheetName}`, latest.author ?? "", `Rev ${latest.revision}`, latest.uploaded_at];
      });
      downloadCsv(`drawing-register-${selectedDisciplineGroup.code}.csv`, ["Name", "Author", "Version", "Last Updated"], rows);
    } else if (selection?.level === "sheet" && selectedSheet) {
      const rows = filteredRevisions.map((row) => [`Rev ${row.revision}`, row.author ?? "", row.reason ?? "", row.uploaded_at]);
      downloadCsv(`drawing-register-${selectedSheet.sheetNo}.csv`, ["Revision", "Author", "Reason", "Last Updated"], rows);
    }
  };

  return (
    <div className="flex gap-4 w-full h-[70vh] min-h-[420px] text-fg">
      {/* Tree: discipline -> sheet -> revision */}
      <div className="w-72 shrink-0 border border-border bg-surface/94 rounded-radius overflow-y-auto flex flex-col gap-0.5 p-2">
        <div className="px-2 py-1.5 text-[11px] font-bold tracking-wider uppercase text-muted">Disciplines</div>
        {groupedByDiscipline.map((discipline) => {
          const isDisciplineExpanded = expandedDisciplines.has(discipline.code);
          const isDisciplineSelected = selection?.level === "discipline" && selection.discipline === discipline.code;

          return (
            <div key={discipline.code} className="flex flex-col">
              <button
                type="button"
                onClick={() => selectDiscipline(discipline.code)}
                title={discipline.label}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-2 rounded-radius text-left text-[13px] font-mono transition-colors duration-120 cursor-pointer",
                  isDisciplineSelected ? "bg-accent/15 text-accent font-semibold" : "hover:bg-surface-alt text-fg"
                )}
              >
                {isDisciplineExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                {isDisciplineExpanded ? <FolderOpen className="w-4 h-4 shrink-0" /> : <Folder className="w-4 h-4 shrink-0" />}
                <span className="flex-1 truncate">{discipline.code}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-raised border border-border text-muted shrink-0">
                  {discipline.sheets.length}
                </span>
              </button>

              {isDisciplineExpanded && (
                <div className="ml-3 pl-2 border-l border-border/40 flex flex-col gap-0.5 mt-0.5">
                  {discipline.sheets.map((sheet) => {
                    const key = sheetKey(discipline.code, sheet.sheetNo);
                    const isSheetExpanded = expandedSheets.has(key);
                    const isSheetSelected =
                      selection?.level === "sheet" && selection.discipline === discipline.code && selection.sheetNo === sheet.sheetNo;

                    return (
                      <div key={key} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => selectSheet(discipline.code, sheet.sheetNo)}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5 rounded-radius text-left text-[12px] font-mono transition-colors duration-120 cursor-pointer min-w-0",
                            isSheetSelected ? "bg-accent/15 text-accent font-semibold" : "hover:bg-surface-alt text-fg"
                          )}
                        >
                          {isSheetExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                          {isSheetExpanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />}
                          <span className="flex-1 truncate">{sheet.sheetNo}_{sheet.sheetName}</span>
                          <span className="text-[9px] px-1 py-0.5 rounded-full bg-surface-raised border border-border text-muted shrink-0">
                            {sheet.versions.length}
                          </span>
                        </button>

                        {isSheetExpanded && (
                          <div className="ml-3 pl-2 border-l border-border/40 flex flex-col gap-0.5 mt-0.5">
                            {[...sheet.versions]
                              .sort((a, b) => b.revision - a.revision)
                              .map((row) => (
                                <button
                                  key={row.id}
                                  type="button"
                                  onClick={() => setViewerTarget(row)}
                                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-radius text-left text-[11.5px] font-mono text-muted hover:bg-surface-alt hover:text-fg transition-colors duration-120 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span className="truncate">Rev {row.revision}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Table: mirrors tree selection depth */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">
        {!selection && (
          <div className="flex-1 flex items-center justify-center text-muted text-sm border border-dashed border-border rounded-radius">
            Select a discipline folder to view its drawings.
          </div>
        )}

        {selection?.level === "discipline" && selectedDisciplineGroup && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-fg font-mono flex items-center gap-2 shrink-0">
                {selectedDisciplineGroup.code}
                <span className="text-muted font-normal text-xs">({filteredSheets.length})</span>
              </h3>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="relative w-56 max-w-full">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sheets..."
                    className="w-full h-8 pl-8 pr-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  title="Export visible rows as CSV"
                  className="inline-flex items-center gap-1.5 min-h-8 px-3 py-1.5 rounded-radius border border-border hover:bg-surface-alt text-fg text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setAddDrawingOpen(true)}
                    className="inline-flex items-center gap-1.5 min-h-8 px-3 py-1.5 rounded-radius bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Drawing
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto border border-border rounded-radius">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border-strong">
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Name</th>
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Author</th>
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Version</th>
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Last updated</th>
                    <th className="sticky top-0 z-1 w-12 px-4 py-3 bg-bg border-b border-border-strong" />
                  </tr>
                </thead>
                <tbody>
                  {loading && selectedDisciplineGroup.sheets.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-muted text-sm text-center" colSpan={5}>
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-accent" />
                          <span>Loading shop drawings...</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {error && (
                    <tr>
                      <td className="px-4 py-3" colSpan={5}>
                        <div className="text-status-danger py-1 px-2 border border-status-danger/20 bg-status-danger/10 rounded-radius text-xs">
                          {error}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && !error && filteredSheets.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-muted text-sm text-center italic" colSpan={5}>
                        {selectedDisciplineGroup.sheets.length === 0
                          ? `No shop drawings yet in ${selectedDisciplineGroup.code} — add one above.`
                          : "No sheets match your search."}
                      </td>
                    </tr>
                  )}

                  {filteredSheets.map((sheet) => {
                    const latest = sheet.versions[sheet.versions.length - 1];
                    const key = sheetKey(selectedDisciplineGroup.code, sheet.sheetNo);

                    const actions: RowAction[] = [
                      { key: "view", label: "View", icon: Search, onClick: () => setViewerTarget(latest) },
                      { key: "download", label: "Download", icon: Download, onClick: () => handleDownload(latest) },
                      {
                        key: "compare",
                        label: "Compare Revisions",
                        icon: GitCompareArrows,
                        disabled: sheet.versions.length < 2,
                        title: sheet.versions.length < 2 ? "Need at least 2 revisions to compare" : undefined,
                        onClick: () => setCompareSheet(sheet),
                      },
                      ...(isAdmin
                        ? [
                            {
                              key: "upload",
                              label: "Upload New Revision",
                              icon: Upload,
                              onClick: () => setUploadTarget(latest),
                            },
                          ]
                        : []),
                    ];

                    return (
                      <tr
                        key={key}
                        className="hover:bg-surface-alt transition-colors duration-120 border-b border-border/60 cursor-pointer"
                        onClick={() => setViewerTarget(latest)}
                      >
                        <td className="px-4 py-3 font-mono font-semibold truncate max-w-0">{`${sheet.sheetNo}_${sheet.sheetName}`}</td>
                        <td className="px-4 py-3 text-muted">{latest.author || "-"}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-accent">Rev {latest.revision}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {format(new Date(latest.uploaded_at), "yyyy-MM-dd HH:mm")}
                        </td>
                        <td className="px-2 py-2">
                          <RowActionsMenu actions={actions} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selection?.level === "sheet" && selectedSheet && (
          <>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-fg font-mono flex items-center gap-2 shrink-0 min-w-0">
                <span className="truncate">{selectedSheet.sheetNo}_{selectedSheet.sheetName}</span>
                <span className="text-muted font-normal text-xs shrink-0">({filteredRevisions.length})</span>
              </h3>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <div className="relative w-56 max-w-full">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search revisions..."
                    className="w-full h-8 pl-8 pr-3 text-xs bg-surface-alt border border-border rounded-radius text-fg placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  title="Export visible rows as CSV"
                  className="inline-flex items-center gap-1.5 min-h-8 px-3 py-1.5 rounded-radius border border-border hover:bg-surface-alt text-fg text-xs font-semibold transition-all cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Export
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setUploadTarget(sortedRevisions[0])}
                    className="inline-flex items-center gap-1.5 min-h-8 px-3 py-1.5 rounded-radius bg-accent hover:opacity-90 text-white text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Upload New Revision
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto border border-border rounded-radius">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border-strong">
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Revision</th>
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Author</th>
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Reason</th>
                    <th className="sticky top-0 z-1 px-4 py-3 bg-bg border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase">Last updated</th>
                    <th className="sticky top-0 z-1 w-12 px-4 py-3 bg-bg border-b border-border-strong" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRevisions.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-muted text-sm text-center italic" colSpan={5}>
                        No revisions match your search.
                      </td>
                    </tr>
                  )}

                  {filteredRevisions.map((row) => {
                    const actions: RowAction[] = [
                      { key: "view", label: "View", icon: Search, onClick: () => setViewerTarget(row) },
                      { key: "download", label: "Download", icon: Download, onClick: () => handleDownload(row) },
                    ];

                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-surface-alt transition-colors duration-120 border-b border-border/60 cursor-pointer"
                        onClick={() => setViewerTarget(row)}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-accent">Rev {row.revision}</td>
                        <td className="px-4 py-3 text-muted">{row.author || "-"}</td>
                        <td className="px-4 py-3 text-muted truncate max-w-0">{row.reason || (row.revision === 0 ? "Initial upload" : "-")}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted">
                          {format(new Date(row.uploaded_at), "yyyy-MM-dd HH:mm")}
                        </td>
                        <td className="px-2 py-2">
                          <RowActionsMenu actions={actions} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <AddDrawingDialog
        key={selection?.level === "discipline" ? selection.discipline : "closed"}
        isOpen={addDrawingOpen}
        onClose={() => setAddDrawingOpen(false)}
        onAdd={handleAddDrawing}
        lockedDiscipline={selection?.level === "discipline" ? selection.discipline : undefined}
        authorEmail={authorEmail}
      />

      <UploadPdfDialog
        isOpen={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        drawing={uploadTarget ? mapShopDrawingRow(uploadTarget) : null}
        onUpload={handleUploadRevisionSubmit}
      />

      <PdfViewerModal
        isOpen={!!viewerTarget}
        onClose={() => setViewerTarget(null)}
        title={viewerTarget ? `${viewerTarget.sheet_no} - ${viewerTarget.sheet_name} (Rev ${viewerTarget.revision})` : ""}
        pdfUrl={viewerTarget ? shopDrawingsService.getPdfPublicUrl(viewerTarget.pdf_path) : null}
      />

      {compareSheet && (
        <CompareDrawingsModal
          isOpen={!!compareSheet}
          onClose={() => setCompareSheet(null)}
          drawingNo={compareSheet.sheetNo}
          versions={compareSheet.versions.map(mapShopDrawingRow)}
        />
      )}
    </div>
  );
}
