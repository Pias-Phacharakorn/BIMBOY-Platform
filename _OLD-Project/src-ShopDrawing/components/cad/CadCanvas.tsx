import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AcTrView2d } from "@mlightcad/cad-simple-viewer";
import type { AcDbEntity } from "@mlightcad/data-model";

export interface LayerInfo {
  name: string;
  isOff: boolean;
  color?: string;
}

export interface DatabaseInfo {
  layers: LayerInfo[];
  insunits: number;
}

export interface CadViewEntityOps {
  addEntity: (entity: AcDbEntity | AcDbEntity[]) => void;
  removeEntity: (entity: AcDbEntity | AcDbEntity[]) => void;
  appendToModelSpace: (entity: AcDbEntity | AcDbEntity[]) => void;
  getDatabase: () => any;
  snapToNearest: (screenPoint: { x: number; y: number }, radius?: number) => { x: number; y: number; worldX: number; worldY: number; type: string } | null;
  worldToScreen: (worldPt: { x: number; y: number }) => { x: number; y: number } | null;
}

interface CadCanvasProps {
  fileUrl: string | null;
  fileType: string;
  onDatabaseLoaded?: (info: DatabaseInfo) => void;
  onWorldTransformReady?: (fn: ((canvasPoint: { x: number; y: number }) => { x: number; y: number }) | null) => void;
  onLayerToggleReady?: (fn: ((layerName: string, isOff: boolean) => void) | null) => void;
  onEntityOpsReady?: (ops: CadViewEntityOps | null) => void;
  onContainerRef?: (el: HTMLDivElement | null) => void;
}

let convertersRegistered = false;
let docManagerInstance: any = null;

async function registerDwgConverter() {
  if (convertersRegistered) return;
  try {
    const { AcDbDatabaseConverterManager, AcDbFileType } = await import('@mlightcad/data-model');
    const { AcDbLibreDwgConverter } = await import('@mlightcad/libredwg-converter');
    const dwgConverter = new AcDbLibreDwgConverter({
      convertByEntityType: false,
      useWorker: true,
      parserWorkerUrl: '/assets/libredwg-parser-worker.js',
    } as any);
    AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG, dwgConverter);
    convertersRegistered = true;
    console.log('[CAD] DWG converter registered');
  } catch (err) {
    console.error('[CAD] Failed to register DWG converter:', err);
  }
}

function insunitsToLabel(insunits: number): string {
  const map: Record<number, string> = {
    0: 'units', 1: 'in', 2: 'ft', 3: 'mi',
    4: 'mm', 5: 'cm', 6: 'm', 7: 'km',
    8: 'μin', 9: 'mil', 10: 'yd', 11: 'Å',
    12: 'nm', 13: 'μm', 14: 'dm', 15: 'dam',
    16: 'hm', 17: 'Gm', 18: 'AU', 19: 'ly', 20: 'pc',
  };
  return map[insunits] ?? 'units';
}

function acColorToHex(color: any): string {
  if (!color) return '#ffffff';
  if (typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number') {
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }
  if (typeof color.colorIndex === 'number') {
    const aciMap: Record<number, string> = {
      1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff',
      5: '#0000ff', 6: '#ff00ff', 7: '#ffffff', 8: '#808080', 9: '#c0c0c0',
    };
    return aciMap[color.colorIndex] ?? '#ffffff';
  }
  return '#ffffff';
}

