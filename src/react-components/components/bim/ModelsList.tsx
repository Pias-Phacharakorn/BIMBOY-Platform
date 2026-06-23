import React, { useEffect, useRef } from "react";
import * as CUI from "@thatopen/ui-obc";
import { useBimStore } from "@/react-components/store/bimStore";

interface ModelsListProps {
  searchQuery: string;
}

export function ModelsList({ searchQuery }: ModelsListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { components } = useBimStore();
  const tableRef = useRef<any>(null);

  useEffect(() => {
    if (!components || !containerRef.current) return;

    // Clear previous contents
    containerRef.current.innerHTML = "";

    // Create the modelsList table from ThatOpen UI-OBC
    const [table] = CUI.tables.modelsList({
      components,
      metaDataTags: ["schema"],
      actions: { download: true },
    });

    tableRef.current = table;

    // Apply layout styles to blend seamlessly
    table.style.width = "100%";
    table.style.maxHeight = "calc(100vh - 200px)";
    table.style.border = "none";
    table.style.backgroundColor = "transparent";
    table.style.setProperty("--bim-ui_border", "transparent");

    containerRef.current.appendChild(table);

    return () => {
      if (table) {
        table.remove();
      }
    };
  }, [components]);

  // Sync search query to the table
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.queryString = searchQuery;
    }
  }, [searchQuery]);

  return (
    <div
      ref={containerRef}
      className="w-full"
    />
  );
}
