import { useEffect, useRef, useState } from "react";
import * as OBC from "@thatopen/components";
import { useBimStore } from "@/react-components/store/bimStore";
import { Icon } from "@/react-components/components/ui";
import { cn } from "@/lib/utils";

// Collapses the burst of onItemSet events a batch load fires into a single pass.
const REGEN_DEBOUNCE_MS = 400;

interface ViewGroups {
  plans: string[];
  elevations: string[];
}

const EMPTY_GROUPS: ViewGroups = { plans: [], elevations: [] };

// OBC.Views.open() swaps world.camera to the view's orthographic top-down camera,
// but this app renders through OBF.PostproductionRenderer (enabled for the
// outliner). Its composer keeps rendering from the camera captured by the last
// updateCamera() call, so a bare camera swap leaves the viewport on the old
// perspective camera (only the global clip plane changes). Re-syncing the
// composer after open/close makes the camera actually move — same remedy the
// projection toggle uses in ToolbarSettings.
function resyncPostproductionCamera(world: OBC.World | null) {
  const pp = (world?.renderer as any)?.postproduction;
  if (pp && typeof pp.updateCamera === "function") pp.updateCamera();
}

/**
 * Opens a plan view in perspective projection, looking straight down at the top of
 * the model.
 *
 * OBC opens plan views with the view's own OrthoPerspectiveCamera in "Plan"
 * navigation mode (pan + zoom, no rotation) + Orthographic projection. We flip the
 * projection to Perspective (same call the ToolbarSettings toggle uses) and leave
 * the rest as-is — the camera stays straight-down and Plan mode keeps it locked to
 * a top view (no tilt, no orbit).
 *
 * OBC's ortho→perspective switch reuses a stale camera distance, so the model can
 * land off-screen (the user would otherwise have to press Focus). fitToItems re-
 * frames it — and because it uses controls.fitToSphere it keeps the current
 * straight-down direction, so no tilt is reintroduced. Same call the Focus button
 * makes. Elevations never call this: they stay orthographic drawings.
 */
async function applyPerspectivePlanCamera(world: OBC.World | null) {
  const camera = world?.camera as any;
  if (!camera?.projection) return;
  await camera.projection.set("Perspective");
  camera.updateAspect?.();
  if (typeof camera.fitToItems === "function") {
    try {
      await camera.fitToItems();
    } catch (err) {
      console.warn("2D Views: failed to fit plan view to model", err);
    }
  }
}

/**
 * "2D Views" panel section. Auto-generates floor plans (from IFC storeys) and
 * elevations (from the models' bounding box) via the built-in OBC.Views whenever
 * a model finishes loading, and lets the user open a view or exit back to 3D.
 * Plans open in perspective projection but straight-down (see
 * applyPerspectivePlanCamera); elevations stay orthographic drawings.
 *
 * Engine wiring (views.world / defaultRange) lives in setup/src/views.ts — this
 * component only reads components.get(OBC.Views) and drives generate/open/close.
 */
export function Views2DList() {
  const { components, world } = useBimStore();
  const [groups, setGroups] = useState<ViewGroups>(EMPTY_GROUPS);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!components) return;

    const views = components.get(OBC.Views);
    const fragments = components.get(OBC.FragmentsManager);

    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    // Guards against out-of-order async regenerations: only the latest run may
    // commit its result to React state.
    let runId = 0;

    const regenerate = async () => {
      const thisRun = ++runId;

      // Clear whatever we generated last time (safe: this section owns the list —
      // no user-created section views to preserve in this cut).
      views.close();
      resyncPostproductionCamera(world);
      views.list.clear();

      if (fragments.list.size === 0) {
        if (mounted && thisRun === runId) {
          setGroups(EMPTY_GROUPS);
          setActiveId(null);
        }
        return;
      }

      // Plans first: after the clear, every key now present is a plan.
      // Non-IFC models simply contribute no storeys.
      try {
        await views.createFromIfcStoreys();
      } catch (err) {
        console.warn("2D Views: failed to create plans from IFC storeys", err);
      }
      const plans = [...views.list.keys()];

      // Elevations added next: any key not already counted as a plan.
      try {
        views.createElevations({ combine: true });
      } catch (err) {
        console.warn("2D Views: failed to create elevations", err);
      }
      const planSet = new Set(plans);
      const elevations = [...views.list.keys()].filter((k) => !planSet.has(k));

      if (mounted && thisRun === runId) {
        setGroups({ plans, elevations });
        setActiveId(null);
      }
    };

    const scheduleRegen = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(regenerate, REGEN_DEBOUNCE_MS);
    };

    // Same handler drives both directions: a load adds views, a removal/dispose
    // (e.g. project switch) rebuilds from whatever models remain.
    fragments.list.onItemSet.add(scheduleRegen);
    fragments.list.onItemDeleted.add(scheduleRegen);

    // Catch models that were already loaded before this component mounted.
    if (fragments.list.size > 0) scheduleRegen();

    return () => {
      mounted = false;
      if (timeout) clearTimeout(timeout);
      fragments.list.onItemSet.remove(scheduleRegen);
      fragments.list.onItemDeleted.remove(scheduleRegen);
      // Deliberately do not touch views/camera here — teardown of the OBC world
      // is owned by ViewportWrapper, and world.camera throws once disposed.
    };
  }, [components, world]);

  const openView = async (id: string) => {
    if (!components) return;
    const views = components.get(OBC.Views);
    views.open(id);
    // Plans open in perspective (straight-down top view); elevations stay ortho.
    if (groups.plans.includes(id)) {
      await applyPerspectivePlanCamera(world);
    }
    resyncPostproductionCamera(world);
    setActiveId(id);
  };

  const exitView = () => {
    if (!components) return;
    const views = components.get(OBC.Views);
    views.close();
    resyncPostproductionCamera(world);
    setActiveId(null);
  };

  const hasViews = groups.plans.length > 0 || groups.elevations.length > 0;

  if (!hasViews) {
    return (
      <p className="text-xs text-muted px-1 py-2">
        Load a model to generate 2D views.
      </p>
    );
  }

  const renderRow = (id: string, icon: "LAYOUT" | "CAMERA") => {
    const isActive = id === activeId;
    return (
      <button
        key={id}
        type="button"
        onClick={() => openView(id)}
        title={id}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-radius text-xs text-left border transition-colors duration-120 cursor-pointer",
          isActive
            ? "bg-accent/15 border-accent/40 text-fg"
            : "bg-transparent border-transparent text-muted hover:bg-surface-alt hover:text-fg"
        )}
      >
        <Icon name={icon} size={14} className={isActive ? "text-accent-2" : ""} />
        <span className="truncate">{id}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1 h-full overflow-y-auto">
      <button
        type="button"
        onClick={exitView}
        disabled={!activeId}
        className={cn(
          "w-full flex items-center justify-center gap-2 mb-1 px-2 py-1.5 rounded-radius text-xs font-semibold border transition-colors duration-120",
          activeId
            ? "border-border bg-surface text-fg hover:bg-surface-alt cursor-pointer"
            : "border-border/50 bg-surface/50 text-muted-2 cursor-not-allowed"
        )}
      >
        <Icon name="CLOSE" size={14} />
        <span>Exit 2D View</span>
      </button>

      {groups.plans.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1 pt-1">
            Plans
          </span>
          {groups.plans.map((id) => renderRow(id, "LAYOUT"))}
        </div>
      )}

      {groups.elevations.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted px-1 pt-1">
            Elevations
          </span>
          {groups.elevations.map((id) => renderRow(id, "CAMERA"))}
        </div>
      )}
    </div>
  );
}
