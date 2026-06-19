import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Ruler, Undo2, Trash2 } from "lucide-react";
import type { CadViewEntityOps } from "@/components/cad/CadCanvas";

type Tool = "none" | "measure";

type SnapMarker = {
  x: number;
  y: number;
  type: string;
};

interface MarkupToolbarProps {
  viewerContainer: HTMLDivElement | null;
  onAnnotationsChange?: (annotations: any[]) => void;
  onActiveToolChange?: (tool: Tool) => void;
  worldTransform?: ((pt: { x: number; y: number }) => { x: number; y: number }) | null;
  cadUnits?: string;
  entityOps?: CadViewEntityOps | null;
}

type CadPreviewModules = {
  AcDbAlignedDimension: any;
  AcDbCircle: any;
  AcDbLine: any;
  AcCmColor: any;
  AcGePoint3d: any;
};

let cadPreviewModulesPromise: Promise<CadPreviewModules> | null = null;

const SNAP_LABELS: Record<string, string> = {
  endpoint: "Endpoint",
  midpoint: "Midpoint",
  center: "Center",
  intersection: "Intersection",
};

async function loadCadPreviewModules(): Promise<CadPreviewModules> {
  if (!cadPreviewModulesPromise) {
    cadPreviewModulesPromise = Promise.all([
      import("@mlightcad/data-model"),
      import("@mlightcad/common"),
      import("@mlightcad/geometry-engine"),
    ]).then(([dataModel, common, geometry]) => ({
      AcDbAlignedDimension: (dataModel as any).AcDbAlignedDimension,
      AcDbCircle: (dataModel as any).AcDbCircle,
      AcDbLine: (dataModel as any).AcDbLine,
      AcCmColor: (common as any).AcCmColor,
      AcGePoint3d: (geometry as any).AcGePoint3d,
    }));
  }

  return cadPreviewModulesPromise;
}

