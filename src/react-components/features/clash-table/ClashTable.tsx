import { useMemo } from "react";
import { format } from "date-fns";
import { useClashStore } from "@/react-components/store/clashStore";
import { useClashViewpoints } from "@/react-components/features/clash-dashboard/useClashViewpoints";
import { Icon } from "@/react-components/components/ui/Icon";
import { useClashTable } from "./useClashTable";
import type { ClashItem } from "@/types";

interface ClashTableProps {
  projectId: string;
}

const statusLabelMap: Record<ClashItem["status"], string> = {
  new: "NEW",
  unresolved: "UNRESOLVED",
  resolved: "RESOLVED",
  approved_as_note: "APPROVED AS NOTE",
};

const typeLabelMap: Record<ClashItem["type"], string> = {
  major: "MAJOR",
  minor: "MINOR",
  regulation: "REGULATION",
};

const typeDotClassMap: Record<ClashItem["type"], string> = {
  major: "bg-status-danger ring-status-danger/20",
  minor: "bg-status-warn ring-status-warn/20",
  regulation: "bg-muted ring-muted/20",
};

interface Column {
  key: string;
  label: string;
}

const COLUMNS: Column[] = [
  { key: "id", label: "ID" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "type", label: "Type" },
  { key: "assignedTo", label: "Assigned to" },
  { key: "dueDate", label: "Due date" },
  { key: "startDate", label: "Start date" },
  { key: "guid", label: "GUID" },
  { key: "path", label: "Path" },
  { key: "createdBy", label: "Created By" },
];

