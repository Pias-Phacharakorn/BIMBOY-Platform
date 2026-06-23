import React, { useState, useEffect, useRef } from "react";
import { useBimStore } from "@/react-components/store/bimStore";
import { PropertyTable as OBCPropertyTable } from "@/bim-components/PropertyTable";
import { selectedFilters } from "@/bim-components/PropertyTable/src/TableDataManager";
import { RefreshCw, Download, FileJson, Check, ChevronDown, Table, Search } from "lucide-react";
import * as OBC from "@thatopen/components";
import { cn } from "@/lib/utils";

export function PropertyTable() {
  const { components } = useBimStore();
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sync initial category selection on mount
  useEffect(() => {
    const initialCats = selectedFilters.get("Categories") || new Set<string>();
    setSelectedCats(new Set(initialCats));
  }, []);

  // Fetch unique categories across all loaded models from the Classifier
  useEffect(() => {
    if (!components) return;
    
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const classifier = components.get(OBC.Classifier);
        const fragmentsManager = components.get(OBC.FragmentsManager);
        
        // Populate category classification if loaded models exist but classification is missing or empty
        if (fragmentsManager.list.size > 0) {
          if (!classifier.list.has("Categories") || classifier.list.get("Categories")!.size === 0) {
            await classifier.byCategory();
          }
        }
        
        const categoriesObj = classifier.list.get("Categories");
        if (categoriesObj) {
          const unique = Array.from(categoriesObj.keys()).sort();
          if (isMounted) {
            setCategories(unique);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch categories from classifier:", err);
      }
    };

    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, [components, showDropdown]);

  // Sync loaded state on components change
  useEffect(() => {
    if (!components) return;
    try {
      const propertyTable = components.get(OBCPropertyTable);
      setIsLoaded(propertyTable.currentProperties.length > 0);
    } catch (e) {
      // Ignored
    }
  }, [components]);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setCategorySearch(""); // Reset search on close
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize and mount the native property table
  useEffect(() => {
    if (!components || !tableContainerRef.current || !isLoaded) return;

    const propertyTable = components.get(OBCPropertyTable);
    propertyTable.initNativeTable(tableContainerRef.current);
    
    if (propertyTable.currentProperties.length > 0) {
      propertyTable.populateTable();
    }

    return () => {
      if (tableContainerRef.current) {
        tableContainerRef.current.innerHTML = "";
      }
    };
  }, [components, isLoaded]);

  // Actions
  const onLoadData = async () => {
    if (!components) return;
    const propertyTable = components.get(OBCPropertyTable);
    setIsLoading(true);
    try {
      await propertyTable.loadFilteredProperties();
      setIsLoaded(propertyTable.currentProperties.length > 0);
    } catch (err: any) {
      alert(err.message || "Failed to load properties. Make sure you select categories first.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchText(val);
    if (!components) return;
    try {
      const propertyTable = components.get(OBCPropertyTable);
      propertyTable.applyTextFilter(val);
    } catch (err) {
      console.warn("Failed to apply text filter:", err);
    }
  };

  const toggleCategory = (cat: string) => {
    const newSet = new Set(selectedCats);
    if (newSet.has(cat)) {
      newSet.delete(cat);
    } else {
      newSet.add(cat);
    }
    setSelectedCats(newSet);
    selectedFilters.set("Categories", newSet);
  };

  const selectAllCategories = () => {
    const newSet = new Set(categories);
    setSelectedCats(newSet);
    selectedFilters.set("Categories", newSet);
  };

  const clearAllCategories = () => {
    const newSet = new Set<string>();
    setSelectedCats(newSet);
    selectedFilters.set("Categories", newSet);
  };

  const onExportCSV = () => {
    if (!components) return;
    const propertyTable = components.get(OBCPropertyTable);
    propertyTable.downloadData("IFC-Properties", "csv");
  };

  const onExportJSON = () => {
    if (!components) return;
    const propertyTable = components.get(OBCPropertyTable);
    propertyTable.downloadData("IFC-Properties", "json");
  };

  const filteredCategories = categories.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="flex flex-col w-full h-full min-h-0 bg-surface">
      {/* Header Toolbar */}
      <header className="flex flex-none items-center justify-between gap-4 p-3 bg-surface-alt border-b border-border select-none">
        
        {/* Title and Category Dropdown */}
        <div className="flex items-center gap-4 text-fg text-sm font-bold tracking-wider">
          <div className="flex items-center gap-2">
            <Table size={16} className="text-white" />
            <span>Property Table</span>
          </div>

          {/* Select Category Dropdown Button */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
                if (showDropdown) {
                  setCategorySearch("");
                }
              }}
              className="inline-flex items-center gap-1.5 h-7 px-3 bg-bg border border-border hover:border-border-strong rounded cursor-pointer text-xs font-semibold text-fg hover:bg-surface-alt transition-colors duration-120 select-none shrink-0"
              type="button"
            >
              <span>Select Category</span>
              <ChevronDown size={13} className={cn("transition-transform duration-120", showDropdown && "rotate-180")} />
            </button>
            
            {showDropdown && (
              <div className="absolute left-0 top-full mt-1.5 w-64 max-h-72 bg-surface-raised border border-border rounded-radius shadow-xl z-50 flex flex-col p-1.5 select-none animate-in fade-in slide-in-from-top-1 duration-120 overflow-hidden">
                {/* Search category input */}
                <div className="px-1.5 pb-1.5 border-b border-border/50 flex items-center gap-1.5 shrink-0">
                  <Search size={11} className="text-muted" />
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder="Search category..."
                    className="w-full bg-bg border border-border focus:border-accent hover:border-border-strong rounded px-2 py-0.5 text-[10px] text-fg placeholder-muted-2 outline-none h-6"
                  />
                </div>
                
                {/* Select All / Clear All Toolbar */}
                <div className="flex items-center justify-between py-1.5 px-1.5 shrink-0">
                  <button
                    onClick={selectAllCategories}
                    className="text-[10px] font-bold text-accent hover:underline cursor-pointer"
                    type="button"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearAllCategories}
                    className="text-[10px] font-bold text-muted hover:underline cursor-pointer"
                    type="button"
                  >
                    Clear All
                  </button>
                </div>
                
                {/* Checklist content */}
                <div className="flex-1 overflow-y-auto divide-y divide-border/10">
                  {filteredCategories.length === 0 ? (
                    <div className="text-center py-3 text-xs text-muted italic">
                      No categories found
                    </div>
                  ) : (
                    filteredCategories.map((cat) => {
                      const isChecked = selectedCats.has(cat);
                      return (
                        <div
                          key={cat}
                          onClick={() => toggleCategory(cat)}
                          className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-surface-alt/50 rounded cursor-pointer transition-colors text-[11px] font-medium text-fg"
                        >
                          <div className={cn(
                            "w-3.5 h-3.5 border rounded flex items-center justify-center transition-all duration-120",
                            isChecked ? "bg-accent border-accent text-fg" : "border-border-strong bg-bg"
                          )}>
                            {isChecked && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span className="truncate flex-1">{cat}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchText}
            onChange={onSearchChange}
            placeholder="Search properties..."
            disabled={!isLoaded || isLoading}
            className="w-full bg-bg border border-border focus:border-accent hover:border-border-strong disabled:opacity-40 rounded pl-8 pr-3 py-1 text-xs text-fg placeholder-muted-2 outline-none transition-colors duration-120 h-7"
          />
        </div>

        {/* Actions Button Bar */}
        <div className="flex items-center gap-2">
          {/* Refresh Data */}
          <button
            onClick={onLoadData}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-3 bg-bg border border-border hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed rounded cursor-pointer text-xs font-semibold text-fg hover:bg-surface-alt transition-colors duration-120 shrink-0",
              selectedCats.size > 0 && !isLoaded && "border-accent text-accent animate-pulse"
            )}
            type="button"
            title="Reload properties for the selected categories"
          >
            <RefreshCw size={12} className={cn(isLoading && "animate-spin")} />
            <span>{isLoading ? "Loading..." : "Refresh Data"}</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={onExportCSV}
            disabled={!isLoaded || isLoading}
            className="inline-flex items-center gap-1.5 h-7 px-3 bg-bg border border-border hover:border-border-strong disabled:opacity-45 disabled:cursor-not-allowed rounded cursor-pointer text-xs font-semibold text-fg hover:bg-surface-alt transition-colors duration-120 shrink-0"
            type="button"
          >
            <Download size={12} />
            <span>Export CSV</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={onExportJSON}
            disabled={!isLoaded || isLoading}
            className="inline-flex items-center gap-1.5 h-7 px-3 bg-bg border border-border hover:border-border-strong disabled:opacity-45 disabled:cursor-not-allowed rounded cursor-pointer text-xs font-semibold text-fg hover:bg-surface-alt transition-colors duration-120 shrink-0"
            type="button"
          >
            <FileJson size={12} />
            <span>Export JSON</span>
          </button>
        </div>
      </header>

      {/* Main Table Container / Placeholder Area */}
      <div className="flex-1 min-h-0 w-full relative flex flex-col">
        {isLoaded ? (
          <div
            ref={tableContainerRef}
            className="flex-1 w-full h-full min-h-0 relative"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface/5 min-h-[200px]">
            <div className="max-w-md flex flex-col items-center gap-3">
              <Table size={36} className="text-muted/60" />
              <h3 className="text-sm font-semibold text-fg">Property Table</h3>
              <p className="text-xs text-muted leading-relaxed">
                {selectedCats.size > 0
                  ? `${selectedCats.size} ${selectedCats.size === 1 ? "category" : "categories"} selected. Click "Refresh Data" to load properties.`
                  : 'Select categories first in "Select Category" dropdown, then click "Refresh Data" to load properties.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
