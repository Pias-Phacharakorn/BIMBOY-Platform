import { useState, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import type { ClashItem, ClashStatus, ClashType } from "@/types";
import { useDeleteClashViewpoints, useBulkUpdateClashViewpoints } from "../clash-dashboard/useClashViewpoints";
import { getClashSeqId } from "../clash-dashboard/clashDisplayHelpers";

export function useClashTable(projectId: string, clashItems: ClashItem[]) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(["id", "title", "status", "type", "assignedTo", "dueDate", "startDate"])
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    id: 50,
    title: 240,
    status: 120,
    type: 130,
    assignedTo: 120,
    dueDate: 120,
    startDate: 120,
    guid: 180,
    path: 180,
    createdBy: 130,
  });

  const deleteMutation = useDeleteClashViewpoints();
  const bulkUpdateMutation = useBulkUpdateClashViewpoints();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Assign sequential stable IDs to items based on their position in the fetched array (newest to oldest)
  const itemsWithSeqId = useMemo(() => {
    return clashItems.map((item, index) => ({
      ...item,
      seqId: getClashSeqId(clashItems, index),
    }));
  }, [clashItems]);

  // Apply search query filter (matches name/title or seqId)
  const searchedClashes = useMemo(() => {
    if (!searchQuery.trim()) return itemsWithSeqId;
    const query = searchQuery.toLowerCase().trim();
    return itemsWithSeqId.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(query);
      const idMatch = `#${item.seqId}`.includes(query) || item.seqId.toString().includes(query);
      return nameMatch || idMatch;
    });
  }, [itemsWithSeqId, searchQuery]);

  // Pagination logic: 25 items per page
  const itemsPerPage = 25;
  const totalPages = Math.max(1, Math.ceil(searchedClashes.length / itemsPerPage));
  
  // Adjust current page if out of bounds
  const activePage = Math.min(currentPage, totalPages);

  const paginatedClashes = useMemo(() => {
    const start = (activePage - 1) * itemsPerPage;
    return searchedClashes.slice(start, start + itemsPerPage);
  }, [searchedClashes, activePage]);

  // Selection helpers
  const toggleSelectRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select only the currently visible searched items
      setSelectedRowIds(new Set(searchedClashes.map((item) => item.id)));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const startResize = (columnKey: string, e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[columnKey] ?? 120;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [columnKey]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${ids.length} selected clash(es)?`)) {
      try {
        await deleteMutation.mutateAsync(ids);
        setSelectedRowIds(new Set());
      } catch (err) {
        console.error("Bulk delete failed", err);
      }
    }
  };

  const openEditModal = () => {
    if (selectedRowIds.size === 0) return;
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleBulkEditApply = async (updates: { status?: ClashStatus; type?: ClashType }) => {
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0 || (updates.status === undefined && updates.type === undefined)) return;
    try {
      await bulkUpdateMutation.mutateAsync({ ids, updates });
      setSelectedRowIds(new Set());
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Bulk edit failed", err);
    }
  };

  const handleExportCSV = () => {
    const targets = selectedRowIds.size > 0 ? searchedClashes.filter(c => selectedRowIds.has(c.id)) : searchedClashes;
    if (targets.length === 0) return;

    const headers = ["ID", "Title", "Status", "Type", "Assigned To", "Due Date", "Start Date", "GUID", "Path", "Created By"];
    const rows = targets.map((item) => [
      `#${item.seqId}`,
      item.name,
      item.status,
      item.type,
      "-",
      "-",
      new Date(item.occurredAt).toLocaleDateString(),
      item.guid,
      item.path || "(root)",
      item.createdBy ? "Project Member" : "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `clashes_export_${projectId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    selectedRowIds,
    searchQuery,
    setSearchQuery,
    currentPage: activePage,
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
    isEditModalOpen,
    openEditModal,
    closeEditModal,
    handleBulkEditApply,
    isBulkEditSubmitting: bulkUpdateMutation.isPending,
    paginatedClashes,
    totalPages,
    totalCount: searchedClashes.length,
    selectionCount: selectedRowIds.size,
  };
}