export function ClashTable({ projectId }: ClashTableProps) {
  const { selectedReportId, quickFilters, selectedClashId, setSelectedClashId } = useClashStore();
  const { data: clashItems = [], isLoading: isLoadingClashes } = useClashViewpoints(projectId, selectedReportId);

  const filteredClashes = useMemo(() => {
    return clashItems.filter((item) => {
      if (quickFilters.onlyCritical && item.type !== "major") {
        return false;
      }
      if (quickFilters.unassigned && item.createdBy !== null) {
        return false;
      }
      if (quickFilters.arcVsMep) {
        const text = `${item.name || ""} ${item.path || ""}`.toLowerCase();
        const hasArchitecture = text.includes("ar") || text.includes("arc");
        const hasMep = text.includes("me") || text.includes("mep");
        if (!(hasArchitecture && hasMep)) {
          return false;
        }
      }
      return true;
    });
  }, [clashItems, quickFilters]);

  const {
    selectedRowIds,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    visibleColumns,
    toggleColumn,
    columnWidths,
    startResize,
    isSettingsOpen,
    setIsSettingsOpen,
    toggleSelectRow,
    toggleSelectAll,
    handleBulkDelete,
    handleExportCSV,
    paginatedClashes,
    totalPages,
    totalCount,
    selectionCount,
  } = useClashTable(projectId, filteredClashes);

  const allVisibleSelected =
    paginatedClashes.length > 0 && paginatedClashes.every((item) => selectedRowIds.has(item.id));

  const renderCell = (item: (typeof paginatedClashes)[number], key: string) => {
    switch (key) {
      case "id":
        return <span className="font-mono text-muted">#{item.seqId}</span>;
      case "title":
        return (
          <span className="text-fg font-medium w-full truncate inline-block align-middle" title={item.name}>
            {item.name}
          </span>
        );
      case "status": {
        const statusLabel = statusLabelMap[item.status] || item.status;
        const statusToneClasses =
          item.status === "new"
            ? "border-[oklch(63%_0.18_28_/_42%)] bg-[oklch(63%_0.18_28_/_13%)] text-status-danger"
            : item.status === "unresolved"
              ? "border-[oklch(77%_0.14_76_/_42%)] bg-[oklch(77%_0.14_76_/_13%)] text-status-warn"
              : "border-[oklch(70%_0.14_150_/_42%)] bg-[oklch(70%_0.14_150_/_13%)] text-status-ok";
        return (
          <span
            className={`inline-flex items-center min-h-5 px-2.5 py-0.5 border rounded-full text-[10px] font-bold tracking-wider uppercase ${statusToneClasses}`}
          >
            {statusLabel}
          </span>
        );
      }
      case "type": {
        const typeLabel = typeLabelMap[item.type] || item.type;
        return (
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ring-[3px] ${typeDotClassMap[item.type]}`} />
            <span className="text-fg">{typeLabel}</span>
          </div>
        );
      }
      case "assignedTo":
        return <span className="text-muted">-</span>;
      case "dueDate":
        return <span className="text-muted">-</span>;
      case "startDate":
        return <span className="font-mono text-sm text-muted">{format(new Date(item.occurredAt), "MMM d, yyyy")}</span>;
      case "guid":
        return (
          <span className="font-mono text-sm text-muted" title={item.guid}>
            {item.guid}
          </span>
        );
      case "path":
        return (
          <span className="text-fg w-full truncate inline-block align-middle" title={item.path || "(root)"}>
            {item.path || "(root)"}
          </span>
        );
      case "createdBy":
        return <span className="text-muted">{item.createdBy ? "Project Member" : "-"}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden pt-0 px-6 pb-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold text-white bg-gradient-to-b from-[oklch(62%_0.19_262)] to-[oklch(52%_0.19_262)] hover:brightness-110 transition-all shadow-sm"
            onClick={() => window.alert("Create issue")}
          >
            <Icon name="ADD" size={16} />
            Create issue
            <Icon name="CHEVRON_DOWN" size={14} />
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              selectionCount === 0
                ? "text-muted pointer-events-none opacity-40"
                : "text-fg hover:bg-[oklch(18%_0.02_255)]"
            }`}
            onClick={() => window.alert(`Edit ${selectionCount} clash(es)`)}
          >
            <Icon name="EDIT" size={16} />
            Edit ({selectionCount})
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
              selectionCount === 0
                ? "text-muted pointer-events-none opacity-40"
                : "text-status-danger hover:bg-status-danger/10"
            }`}
            onClick={handleBulkDelete}
          >
            <Icon name="DELETE" size={16} />
            Delete ({selectionCount})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted hover:bg-[oklch(18%_0.02_255)] hover:text-fg transition-colors"
            title="Split map view"
          >
            <Icon name="MAP_SPLIT" size={16} />
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-strong text-[13px] font-medium text-fg hover:bg-[oklch(18%_0.02_255)] transition-colors"
            onClick={handleExportCSV}
          >
            <Icon name="EXPORT" size={16} />
            Export ({selectionCount > 0 ? selectionCount : totalCount})
          </button>
          <div className="relative flex items-center">
            <Icon name="SEARCH" size={16} className="absolute left-2.5 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Title, ID, or description"
              className="pl-8 pr-3 py-1.5 w-56 rounded-md border border-border-strong bg-[oklch(12.5%_0.016_255)] text-[13px] text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted hover:bg-[oklch(18%_0.02_255)] hover:text-fg transition-colors"
            title="Filter"
          >
            <Icon name="FILTER" size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="table-fixed min-w-max w-full border-collapse text-fg text-[13px]">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong" style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="cursor-pointer"
                />
              </th>
              {COLUMNS.filter((col) => visibleColumns.has(col.key)).map((col) => (
                <th
                  key={col.key}
                  className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-muted text-[11px] font-bold tracking-wider text-left uppercase relative"
                  style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined }}
                >
                  {col.label}
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-accent/40 active:bg-accent select-none z-10 transition-colors"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startResize(col.key, e);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
              <th className="sticky top-0 z-1 px-4 py-3 bg-[oklch(12.5%_0.016_255)] border-b border-border-strong text-right relative" style={{ width: 50 }}>
                <button
                  type="button"
                  className="flex items-center justify-center w-6 h-6 rounded text-muted hover:bg-[oklch(18%_0.02_255)] hover:text-fg transition-colors ml-auto"
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                >
                  <Icon name="SETTINGS" size={16} />
                </button>
                {isSettingsOpen && (
                  <div className="absolute right-4 top-10 z-10 w-48 rounded-md border border-border-strong bg-[oklch(14%_0.018_255)] shadow-lg py-1 normal-case font-normal text-left">
                    {COLUMNS.map((col) => (
                      <button
                        type="button"
                        key={col.key}
                        className="flex items-center justify-between w-full px-3 py-1.5 text-[13px] text-fg hover:bg-[oklch(18%_0.02_255)]"
                        onClick={() => toggleColumn(col.key)}
                      >
                        <span>{col.label}</span>
                        {visibleColumns.has(col.key) && <Icon name="CHECK" size={14} />}
                      </button>
                    ))}
                  </div>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoadingClashes && (
              <tr>
                <td className="px-4 py-8 text-muted text-sm text-center" colSpan={COLUMNS.length + 2}>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
                    <span>Loading clashes...</span>
                  </div>
                </td>
              </tr>
            )}
            {!isLoadingClashes && paginatedClashes.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-muted text-sm text-center" colSpan={COLUMNS.length + 2}>
                  No clashes match the selected criteria.
                </td>
              </tr>
            )}
            {!isLoadingClashes &&
              paginatedClashes.map((item) => {
                const isActive = item.id === selectedClashId;
                const isChecked = selectedRowIds.has(item.id);

                return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer transition-colors duration-120 border-b border-border/60 hover:bg-[oklch(18%_0.02_255)] ${
                      isActive
                        ? "bg-[oklch(22%_0.03_252)] border-l-2 border-l-accent"
                        : isChecked
                        ? "bg-[oklch(18%_0.02_255)]"
                        : ""
                    }`}
                    onClick={() => setSelectedClashId(item.id)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelectRow(item.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    {COLUMNS.filter((col) => visibleColumns.has(col.key)).map((col) => (
                      <td key={col.key} className="px-4 py-3 truncate overflow-hidden whitespace-nowrap">
                        {renderCell(item, col.key)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="flex items-center justify-center w-6 h-6 rounded text-muted hover:bg-[oklch(22%_0.03_252)] hover:text-fg transition-colors ml-auto"
                      >
                        <Icon name="CONTEXT" size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between py-3 border-t border-border-strong text-[13px] text-muted">
        <span>
          {selectionCount} of {totalCount} selected
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
            className="flex items-center justify-center w-7 h-7 rounded text-fg hover:bg-[oklch(18%_0.02_255)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            «
          </button>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="flex items-center justify-center w-7 h-7 rounded text-fg hover:bg-[oklch(18%_0.02_255)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            ‹
          </button>
          <span className="px-2 text-fg">
            {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="flex items-center justify-center w-7 h-7 rounded text-fg hover:bg-[oklch(18%_0.02_255)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            ›
          </button>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="flex items-center justify-center w-7 h-7 rounded text-fg hover:bg-[oklch(18%_0.02_255)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}
