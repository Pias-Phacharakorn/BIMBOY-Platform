import { useMemo, useState } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { useClashStore } from "@/react-components/store/clashStore";
import { useBimStore } from "@/react-components/store/bimStore";
import { useClashViewpoints } from "./useClashViewpoints";
import { Icon } from "@/react-components/components/ui";
import { cn, capitalize } from "@/lib/utils";
import type { ClashItem } from "@/types";

interface ClashListProps {
  projectId: string;
}

type StatusFilter = "All" | "Open" | "Resolved";

const STATUS_FILTERS: StatusFilter[] = ["All", "Open", "Resolved"];

const OPEN_STATUSES: ClashItem["status"][] = ["new", "unresolved"];
const RESOLVED_STATUSES: ClashItem["status"][] = ["resolved", "approved_as_note"];

const statusBarClassMap: Record<ClashItem["status"], string> = {
  new: "bg-status-danger",
  unresolved: "bg-status-warn",
  resolved: "bg-status-ok",
  approved_as_note: "bg-status-ok",
};

export function ClashList({ projectId }: ClashListProps) {
  const { selectedClashId, setSelectedClashId } = useClashStore();
  const { world, components } = useBimStore();
  const { data: clashItems = [], isLoading } = useClashViewpoints(projectId);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  // Assign sequential IDs based on fetch order, then reverse so the most recent viewpoint leads the list
  const reversedItems = useMemo(() => {
    const withSeqId = clashItems.map((item, index) => ({
      ...item,
      seqId: clashItems.length - index,
    }));
    return [...withSeqId].reverse();
  }, [clashItems]);

  const filteredItems = useMemo(() => {
    return reversedItems.filter((item) => {
      if (statusFilter === "Open" && !OPEN_STATUSES.includes(item.status)) return false;
      if (statusFilter === "Resolved" && !RESOLVED_STATUSES.includes(item.status)) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = item.name.toLowerCase().includes(query);
        const idMatch = `#${item.seqId}`.includes(query) || item.seqId.toString().includes(query);
        if (!nameMatch && !idMatch) return false;
      }

      return true;
    });
  }, [reversedItems, statusFilter, searchQuery]);

  const handleSelect = async (item: (typeof filteredItems)[number]) => {
    setSelectedClashId(item.id);

    if (!world || !(world.camera instanceof OBC.SimpleCamera) || !item.camera) return;

    const { position, target, up } = item.camera;

    // Navisworks uses Z-up; Three.js (and this viewer) uses Y-up
    let localPos = new THREE.Vector3(position.x, position.z, -position.y);
    let localTgt = new THREE.Vector3(target.x, target.z, -target.y);
    let localUp = up
      ? new THREE.Vector3(up.x, up.z, -up.y)
      : world.camera.three.up.clone();

    const fragments = components?.get(OBC.FragmentsManager);
    const model = fragments ? fragments.list.values().next().value : null;

    if (model && typeof model.getCoordinationMatrix === "function") {
      try {
        const matrix = await model.getCoordinationMatrix();
        const inverseMatrix = new THREE.Matrix4().copy(matrix).invert();

        // Database camera values are stored in global project coordinates (UTM space);
        // map them back into the model's local Three.js coordinates.
        localPos = new THREE.Vector3(position.x, position.y, position.z).applyMatrix4(inverseMatrix);
        localTgt = new THREE.Vector3(target.x, target.y, target.z).applyMatrix4(inverseMatrix);
        if (up) {
          localUp = new THREE.Vector3(up.x, up.y, up.z)
            .transformDirection(inverseMatrix)
            .normalize();
        }
      } catch (err) {
        console.warn("Failed to get or invert coordination matrix, falling back to manual mapping", err);
      }
    }

    world.camera.three.up.copy(localUp);

    world.camera.controls.setLookAt(
      localPos.x,
      localPos.y,
      localPos.z,
      localTgt.x,
      localTgt.y,
      localTgt.z,
      true
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search Bar */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="relative flex items-center">
          <Icon name="SEARCH" size={14} className="absolute left-2.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search viewpoints..."
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border-strong bg-bg text-xs text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 mt-2.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={cn(
                "flex-1 px-2 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-colors",
                statusFilter === filter
                  ? "bg-accent text-white"
                  : "bg-surface-alt text-muted hover:text-fg"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Viewpoint Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted text-xs">
            <div className="w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />
            <span>Loading viewpoints...</span>
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="text-center text-muted text-xs py-8">No viewpoints match the selected criteria.</div>
        )}

        {!isLoading &&
          filteredItems.map((item) => {
            const isSelected = item.id === selectedClashId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className={cn(
                  "relative flex items-stretch gap-0 text-left rounded-radius border overflow-hidden transition-colors shrink-0",
                  isSelected
                    ? "border-accent bg-[oklch(22%_0.03_252)]"
                    : "border-border bg-surface-alt hover:bg-[oklch(18%_0.02_255)]"
                )}
              >
                {/* Left status bar */}
                <span className={cn("w-1 shrink-0", statusBarClassMap[item.status])} />

                <div className="flex flex-col gap-1 p-2.5 flex-1 min-w-0">
                  {isSelected && (
                    <span className="self-start inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase bg-accent/20 text-accent">
                      Current view
                    </span>
                  )}

                  <span className="text-fg text-xs font-semibold truncate" title={item.name}>
                    #{item.seqId} - {item.name}
                  </span>

                  <span className="text-muted text-[11px]">
                    {capitalize(item.status.replace(/_/g, " "))} • {capitalize(item.type)}
                  </span>

                  <div className="flex items-center justify-between text-[10px] text-muted-2 mt-1">
                    <span>Assigned To: -</span>
                    <span>Due: -</span>
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
