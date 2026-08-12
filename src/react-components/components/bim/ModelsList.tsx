import { useEffect, useRef } from "react";
import * as OBC from "@thatopen/components";
import * as CUI from "@thatopen/ui-obc";
import { useBimStore } from "@/react-components/store/bimStore";

interface ModelsListProps {
  searchQuery: string;
}

/** Wait for a burst of load events to settle before rendering once. */
const UPDATE_DEBOUNCE_MS = 120;
/** How long to give a render's `await getMetadata()` calls before re-checking the count. */
const RECONCILE_DELAY_MS = 400;
/** Bound the self-heal so a genuinely un-renderable model can't spin forever. */
const MAX_RECONCILE_ATTEMPTS = 5;

export function ModelsList({ searchQuery }: ModelsListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { components } = useBimStore();
  const tableRef = useRef<any>(null);

  useEffect(() => {
    if (!components || !containerRef.current) return;
    const container = containerRef.current;

    // Clear previous contents
    container.innerHTML = "";

    // ⚠️ `autoUpdate` is OFF (the second arg) — the vendor's own subscription drops
    // models, and this is the "7 of 8 on first paint" bug.
    //
    // `modelsListTemplate`'s ref callback is **async**: it walks `fragments.list`,
    // `await`s `getMetadata()` for every model, and only then assigns `table.data`.
    // With autoUpdate on, ui-obc fires one `setTimeout(update)` per `onItemSet`, so
    // loading 8 models starts 8 overlapping renders and the **last to resolve wins**
    // — which is not the one that saw the most models. A render that snapshotted 7
    // entries landing after the render that saw 8 leaves the table showing 7. Which
    // model goes missing varies per run because load-completion order does.
    // (@thatopen/ui-obc 3.4.0, `modelsList`/`modelsListTemplate` in dist/index.js.)
    //
    // So we own the trigger instead: debounce the burst into a single render, then
    // reconcile the rendered row count against the live list and re-render if the
    // race still bit. All 8 models are always loaded and visible — only the panel
    // was wrong.
    const [table, updateTable] = CUI.tables.modelsList(
      {
        components,
        metaDataTags: ["schema"],
        actions: { download: true },
      },
      false,
    );

    tableRef.current = table;

    // Apply layout styles to blend seamlessly
    table.style.width = "100%";
    // Fill (and scroll within) the section's allotted height — the "Models List"
    // section is now fullHeight (half the left panel), so cap to the container
    // rather than the viewport.
    table.style.maxHeight = "100%";
    table.style.border = "none";
    table.style.backgroundColor = "transparent";
    table.style.setProperty("--bim-ui_border", "transparent");

    container.appendChild(table);

    const fragments = components.get(OBC.FragmentsManager);

    let debounceId: number | undefined;
    let reconcileId: number | undefined;
    let attempts = 0;

    /** Rows the template would build right now — same filter the vendor applies. */
    const expectedRowCount = () => {
      let count = 0;
      for (const [, model] of fragments.list) {
        if (model && !model.isDeltaModel) count += 1;
      }
      return count;
    };

    const reconcile = () => {
      const rendered = table.data?.length ?? -1;
      if (rendered === expectedRowCount() || attempts >= MAX_RECONCILE_ATTEMPTS) return;
      attempts += 1;
      updateTable();
      reconcileId = window.setTimeout(reconcile, RECONCILE_DELAY_MS);
    };

    const scheduleUpdate = () => {
      window.clearTimeout(debounceId);
      window.clearTimeout(reconcileId);
      debounceId = window.setTimeout(() => {
        attempts = 0;
        updateTable();
        reconcileId = window.setTimeout(reconcile, RECONCILE_DELAY_MS);
      }, UPDATE_DEBOUNCE_MS);
    };

    fragments.list.onItemSet.add(scheduleUpdate);
    fragments.list.onItemDeleted.add(scheduleUpdate);
    // Models already in the scene when this panel mounts (tab switch, remount).
    scheduleUpdate();

    return () => {
      window.clearTimeout(debounceId);
      window.clearTimeout(reconcileId);
      fragments.list.onItemSet.remove(scheduleUpdate);
      fragments.list.onItemDeleted.remove(scheduleUpdate);
      table.remove();
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
      className="w-full h-full overflow-y-auto"
    />
  );
}