const CadCanvas = ({
  fileUrl,
  fileType,
  onDatabaseLoaded,
  onWorldTransformReady,
  onLayerToggleReady,
  onEntityOpsReady,
  onContainerRef,
}: CadCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docManagerInitialized = useRef(false);

  // Use a callback ref to reliably expose container to parent
  const containerCallbackRef = useCallback((el: HTMLDivElement | null) => {
    (containerRef as any).current = el;
    onContainerRef?.(el);
  }, [onContainerRef]);

  const loadFile = useCallback(async () => {
    if (!fileUrl || !containerRef.current) return;

    setLoading(true);
    setError(null);
    onWorldTransformReady?.(null);
    onLayerToggleReady?.(null);
    onEntityOpsReady?.(null);

    try {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('cad-files')
        .createSignedUrl(fileUrl, 3600);

      if (urlError || !signedUrlData?.signedUrl) {
        throw new Error('Failed to get file URL');
      }

      const response = await fetch(signedUrlData.signedUrl);
      const buffer = await response.arrayBuffer();

      if (fileType === 'dwg') {
        await registerDwgConverter();
      }

      const { AcApDocManager } = await import('@mlightcad/cad-simple-viewer');
      const container = containerRef.current;
      if (!container) throw new Error('Container not available');

      if (docManagerInstance) {
        try { docManagerInstance.destroy?.(); } catch (_) { /* ignore */ }
        docManagerInstance = null;
        docManagerInitialized.current = false;
      }

      if (!docManagerInitialized.current) {
        AcApDocManager.createInstance({
          container,
          autoResize: true,
          notLoadDefaultFonts: true,
          calculateSizeCallback: () => {
            const rect = container.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          },
        } as any);
        docManagerInstance = AcApDocManager.instance;
        docManagerInitialized.current = true;
      }

      const success = await AcApDocManager.instance.openDocument(
        `file.${fileType}`,
        buffer,
        {} as any
      );

      if (!success) {
        throw new Error(`Failed to render ${fileType.toUpperCase()} file`);
      }

      console.log('[CAD] File rendered successfully');

      // Read database info
      try {
        const db = AcApDocManager.instance.curDocument?.database;
        if (db) {
          const layerTable = db.tables.layerTable;
          const iterator = layerTable.newIterator();
          const layers: LayerInfo[] = [];
          for (const layerRecord of iterator) {
            layers.push({
              name: layerRecord.name,
              isOff: layerRecord.isOff,
              color: acColorToHex(layerRecord.color),
            });
          }
          const insunits = db.insunits ?? 0;
          console.log(`[CAD] Loaded ${layers.length} layers, units: ${insunitsToLabel(insunits)}`);
          onDatabaseLoaded?.({ layers, insunits });
        }
      } catch (dbErr) {
        console.warn('[CAD] Could not read database info:', dbErr);
      }

      // Layer toggle
      try {
        const db2 = AcApDocManager.instance.curDocument?.database;
        const view2: AcTrView2d = AcApDocManager.instance.curView;
        if (db2 && view2) {
          const layerToggleFn = (layerName: string, isOff: boolean) => {
            try {
              const layerRecord = db2.tables.layerTable.getAt(layerName);
              if (layerRecord) {
                layerRecord.isOff = isOff;
                view2.updateLayer(layerRecord, { isOff });
                view2.isDirty = true;
              }
            } catch (err) {
              console.warn('[CAD] Layer toggle failed:', err);
            }
          };
          onLayerToggleReady?.(layerToggleFn);
        }
      } catch (layerErr) {
        console.warn('[CAD] Could not set up layer toggle:', layerErr);
      }

      // Entity ops + snap
      try {
        const view3: AcTrView2d = AcApDocManager.instance.curView;
        const db3 = AcApDocManager.instance.curDocument?.database;
        if (view3) {
          let adapterCache: {
            width: number; height: number;
            scaleX: number; scaleY: number;
            offsetX: number; offsetY: number;
          } | null = null;

          const getScreenAdapter = () => {
            const rect = container.getBoundingClientRect();
            const width = Math.max(rect.width, 1);
            const height = Math.max(rect.height, 1);

            if (adapterCache && Math.abs(adapterCache.width - width) < 0.5 && Math.abs(adapterCache.height - height) < 0.5) {
              return adapterCache;
            }

            const identityAdapter = { width, height, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };

            if (!view3.worldToScreen || typeof view3.screenToWorld !== 'function') {
              adapterCache = identityAdapter;
              return adapterCache;
            }

            try {
              const roundTrip = (pt: { x: number; y: number }) => {
                const worldPt = view3.screenToWorld(pt as any);
                const screenPt = view3.worldToScreen({ x: worldPt.x, y: worldPt.y, z: 0 } as any);
                return screenPt ? { x: screenPt.x, y: screenPt.y } : pt;
              };

              const origin = roundTrip({ x: 0, y: 0 });
              const xAxis = roundTrip({ x: width, y: 0 });
              const yAxis = roundTrip({ x: 0, y: height });

              const scaleX = (xAxis.x - origin.x) / width;
              const scaleY = (yAxis.y - origin.y) / height;
              const offsetX = origin.x;
              const offsetY = origin.y;

              if (Number.isFinite(scaleX) && Number.isFinite(scaleY) &&
                  Number.isFinite(offsetX) && Number.isFinite(offsetY) &&
                  Math.abs(scaleX) > 1e-6 && Math.abs(scaleY) > 1e-6) {
                adapterCache = { width, height, scaleX, scaleY, offsetX, offsetY };
                return adapterCache;
              }
            } catch (adapterErr) {
              console.warn('[CAD] Screen adapter calibration failed:', adapterErr);
            }

            adapterCache = identityAdapter;
            return adapterCache;
          };

          const cssToViewSpace = (pt: { x: number; y: number }) => {
            const a = getScreenAdapter();
            return { x: pt.x * a.scaleX + a.offsetX, y: pt.y * a.scaleY + a.offsetY };
          };

          const viewToCssSpace = (pt: { x: number; y: number }) => {
            const a = getScreenAdapter();
            return { x: (pt.x - a.offsetX) / a.scaleX, y: (pt.y - a.offsetY) / a.scaleY };
          };

          const collectLineSegments = (): { s: { x: number; y: number }; e: { x: number; y: number } }[] => {
            if (!db3) return [];
            const segs: { s: { x: number; y: number }; e: { x: number; y: number } }[] = [];
            try {
              const modelSpace = db3.tables.blockTable.modelSpace;
              const iter = modelSpace.newIterator();
              for (const ent of iter) {
                const etype = ent.constructor?.name ?? '';
                if (etype === 'AcDbLine' || (ent as any).startPoint) {
                  const sp = (ent as any).startPoint;
                  const ep = (ent as any).endPoint;
                  if (sp && ep) segs.push({ s: { x: sp.x, y: sp.y }, e: { x: ep.x, y: ep.y } });
                }
                if ((ent as any).numVerts !== undefined) {
                  const nv = (ent as any).numVerts;
                  for (let vi = 1; vi < nv; vi++) {
                    try {
                      const prev = (ent as any).getPointAt?.(vi - 1) ?? (ent as any).vertexAt?.(vi - 1);
                      const cur = (ent as any).getPointAt?.(vi) ?? (ent as any).vertexAt?.(vi);
                      if (prev && cur) segs.push({ s: { x: prev.x, y: prev.y }, e: { x: cur.x, y: cur.y } });
                    } catch (_) { /* skip */ }
                  }
                }
              }
            } catch (_) { /* skip */ }
            return segs;
          };

          const segSegIntersect = (
            a1: { x: number; y: number }, a2: { x: number; y: number },
            b1: { x: number; y: number }, b2: { x: number; y: number }
          ): { x: number; y: number } | null => {
            const dax = a2.x - a1.x, day = a2.y - a1.y;
            const dbx = b2.x - b1.x, dby = b2.y - b1.y;
            const denom = dax * dby - day * dbx;
            if (Math.abs(denom) < 1e-10) return null;
            const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / denom;
            const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / denom;
            if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
            return { x: a1.x + t * dax, y: a1.y + t * day };
          };

          const collectSnapPoints = (): { x: number; y: number; type: string }[] => {
            if (!db3) return [];
            const pts: { x: number; y: number; type: string }[] = [];
            try {
              const modelSpace = db3.tables.blockTable.modelSpace;
              const iter = modelSpace.newIterator();
              for (const ent of iter) {
                const etype = ent.constructor?.name ?? '';
                if (etype === 'AcDbLine' || (ent as any).startPoint) {
                  const sp = (ent as any).startPoint;
                  const ep = (ent as any).endPoint;
                  if (sp) pts.push({ x: sp.x, y: sp.y, type: 'endpoint' });
                  if (ep) pts.push({ x: ep.x, y: ep.y, type: 'endpoint' });
                  if (sp && ep) pts.push({ x: (sp.x + ep.x) / 2, y: (sp.y + ep.y) / 2, type: 'midpoint' });
                }
                if ((ent as any).numVerts !== undefined) {
                  const nv = (ent as any).numVerts;
                  for (let vi = 0; vi < nv; vi++) {
                    try {
                      const vp = (ent as any).getPointAt?.(vi) ?? (ent as any).vertexAt?.(vi);
                      if (vp) pts.push({ x: vp.x, y: vp.y, type: 'endpoint' });
                      if (vi > 0) {
                        const prev = (ent as any).getPointAt?.(vi - 1) ?? (ent as any).vertexAt?.(vi - 1);
                        if (prev && vp) pts.push({ x: (prev.x + vp.x) / 2, y: (prev.y + vp.y) / 2, type: 'midpoint' });
                      }
                    } catch (_) { /* skip */ }
                  }
                }
                if ((ent as any).center) {
                  const c = (ent as any).center;
                  pts.push({ x: c.x, y: c.y, type: 'center' });
                }
              }
            } catch (e) {
              console.warn('[CAD] snap point collection error:', e);
            }

            try {
              const segs = collectLineSegments();
              for (let i = 0; i < segs.length; i++) {
                for (let j = i + 1; j < segs.length; j++) {
                  const ip = segSegIntersect(segs[i].s, segs[i].e, segs[j].s, segs[j].e);
                  if (ip) pts.push({ x: ip.x, y: ip.y, type: 'intersection' });
                }
              }
            } catch (_) { /* skip */ }

            return pts;
          };

          const worldTransformFn = (cssPoint: { x: number; y: number }) => {
            try {
              const viewPoint = cssToViewSpace(cssPoint);
              const worldPt = view3.screenToWorld(viewPoint as any);
              return { x: worldPt.x, y: worldPt.y };
            } catch (e) {
              console.warn('[CAD] screenToWorld call failed:', e);
              return cssPoint;
            }
          };

          onWorldTransformReady?.(worldTransformFn);

          /** snapToNearest: takes CSS-space coords, returns CSS-space coords */
          const snapToNearest = (cssPt: { x: number; y: number }, radius = 15) => {
            const worldPts = collectSnapPoints();
            if (worldPts.length === 0 || !view3.worldToScreen) return null;

            const viewPt = cssToViewSpace(cssPt);
            const a = getScreenAdapter();
            // Scale radius from CSS to view space
            const viewRadius = radius * Math.max(Math.abs(a.scaleX), Math.abs(a.scaleY), 1);

            let best: { x: number; y: number; worldX: number; worldY: number; type: string } | null = null;
            let bestDist = viewRadius * viewRadius;
            for (const wp of worldPts) {
              try {
                const sp = view3.worldToScreen({ x: wp.x, y: wp.y, z: 0 } as any);
                if (!sp) continue;
                const dx = sp.x - viewPt.x;
                const dy = sp.y - viewPt.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < bestDist) {
                  bestDist = d2;
                  const cssPt2 = viewToCssSpace({ x: sp.x, y: sp.y });
                  best = { x: cssPt2.x, y: cssPt2.y, worldX: wp.x, worldY: wp.y, type: wp.type };
                }
              } catch (_) { /* skip */ }
            }
            return best;
          };

          const worldToScreenFn = (worldPt: { x: number; y: number }) => {
            try {
              const sp = view3.worldToScreen({ x: worldPt.x, y: worldPt.y, z: 0 } as any);
              if (!sp) return null;
              return viewToCssSpace({ x: sp.x, y: sp.y });
            } catch {
              return null;
            }
          };

          onEntityOpsReady?.({
            addEntity: (entity) => { view3.addEntity(entity); view3.isDirty = true; },
            removeEntity: (entity) => { view3.removeEntity(entity); view3.isDirty = true; },
            appendToModelSpace: (entity) => {
              if (db3) {
                const modelSpace = db3.tables.blockTable.modelSpace;
                if (Array.isArray(entity)) {
                  entity.forEach((e: AcDbEntity) => modelSpace.appendEntity(e));
                } else {
                  modelSpace.appendEntity(entity);
                }
              }
            },
            getDatabase: () => db3,
            snapToNearest,
            worldToScreen: worldToScreenFn,
          });
        }
      } catch (opsErr) {
        console.warn('[CAD] Could not set up entity ops:', opsErr);
      }

    } catch (err: any) {
      console.error('[CAD] Error loading file:', err);
      setError(err.message || 'Failed to load CAD file');
    } finally {
      setLoading(false);
    }
  }, [fileUrl, fileType, onDatabaseLoaded, onWorldTransformReady, onLayerToggleReady, onEntityOpsReady]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg">
        <p className="text-muted-foreground">Select a CAD file to view</p>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col" style={{ contain: 'strict' }}>
      <div
        ref={containerCallbackRef}
        className="absolute inset-0 overflow-hidden bg-muted/10"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
            <p className="text-sm text-muted-foreground">Loading CAD file...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { insunitsToLabel };
export default CadCanvas;
