import React, { useState } from "react";
import { Copy, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { usePropertyPanel } from "./usePropertyPanel";

interface PropertyPanelProps {
  searchQuery?: string;
}

export function PropertyPanel() {
  const {
    isLoading,
    error,
    propertyGroups,
    totalSelectedCount,
    currentIndex,
    goNext,
    goPrev,
    goFirst,
    goLast,
  } = usePropertyPanel();
  const [localSearch, setLocalSearch] = useState("");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  const handleCopy = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedValue(val);
      setTimeout(() => setCopiedValue(null), 1500);
    } catch (e) {
      console.warn("Copy to clipboard failed", e);
    }
  };

  if (totalSelectedCount === 0) {
    return (
      <div className="mx-4 my-4 flex flex-col items-center justify-center min-h-[140px] text-center p-4 bg-surface/30 rounded-radius border border-border">
        <p className="text-muted text-xs leading-relaxed max-w-[200px]">
          Select an item in the viewport to view detailed BIM metadata.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 w-full">
        <PropertyPanelSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-4 my-4 p-3 bg-status-danger/10 border border-status-danger/20 text-status-danger rounded-radius text-xs flex flex-col gap-1">
        <p className="font-semibold">Error Loading Properties</p>
        <p className="opacity-90">{error}</p>
      </div>
    );
  }

  // Filter groups by local search query
  const q = localSearch.trim().toLowerCase();
  const filteredGroups = q
    ? propertyGroups
        .map((g) => ({
          ...g,
          rows: g.rows.filter(
            (r) =>
              r.key.toLowerCase().includes(q) ||
              r.value.toLowerCase().includes(q)
          ),
        }))
        .filter((g) => g.rows.length > 0)
    : propertyGroups;

  return (
    <div className="flex flex-col text-xs w-full max-h-[85vh] min-h-0 bg-surface/10">
      
      {/* Navisworks Style Selection Pagination Toolbar */}
      <div className="flex items-center gap-3 py-1.5 px-4 bg-surface-alt/30 border-b border-border text-xs shrink-0 select-none justify-start">
        <div className="flex items-center gap-1">
          <button
            onClick={goFirst}
            disabled={currentIndex === 0}
            className="p-1 hover:bg-surface-alt rounded text-muted hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            type="button"
            title="First element"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="p-1 hover:bg-surface-alt rounded text-muted hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            type="button"
            title="Previous element"
          >
            <ChevronLeft size={13} />
          </button>
        </div>

        <span className="font-mono text-xs text-muted-2 font-semibold">
          {currentIndex + 1} / {totalSelectedCount}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={goNext}
            disabled={currentIndex === totalSelectedCount - 1}
            className="p-1 hover:bg-surface-alt rounded text-muted hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            type="button"
            title="Next element"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={goLast}
            disabled={currentIndex === totalSelectedCount - 1}
            className="p-1 hover:bg-surface-alt rounded text-muted hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            type="button"
            title="Last element"
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>

      {/* Search and Settings Toolbar Row */}
      <div className="flex items-center gap-1.5 p-2 bg-surface-alt/45 border-b border-border shrink-0 select-none">
        {/* Search Bar Input */}
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-0 bg-bg border border-border focus:border-accent hover:border-border-strong rounded px-2.5 py-1 text-xs text-fg placeholder-muted-2 outline-none transition-colors duration-120"
        />

        {/* Setting Gear Icon */}
        <button
          className="p-1.5 bg-bg hover:bg-surface border border-border hover:border-border-strong rounded text-muted hover:text-fg cursor-pointer transition-colors duration-120 flex items-center justify-center shrink-0"
          type="button"
          title="Properties Settings"
        >
          <Settings size={13} />
        </button>
      </div>

      {/* Main Table Grid (Flush edge-to-edge) */}
      {filteredGroups.length === 0 && propertyGroups.length > 0 ? (
        <div className="mx-4 my-4 text-center py-6 text-muted text-xs italic bg-surface/20 rounded border border-border/50">
          No properties match "{localSearch}"
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0 w-full bg-surface/5">
          {/* Table Header Row */}
          <div className="grid grid-cols-[1.2fr_1.5fr_auto] border-b border-border bg-surface-alt/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted shrink-0 select-none">
            <span>Property</span>
            <span>Value</span>
            <span className="w-5"></span>
          </div>

          {/* Table Body Scroll Container */}
          <div className="overflow-y-auto flex-1 divide-y divide-border/20">
            {filteredGroups.map((group) => (
              <div key={group.title} className="flex flex-col">
                {/* Category Header Row */}
                <div className="bg-surface-alt/25 border-y border-border/15 px-4 py-0.5 text-[11px] font-bold text-accent-2 select-none uppercase tracking-wide">
                  {group.title}
                </div>

                {/* Property Rows */}
                <div className="divide-y divide-border/10">
                  {group.rows.map((row) => (
                    <div
                      key={row.key}
                      className="group/row grid grid-cols-[1.2fr_1.5fr_auto] items-center gap-3 px-4 py-1 hover:bg-surface-alt/25 min-h-[25px] transition-colors"
                    >
                      <span
                        className="text-muted text-[11px] font-medium truncate"
                        title={row.key}
                      >
                        {row.key}
                      </span>
                      <span
                        className="font-mono text-[11px] text-fg truncate select-all"
                        title={row.value}
                      >
                        {row.value}
                      </span>
                      <button
                        onClick={() => handleCopy(row.value)}
                        className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted hover:text-fg hover:bg-surface-alt rounded transition-all duration-120 cursor-pointer shrink-0"
                        type="button"
                        title="Copy value"
                      >
                        {copiedValue === row.value ? (
                          <Check size={11} className="text-accent-2" />
                        ) : (
                          <Copy size={11} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyPanelSkeleton() {
  return (
    <div className="border border-border/30 rounded-radius overflow-hidden bg-surface/10 animate-pulse w-full flex flex-col">
      <div className="h-8 bg-surface-alt/50 px-3 py-2 flex items-center justify-between border-b border-border/20">
        <div className="h-3 bg-surface-alt rounded w-1/4" />
        <div className="h-3 bg-surface-alt rounded w-1/3" />
      </div>
      <div className="space-y-4 p-3">
        {[1, 2].map((n) => (
          <div key={n} className="space-y-2">
            <div className="h-4 bg-surface-alt/30 rounded w-1/5" />
            <div className="space-y-1.5 pl-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between py-1">
                  <div className="h-3 bg-surface-alt/20 rounded w-1/3" />
                  <div className="h-3 bg-surface-alt/20 rounded w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
