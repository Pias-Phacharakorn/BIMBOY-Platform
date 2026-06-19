import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore, BimModel, IfcElement, getElementLevel } from "@/store/useDigitalTwinStore";
import { useSharedFragments } from "./FragmentsProvider";
import { getThatOpenClipperPlanes } from "./ThatOpenClipperBridge";

export const fragModelRegistry = new Map<string, any>();

type Props = { model: BimModel };

export function FragModel({ model: bimModel }: Props) {
  const { scene, camera, gl } = useThree();
  const setModelElements = useDigitalTwinStore((s) => s.setModelElements);
  const upsertIfcElement = useDigitalTwinStore((s) => s.upsertIfcElement);
  const selectElement = useDigitalTwinStore((s) => s.selectElement);
  const selectedElementId = useDigitalTwinStore((s) => s.selectedElementId);
  const selectedElementIds = useDigitalTwinStore((s) => s.selectedElementIds);
  const hiddenCategories = useDigitalTwinStore((s) => s.hiddenCategories);
  const hiddenLevels = useDigitalTwinStore((s) => s.hiddenLevels);
  const hiddenIds = useDigitalTwinStore((s) => s.hiddenIds);
  const isolatedElementId = useDigitalTwinStore((s) => s.isolatedElementId);
  const ghostMode = useDigitalTwinStore((s) => s.ghostMode);
  const visible = bimModel.visible;

  const fragmentsRef = useRef<{ dispose: () => Promise<void>; update: (f?: boolean) => Promise<void> } | null>(null);
  const modelRef = useRef<any>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const highlightedRef = useRef<Set<number>>(new Set());
  const highlightedGhostModeRef = useRef(false);
  const ghostedRef = useRef<Set<number>>(new Set());
  const allLocalIdsRef = useRef<number[]>([]);
  const idsByCategoryRef = useRef<Map<string, number[]>>(new Map());
  const idToCategoryRef = useRef<Map<number, string>>(new Map());
  const sharedFragments = useSharedFragments();

  useEffect(() => {
    let cancelled = false;
    const buffer = bimModel.buffer;
    if (!buffer) return;
    if (!sharedFragments) return;
    const fragments = sharedFragments;

    (async () => {
      try {
        // Single shared FragmentsModels instance — required for autoCoordinate
        // to align federated models against the first loaded model
        // (matches Revit/IFC shared coordinates as per ThatOpen tutorial).
        fragmentsRef.current = fragments as unknown as typeof fragmentsRef.current;

        const bufferCopy = buffer.slice(0);
        const fmodel = await fragments.load(bufferCopy, {
          modelId: bimModel.id,
          camera: camera as THREE.PerspectiveCamera,
        });
        if (cancelled) {
          await fragments.disposeModel(bimModel.id).catch(() => {});
          return;
        }

        // Provider already adds fmodel.object to the scene via the
        // models.list.onItemSet listener. We just track refs for cleanup.
        objectRef.current = fmodel.object;
        modelRef.current = fmodel;
        fragModelRegistry.set(bimModel.id, fmodel);
        fmodel.getClippingPlanesEvent = getThatOpenClipperPlanes;

        await fragments.update(true);

        const isFirst = useDigitalTwinStore.getState().models[0]?.id === bimModel.id;
        {
          const bbox = fmodel.box?.isEmpty?.() === false
            ? fmodel.box
            : new THREE.Box3().setFromObject(fmodel.object);
          if (!bbox.isEmpty()) {
            if (isFirst) {
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            bbox.getSize(size);
            bbox.getCenter(center);
            const radius = Math.max(size.x, size.y, size.z) * 0.9;
            const persp = camera as THREE.PerspectiveCamera;
            persp.position.set(center.x + radius, center.y + radius * 0.8, center.z + radius);
            persp.lookAt(center);
            persp.near = Math.max(0.1, radius / 1000);
            persp.far = radius * 100;
            persp.updateProjectionMatrix();
            }
          }
        }

        const localIds: number[] = await fmodel.getLocalIds();
        allLocalIdsRef.current = localIds;

        const categoryMap = new Map<string, number[]>();
        try {
          const cats: string[] = (await fmodel.getCategories?.()) ?? [];
          if (cats.length) {
            const grouped: Record<string, number[]> = {};
            for (const c of cats) {
              const regex = new RegExp(`^${escapeReg(c)}$`);
              try {
                const res = await fmodel.getItemsOfCategories?.([regex]);
                if (res && typeof res === "object") {
                  for (const [k, v] of Object.entries(res as Record<string, number[]>)) {
                    if (Array.isArray(v) && v.length) grouped[k] = (grouped[k] ?? []).concat(v);
                  }
                }
              } catch {
                /* ignore */
              }
            }
            for (const c of cats) {
              const ids = grouped[c] ?? [];
              if (ids.length) categoryMap.set(c, ids);
            }
          }
        } catch (err) {
          console.warn("[FRAG] category enumeration failed", err);
        }
        if (categoryMap.size === 0) categoryMap.set("FragmentItem", localIds);
        idsByCategoryRef.current = categoryMap;

        const idToCat = new Map<number, string>();
        for (const [cat, ids] of categoryMap.entries()) {
          for (const id of ids) idToCat.set(id, cat);
        }
        idToCategoryRef.current = idToCat;
        const elements: IfcElement[] = localIds.map((id) => {
          const cat = idToCat.get(id) ?? "FragmentItem";
          return {
            id: `${bimModel.id}::FRAG-${id}`,
            name: `Item ${id}`,
            type: cat,
            position: [0, 0, 0],
            size: [0.1, 0.1, 0.1],
            color: "#64748b",
            properties: { LocalID: id, Source: bimModel.name },
          };
        });
        setModelElements(bimModel.id, elements);

        const current = useDigitalTwinStore.getState();
        await applyEffectiveVisibility(
          fmodel,
          localIds,
          categoryMap,
          current.hiddenCategories,
          current.hiddenLevels,
          current.models.find((mm) => mm.id === bimModel.id)?.elements ?? [],
          current.hiddenIds,
          current.isolatedElementId,
          `${bimModel.id}::FRAG-`,
          current.ghostMode,
          ghostedRef,
        );
        await fragments.update(true);

        (async () => {
          const CHUNK = 400;
          const enriched = elements.slice();
          const indexById = new Map<number, number>();
          for (let i = 0; i < enriched.length; i++) {
            const lid = Number(enriched[i].id.slice(`${bimModel.id}::FRAG-`.length));
            indexById.set(lid, i);
          }
          for (let i = 0; i < localIds.length; i += CHUNK) {
            if (cancelled) return;
            const slice = localIds.slice(i, i + CHUNK);
            let data: any[] = [];
            try {
              data = await fmodel.getItemsData(slice, {
                attributesDefault: true,
                relations: {
                  ContainedInStructure: { attributes: true, relations: true },
                },
              });
            } catch (err) {
              console.warn("[FRAG] enrich chunk failed", err);
              continue;
            }
            for (let k = 0; k < slice.length; k++) {
              const lid = slice[k];
              const attrs = data?.[k] ?? {};
              const idx = indexById.get(lid);
              if (idx == null) continue;
              const props: Record<string, string | number> = {
                LocalID: lid,
                Source: bimModel.name,
              };
              let name = enriched[idx].name;
              let level = "";
              for (const [key, raw] of Object.entries(attrs)) {
                if (key.startsWith("_")) continue;
                if (key === "ContainedInStructure") {
                  const rel = Array.isArray(raw) ? raw[0] : raw;
                  const storey = (rel as any)?.RelatingStructure ?? rel;
                  const st = Array.isArray(storey) ? storey[0] : storey;
                  const lvlName = (st as any)?.Name?.value ?? (st as any)?.LongName?.value;
                  if (typeof lvlName === "string" && lvlName.trim()) {
                    level = lvlName.trim();
                    props["Level"] = level;
                  }
                  continue;
                }
                const v = (raw as { value?: unknown })?.value ?? raw;
                if (v == null) continue;
                if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                  props[key] = typeof v === "boolean" ? String(v) : (v as string | number);
                  if (key === "Name" && typeof v === "string" && v) name = v;
                }
              }
              enriched[idx] = { ...enriched[idx], name, properties: props };
            }
          }
          if (!cancelled) setModelElements(bimModel.id, enriched);
        })().catch((err) => console.warn("[FRAG] enrichment failed", err));
      } catch (err) {
        console.error("[FRAG] load failed", err);
      }
    })();

    return () => {
      cancelled = true;
      fragModelRegistry.delete(bimModel.id);
      objectRef.current = null;
      fragmentsRef.current = null;
      modelRef.current = null;
      // Provider removes the object from the scene via onItemDeleted.
      fragments.disposeModel(bimModel.id).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bimModel.buffer, bimModel.id, sharedFragments]);

  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;
    obj.visible = visible || ghostMode;
  }, [visible, ghostMode]);

  useEffect(() => {
    const fmodel = modelRef.current;
    const frags = fragmentsRef.current;
    if (!fmodel) return;
    applyEffectiveVisibility(
      fmodel,
      allLocalIdsRef.current,
      idsByCategoryRef.current,
      hiddenCategories,
      hiddenLevels,
      useDigitalTwinStore.getState().models.find((mm) => mm.id === bimModel.id)?.elements ?? [],
      hiddenIds,
      isolatedElementId,
      `${bimModel.id}::FRAG-`,
      ghostMode,
      ghostedRef,
    )
      .then(() => frags?.update(true))
      .catch(() => {});
  }, [hiddenIds, hiddenCategories, hiddenLevels, isolatedElementId, bimModel.id, ghostMode, visible]);

  useEffect(() => {
    const dom = gl.domElement;
    let down = { x: 0, y: 0, t: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = async (e: PointerEvent) => {
      if (useDigitalTwinStore.getState().measureMode !== "off") return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 4) return;
      const fmodel = modelRef.current;
      if (!fmodel || (!visible && !useDigitalTwinStore.getState().ghostMode)) return;
      const mouse = new THREE.Vector2(e.clientX, e.clientY);
      try {
        const hit = await fmodel.raycast({ camera, mouse, dom });
        if (!hit) {
          selectElement(null);
          return;
        }
        const localId: number = hit.localId;
        const elementId = `${bimModel.id}::FRAG-${localId}`;
        const [boxes, data] = await Promise.all([
          fmodel.getBoxes([localId]).catch(() => []),
          fmodel.getItemsData([localId], { attributesDefault: true }).catch(() => []),
        ]);
        const box: THREE.Box3 | undefined = boxes?.[0];
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        if (box && !box.isEmpty()) {
          box.getSize(size);
          box.getCenter(center);
        } else {
          center.copy(hit.point);
        }
        const attrs = data?.[0] ?? {};
        const properties: Record<string, string | number> = { LocalID: localId };
        const category = idToCategoryRef.current.get(localId) ?? "FragmentItem";
        let name = `Item ${localId}`;
        for (const [k, v] of Object.entries(attrs)) {
          if (k.startsWith("_")) continue;
          const val = (v as { value?: unknown })?.value ?? v;
          if (val == null) {
            properties[k] = "";
            continue;
          }
          if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            properties[k] = typeof val === "boolean" ? String(val) : (val as string | number);
            if (k === "Name" && typeof val === "string" && val) name = val;
          } else {
            properties[k] = "";
          }
        }
        upsertIfcElement({
          id: elementId,
          name,
          type: category,
          position: [center.x, center.y, center.z],
          size: [size.x || 0.1, size.y || 0.1, size.z || 0.1],
          color: "#64748b",
          properties,
        });
        const additive = e.shiftKey || e.ctrlKey || e.metaKey;
        useDigitalTwinStore.getState().toggleSelectedElement(elementId, additive);
      } catch (err) {
        console.warn("[FRAG] raycast failed", err);
      }
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, upsertIfcElement, selectElement, bimModel.id, visible]);

  useEffect(() => {
    const fmodel = modelRef.current;
    const frags = fragmentsRef.current;
    if (!fmodel) return;
    const prefix = `${bimModel.id}::FRAG-`;
    const selectedIds = useDigitalTwinStore.getState().selectedElementIds;
    const ids = (selectedIds.length ? selectedIds : selectedElementId ? [selectedElementId] : [])
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter((n) => Number.isFinite(n));
    const nextSet = new Set(ids);
    const prevSet = highlightedRef.current;
    const sameSize = prevSet.size === nextSet.size;
    if (sameSize && highlightedGhostModeRef.current === ghostMode && [...prevSet].every((x) => nextSet.has(x))) return;
    (async () => {
      try {
        if (prevSet.size > 0) {
          await fmodel.resetHighlight([...prevSet]).catch(() => {});
        }
        if (nextSet.size > 0) {
          const { RenderedFaces } = await import("@thatopen/fragments");
          const material = {
            color: new THREE.Color("#f59e0b"),
            opacity: ghostMode ? 0.1 : 1,
            transparent: ghostMode,
            renderedFaces: RenderedFaces.TWO,
          };
          await fmodel.highlight([...nextSet], material).catch(() => {});
        }
        highlightedRef.current = nextSet;
        highlightedGhostModeRef.current = ghostMode;
        await frags?.update(true).catch(() => {});
      } catch (err) {
        console.warn("[FRAG] highlight failed", err);
      }
    })();
  }, [selectedElementId, selectedElementIds, bimModel.id, ghostMode]);

  return null;
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function applyEffectiveVisibility(
  fmodel: any,
  allIds: number[],
  catMap: Map<string, number[]>,
  hiddenCategories: Record<string, true>,
  hiddenLevels: Record<string, true>,
  elements: IfcElement[],
  hiddenIds: Record<string, true>,
  isolatedElementId: string | null,
  elementPrefix: string,
  ghostMode = false,
  ghostedRef?: { current: Set<number> },
) {
  const isolatedLocalId = isolatedElementId?.startsWith(elementPrefix)
    ? Number(isolatedElementId.slice(elementPrefix.length))
    : null;
  const activeIsolatedLocalId = isolatedLocalId != null && Number.isFinite(isolatedLocalId) ? isolatedLocalId : null;
  const isolateOtherModel = isolatedElementId != null && activeIsolatedLocalId == null;
  const modelHidden = !useDigitalTwinStore.getState().models.find((m) => `${m.id}::FRAG-` === elementPrefix)?.visible;
  const hiddenByCategory = new Set<number>();
  for (const [cat, ids] of catMap.entries()) {
    if (hiddenCategories[cat]) for (const id of ids) hiddenByCategory.add(id);
  }
  const hiddenByLevel = new Set<number>();
  if (Object.keys(hiddenLevels).length) {
    for (const el of elements) {
      if (!el.id.startsWith(elementPrefix)) continue;
      if (hiddenLevels[getElementLevel(el)]) {
        const lid = Number(el.id.slice(elementPrefix.length));
        if (Number.isFinite(lid)) hiddenByLevel.add(lid);
      }
    }
  }
  const hiddenLocalIds = new Set<number>();
  for (const id of allIds) {
    if (modelHidden || isolateOtherModel || (activeIsolatedLocalId != null && id !== activeIsolatedLocalId)) {
      hiddenLocalIds.add(id);
    } else if (activeIsolatedLocalId == null) {
      if (hiddenIds[`${elementPrefix}${id}`]) hiddenLocalIds.add(id);
      if (hiddenByCategory.has(id)) hiddenLocalIds.add(id);
      if (hiddenByLevel.has(id)) hiddenLocalIds.add(id);
    }
  }

  const hideLocal: number[] = [];
  for (const id of allIds) {
    if (hiddenLocalIds.has(id)) hideLocal.push(id);
  }

  await fmodel.resetVisible?.();
  await fmodel.resetOpacity?.(undefined).catch(() => {});
  const prevGhosted = ghostedRef?.current;
  if (prevGhosted && prevGhosted.size) {
    try {
      await fmodel.resetHighlight?.([...prevGhosted]);
    } catch {
      /* ignore */
    }
    prevGhosted.clear();
  }
  if (ghostMode) {
    await fmodel.setOpacity?.(allIds, 0.1);
    if (ghostedRef) ghostedRef.current = new Set(allIds);
    return;
  }
  if (hideLocal.length) {
    await fmodel.setVisible?.(hideLocal, false);
  } else {
    await fmodel.resetVisible?.();
  }
}