const MarkupToolbar = ({
  viewerContainer,
  onAnnotationsChange: _onAnnotationsChange,
  onActiveToolChange,
  worldTransform,
  cadUnits = "units",
  entityOps,
}: MarkupToolbarProps) => {
  const [activeTool, setActiveTool] = useState<Tool>("none");
  const [statusText, setStatusText] = useState<string>("");

  const isDrawing = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const nativeDimEntities = useRef<any[]>([]);
  const previewEntities = useRef<any[]>([]);
  const snapWorldCoords = useRef<Map<string, { x: number; y: number }>>(new Map());

  const clearPreview = useCallback(() => {
    if (!entityOps || previewEntities.current.length === 0) return;

    const entities = [...previewEntities.current];
    previewEntities.current = [];
    try {
      entityOps.removeEntity(entities);
    } catch (err) {
      console.warn("[Measure] Failed to clear preview entities:", err);
    }
  }, [entityOps]);

  const getPos = useCallback((e: { clientX: number; clientY: number }) => {
    if (!viewerContainer) return { x: 0, y: 0 };
    const rect = viewerContainer.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, [viewerContainer]);

  const getSnappedPos = useCallback((e: { clientX: number; clientY: number }, pointKey?: string) => {
    const pt = getPos(e);
    if (entityOps?.snapToNearest) {
      const snapped = entityOps.snapToNearest(pt, 20);
      if (snapped) {
        if (pointKey) {
          snapWorldCoords.current.set(pointKey, { x: snapped.worldX, y: snapped.worldY });
        }
        return {
          pos: { x: snapped.x, y: snapped.y },
          snap: { x: snapped.x, y: snapped.y, type: snapped.type } as SnapMarker,
        };
      }
    }

    if (pointKey) {
      snapWorldCoords.current.delete(pointKey);
    }

    return { pos: pt, snap: null };
  }, [entityOps, getPos]);

  const pixelDist = useCallback((a: { x: number; y: number }, b: { x: number; y: number }) => {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  }, []);

  const makeCadColor = useCallback(async (tokenName: string, fallback: string) => {
    const { AcCmColor } = await loadCadPreviewModules();
    const raw = getComputedStyle(document.documentElement).getPropertyValue(tokenName).trim();
    const cssColor = raw ? `hsl(${raw})` : fallback;
    const color = new AcCmColor();
    color.setRGBFromCss(cssColor);
    return color;
  }, []);

  const worldPointFromCss = useCallback((cssPoint: { x: number; y: number }) => {
    return worldTransform?.(cssPoint) ?? cssPoint;
  }, [worldTransform]);

  const worldRadiusFromPixels = useCallback((cssPoint: { x: number; y: number }, pixelRadius: number) => {
    const center = worldPointFromCss(cssPoint);
    const edge = worldPointFromCss({ x: cssPoint.x + pixelRadius, y: cssPoint.y });
    return Math.max(Math.hypot(edge.x - center.x, edge.y - center.y), 0.0001);
  }, [worldPointFromCss]);

  const renderPreview = useCallback(async (
    startCss: { x: number; y: number } | null,
    endCss: { x: number; y: number } | null,
    hoverSnap: SnapMarker | null,
  ) => {
    clearPreview();

    if (!entityOps || !worldTransform) return;
    if (!hoverSnap && !startCss && !endCss) return;

    try {
      const { AcDbCircle, AcDbLine, AcGePoint3d } = await loadCadPreviewModules();
      const previewColor = await makeCadColor("--primary", "hsl(221 83% 53%)");
      const activeColor = await makeCadColor("--destructive", "hsl(0 84% 60%)");

      const entities: any[] = [];

      const addMarker = (cssPoint: { x: number; y: number }, color: any) => {
        const world = worldPointFromCss(cssPoint);
        const marker = new AcDbCircle(
          new AcGePoint3d(world.x, world.y, 0),
          worldRadiusFromPixels(cssPoint, 7),
        );
        marker.color = color;
        entities.push(marker);
      };

      if (hoverSnap) {
        addMarker({ x: hoverSnap.x, y: hoverSnap.y }, previewColor);
      }

      if (startCss && endCss) {
        const wp1 = snapWorldCoords.current.get("start") ?? worldPointFromCss(startCss);
        const wp2 = snapWorldCoords.current.get("end") ?? worldPointFromCss(endCss);

        const line = new AcDbLine(
          new AcGePoint3d(wp1.x, wp1.y, 0),
          new AcGePoint3d(wp2.x, wp2.y, 0),
        );
        line.color = activeColor;
        entities.push(line);

        addMarker(startCss, activeColor);
        addMarker(endCss, activeColor);
      }

      if (entities.length > 0) {
        previewEntities.current = entities;
        entityOps.addEntity(entities);
      }
    } catch (err) {
      console.warn("[Measure] Failed to render preview entities:", err);
    }
  }, [clearPreview, entityOps, makeCadColor, worldPointFromCss, worldRadiusFromPixels, worldTransform]);

  const createDimension = useCallback(async (startCss: { x: number; y: number }, endCss: { x: number; y: number }) => {
    if (!entityOps || !worldTransform) return;

    const wp1 = snapWorldCoords.current.get("start") ?? worldTransform(startCss);
    const wp2 = snapWorldCoords.current.get("end") ?? worldTransform(endCss);

    try {
      const { AcDbAlignedDimension, AcGePoint3d } = await loadCadPreviewModules();

      const xLine1 = new AcGePoint3d(wp1.x, wp1.y, 0);
      const xLine2 = new AcGePoint3d(wp2.x, wp2.y, 0);
      const dx = wp2.x - wp1.x;
      const dy = wp2.y - wp1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const offset = len * 0.1 || 5;
      const nx = -dy / (len || 1);
      const ny = dx / (len || 1);
      const dimLinePt = new AcGePoint3d(
        (wp1.x + wp2.x) / 2 + nx * offset,
        (wp1.y + wp2.y) / 2 + ny * offset,
        0,
      );

      const dim = new AcDbAlignedDimension(xLine1, xLine2, dimLinePt);

      const db = entityOps.getDatabase();
      if (db) {
        let dimBlockName = `*D_MEASURE_${Date.now()}`;
        let counter = 0;
        while (db.tables.blockTable.has(dimBlockName)) {
          dimBlockName = `*D_MEASURE_${Date.now()}_${counter++}`;
        }
        const dimBlock = dim.createDimBlock(dimBlockName);
        db.tables.blockTable.add(dimBlock);
        dim.dimBlockId = dimBlockName;
      }

      entityOps.appendToModelSpace(dim);
      nativeDimEntities.current.push(dim);
    } catch (err) {
      console.warn("[Measure] Failed to create native dimension:", err);
    }
  }, [entityOps, worldTransform]);

  useEffect(() => {
    if (!viewerContainer || activeTool !== "measure" || !entityOps || !worldTransform) {
      return;
    }

    const previousCursor = viewerContainer.style.cursor;
    viewerContainer.style.cursor = "crosshair";
    const canvases = viewerContainer.querySelectorAll('canvas');
    const prevCanvasCursors: string[] = [];
    canvases.forEach((c, i) => {
      prevCanvasCursors[i] = c.style.cursor;
      c.style.cursor = "crosshair";
      c.style.pointerEvents = "none"; // Let events pass through to container
    });

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      

      e.preventDefault();
      e.stopPropagation();

      isDrawing.current = true;
      snapWorldCoords.current.clear();
      const { pos, snap } = getSnappedPos(e, "start");
      startPointRef.current = pos;
      setStatusText(snap ? `Start · ${SNAP_LABELS[snap.type] ?? "Snap"}` : "Start point");

      viewerContainer.setPointerCapture?.(e.pointerId);
      void renderPreview(pos, pos, snap);
    };

    const onPointerMove = (e: PointerEvent) => {
      const { pos, snap } = getSnappedPos(e, isDrawing.current ? "end" : undefined);

      if (!isDrawing.current) {
        setStatusText(snap ? `Snap · ${SNAP_LABELS[snap.type] ?? "Snap"}` : "");
        void renderPreview(null, null, snap);
        return;
      }

      const start = startPointRef.current;
      if (!start) return;

      setStatusText(`${pixelDist(start, pos).toFixed(1)} px`);
      void renderPreview(start, pos, snap);
    };

    const finishMeasure = (e: PointerEvent) => {
      if (!isDrawing.current) return;
      

      e.preventDefault();
      e.stopPropagation();

      isDrawing.current = false;
      viewerContainer.releasePointerCapture?.(e.pointerId);

      const start = startPointRef.current;
      const { pos, snap } = getSnappedPos(e, "end");
      if (!start) {
        clearPreview();
        setStatusText("");
        return;
      }

      if (pixelDist(start, pos) > 1) {
        
        void createDimension(start, pos);
      }

      clearPreview();
      startPointRef.current = null;
      snapWorldCoords.current.clear();
      setStatusText(snap ? `Placed · ${SNAP_LABELS[snap.type] ?? "Snap"}` : "Measurement created");
    };

    const cancelHover = () => {
      if (!isDrawing.current) {
        clearPreview();
        setStatusText("");
      }
    };

    viewerContainer.addEventListener("pointerdown", onPointerDown, true);
    viewerContainer.addEventListener("pointermove", onPointerMove, true);
    viewerContainer.addEventListener("pointerup", finishMeasure, true);
    viewerContainer.addEventListener("pointerleave", cancelHover, true);

    return () => {
      viewerContainer.style.cursor = previousCursor;
      canvases.forEach((c, i) => {
        c.style.cursor = prevCanvasCursors[i] ?? '';
        c.style.pointerEvents = '';
      });
      viewerContainer.removeEventListener("pointerdown", onPointerDown, true);
      viewerContainer.removeEventListener("pointermove", onPointerMove, true);
      viewerContainer.removeEventListener("pointerup", finishMeasure, true);
      viewerContainer.removeEventListener("pointerleave", cancelHover, true);
      clearPreview();
    };
  }, [
    activeTool,
    clearPreview,
    createDimension,
    entityOps,
    getSnappedPos,
    pixelDist,
    renderPreview,
    viewerContainer,
    worldTransform,
  ]);

  useEffect(() => {
    if (activeTool !== "none") return;
    clearPreview();
    isDrawing.current = false;
    startPointRef.current = null;
    snapWorldCoords.current.clear();
  }, [activeTool, clearPreview]);

  const undo = () => {
    if (!entityOps || nativeDimEntities.current.length === 0) return;
    const lastDim = nativeDimEntities.current.pop();
    if (lastDim) {
      entityOps.removeEntity(lastDim);
    }
  };

  const clearAll = () => {
    if (!entityOps || nativeDimEntities.current.length === 0) return;
    const entities = [...nativeDimEntities.current];
    nativeDimEntities.current = [];
    entityOps.removeEntity(entities);
  };

  const canMeasure = Boolean(viewerContainer && entityOps && worldTransform);

  return (
    <div className="flex items-center gap-1 border-b bg-background p-2 flex-wrap">
      <Button
        variant={activeTool === "measure" ? "default" : "ghost"}
        size="sm"
        className="h-8 gap-1.5"
        disabled={!canMeasure}
        onClick={() => {
          const newTool = activeTool === "measure" ? "none" : "measure";
          setActiveTool(newTool);
          onActiveToolChange?.(newTool);
          if (newTool === "none") {
            setStatusText("");
          }
        }}
        title={`Measure (${cadUnits})`}
      >
        <Ruler className="h-4 w-4" />
        <span className="text-xs">Measure</span>
      </Button>

      <div className="mx-1 h-6 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={undo}
        title="Undo"
        disabled={nativeDimEntities.current.length === 0}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={clearAll}
        title="Clear All"
        disabled={nativeDimEntities.current.length === 0}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <span className="ml-auto px-2 text-xs text-muted-foreground">
        {statusText || `World units: ${cadUnits}`}
      </span>
    </div>
  );
};

export default MarkupToolbar;