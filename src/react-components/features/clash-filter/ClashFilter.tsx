import { useClashStore } from "@/react-components/store/clashStore";

export function ClashFilter() {
  const { quickFilters, setQuickFilters } = useClashStore();

  const handleCheckboxChange = (key: keyof typeof quickFilters, checked: boolean) => {
    setQuickFilters({ [key]: checked });
  };

  const handleClearFilters = () => {
    setQuickFilters({
      onlyCritical: false,
      unassigned: false,
      arcVsMep: false,
    });
  };

  const hasActiveFilters =
    quickFilters.onlyCritical || quickFilters.unassigned || quickFilters.arcVsMep;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="text-muted text-[11px] font-bold tracking-wider uppercase">Quick Filters</div>
        
        <label className="flex items-center gap-2.5 text-[13.5px] text-fg cursor-pointer select-none py-0.5">
          <input
            className="w-4 h-4 rounded border-border accent-accent cursor-pointer transition-colors"
            type="checkbox"
            checked={quickFilters.onlyCritical}
            onChange={(e) => handleCheckboxChange("onlyCritical", e.target.checked)}
          />
          <span>Only Critical</span>
        </label>

        <label className="flex items-center gap-2.5 text-[13.5px] text-fg cursor-pointer select-none py-0.5">
          <input
            className="w-4 h-4 rounded border-border accent-accent cursor-pointer transition-colors"
            type="checkbox"
            checked={quickFilters.unassigned}
            onChange={(e) => handleCheckboxChange("unassigned", e.target.checked)}
          />
          <span>Unassigned</span>
        </label>

        <label className="flex items-center gap-2.5 text-[13.5px] text-fg cursor-pointer select-none py-0.5">
          <input
            className="w-4 h-4 rounded border-border accent-accent cursor-pointer transition-colors"
            type="checkbox"
            checked={quickFilters.arcVsMep}
            onChange={(e) => handleCheckboxChange("arcVsMep", e.target.checked)}
          />
          <span>ARC vs MEP</span>
        </label>
      </div>

      <button
        onClick={handleClearFilters}
        disabled={!hasActiveFilters}
        className="inline-flex items-center justify-center gap-2 min-h-8 px-3 border border-border-strong rounded-radius bg-gradient-to-b from-surface-raised to-surface-alt text-fg cursor-pointer text-xs font-semibold no-underline hover:border-[oklch(50%_0.05_252)] hover:bg-[oklch(25%_0.026_255)] active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all w-full"
        type="button"
      >
        Clear Filters
      </button>
    </div>
  );
}
