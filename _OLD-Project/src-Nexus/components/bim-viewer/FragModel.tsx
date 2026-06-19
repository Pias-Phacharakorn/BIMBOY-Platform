import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDigitalTwinStore, BimModel, IfcElement, getElementLevel } from "@/store/useDigitalTwinStore";

type Props = { model: BimModel };

/**
 * Module-level registry of live FRAG model handles, keyed by bimModel.id.
 * Other in-viewer tools (e.g. the measurement tool) need to raycast against
 * FRAG geometry, which uses its own picking pipeline rather than the THREE
 * raycaster — so they look the models up here.
 */
export const fragModelRegistry = new Map<string, any>();

let sharedFragmentsPromise: Promise<any> | null = null;
let sharedFragmentsTaskQueue: Promise<unknown> = Promise.resolve();

async function getSharedFragments() {
  if (!sharedFragmentsPromise) {
    sharedFragmentsPromise = (async () => {
      const { FragmentsModels } = await import("@thatopen/fragments");
      const workerURL = await FragmentsModels.getWorker();
      const fragments = new FragmentsModels(workerURL);
      fragments.settings.autoCoordinate = true;
      fragments.models.materials.list.onItemSet.add(({ value }: { value: any }) => {
        if ("isLodMaterial" in value && value.isLodMaterial) return;
        value.polygonOffset = true;
        value.polygonOffsetUnits = 1;
        value.polygonOffsetFactor = 1;
      });
      return fragments;
    })();
  }
  return sharedFragmentsPromise;
}

function queueSharedFragmentsTask<T>(task: () => Promise<T>): Promise<T> {
  const run = sharedFragmentsTaskQueue.catch(() => undefined).then(task);
  sharedFragmentsTaskQueue = run.catch(() => undefined);
  return run;
}

/**
 * Renders a single FRAG model into the r3f scene. One <FragModel/> per
 * loaded .frag buffer so federated views (multiple models) work.
 */
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
  const sectionEnabled = useDigitalTwinStore((s) => s.sectionEnabled);
  const sectionY = useDigitalTwinStore((s) => s.sectionY);
  const sectionAxisX = useDigitalTwinStore((s) => s.sectionAxisX);
  const sectionAxisZ = useDigitalTwinStore((s) => s.sectionAxisZ);
  const sectionX = useDigitalTwinStore((s) => s.sectionX);
  const sectionZ = useDigitalTwinStore((s) => s.sectionZ);
  const ghostMode = useDigitalTwinStore((s) => s.ghostMode);
  const measureMode = useDigitalTwinStore((s) => s.measureMode);
  const visible = bimModel.visible;

  const fragmentsRef = useRef<{
    dispose: () => Promise<void>;
    disposeModel?: (modelId: string) => Promise<void>;
    update: (f?: boolean) => Promise<void>;
  } | null>(null);
  const modelRef = useRef<any>(null);
  const objectRef = useRef<THREE.Object3D | null>(null);
  const highlightedRef = useRef<Set<number>>(new Set());
  const highlightedGhostModeRef = useRef(false);
  // IDs currently displayed with ghost-mode opacity. Tracked so we can reset
  // them cleanly when ghost mode toggles off.
  const ghostedRef = useRef<Set<number>>(new Set());
  const sectionEnabledRef = useRef(sectionEnabled);
  const sectionPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionY));
  const sectionXEnabledRef = useRef(sectionAxisX);
  const sectionZEnabledRef = useRef(sectionAxisZ);
  const sectionPlaneXRef = useRef(new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionX));
  const sectionPlaneZRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionZ));
  const allLocalIdsRef = useRef<number[]>([]);
  // Track localIds per category so we can hide/show by category at runtime.
  const idsByCategoryRef = useRef<Map<string, number[]>>(new Map());
  // Precomputed reverse lookup: localId → category (O(1) on pick).
  const idToCategoryRef = useRef<Map<number, string>>(new Map());
  // Throttle fragments.update() so we only re-stream geometry when the
  // camera actually moved. Cuts idle CPU/GPU usage dramatically.
  const lastCamMatrix = useRef(new THREE.Matrix4());
  const idleFramesRef = useRef(0);

  useEffect(() => {
    sectionEnabledRef.current = sectionEnabled;
    sectionPlaneRef.current.constant = sectionY;
    sectionXEnabledRef.current = sectionAxisX;
    sectionZEnabledRef.current = sectionAxisZ;
    sectionPlaneXRef.current.constant = sectionX;
    sectionPlaneZRef.current.constant = sectionZ;
    fragmentsRef.current?.update(true).catch(() => {});
  }, [sectionEnabled, sectionY, sectionAxisX, sectionAxisZ, sectionX, sectionZ]);

  useFrame(({ camera }) => {
    const frags = fragmentsRef.current;
    if (!frags) return;
    if (!camera.matrixWorld.equals(lastCamMatrix.current)) {
      lastCamMatrix.current.copy(camera.matrixWorld);
      idleFramesRef.current = 0;
      frags.update().catch(() => {});
      return;
    }
    // Cheap occasional refresh in case streaming has pending tiles.
    idleFramesRef.current += 1;
    if (idleFramesRef.current % 30 === 0) frags.update().catch(() => {});
  });

  // Load buffer once.
  useEffect(() => {
    let cancelled = false;
    const buffer = bimModel.buffer;
    if (!buffer) return;

    (async () => {
      try {
        if (cancelled) return;
        const fragments = await getSharedFragments();
        fragmentsRef.current = fragments as unknown as typeof fragmentsRef.current;

        // IMPORTANT: clone the buffer — fragments.load transfers it to its
        // worker and detaches the original. Without the copy, any remount
        // (StrictMode, HMR, re-add) re-uses a detached ArrayBuffer and the
        // WASM picker throws "memory access out of bounds".
        const bufferCopy = buffer.slice(0);
        const fmodel = await queueSharedFragmentsTask<any>(() =>
          fragments.load(bufferCopy, {
            modelId: bimModel.id,
            camera: camera as THREE.PerspectiveCamera,
          }),
        );
        if (cancelled) {
          await fragments.disposeModel?.(bimModel.id).catch(() => {});
          return;
        }

        fmodel.useCamera(camera as THREE.PerspectiveCamera);
        scene.add(fmodel.object);
        objectRef.current = fmodel.object;
        modelRef.current = fmodel;
        fragModelRegistry.set(bimModel.id, fmodel);
        fmodel.getClippingPlanesEvent = () => {
          const planes: THREE.Plane[] = [];
          if (sectionEnabledRef.current) planes.push(sectionPlaneRef.current);
          if (sectionXEnabledRef.current) planes.push(sectionPlaneXRef.current);
          if (sectionZEnabledRef.current) planes.push(sectionPlaneZRef.current);
          return planes;
        };
        await fragments.update(true);

        // Frame the camera around the first model only (skip subsequent ones),
        // but ALWAYS expand the section-plane bounds to cover every loaded model.
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
            // Expand section-plane range to cover this model's vertical extent.
            const ySize = bbox.max.y - bbox.min.y;
            const xSize = bbox.max.x - bbox.min.x;
            const zSize = bbox.max.z - bbox.min.z;
            const pad = Math.max(2, ySize * 0.25);
            const state = useDigitalTwinStore.getState();
            const nextMin = isFirst
              ? bbox.min.y - pad
              : Math.min(state.sectionMin, bbox.min.y - pad);
            const nextMax = isFirst
              ? bbox.max.y + pad
              : Math.max(state.sectionMax, bbox.max.y + pad);
            state.setSectionBounds(nextMin, nextMax, {
              center: [(bbox.min.x + bbox.max.x) / 2, (bbox.min.y + bbox.max.y) / 2, (bbox.min.z + bbox.max.z) / 2],
              size: Math.max(xSize, zSize, ySize) * 1.75,
            });
            // Center the section plane in the middle of the model on first load.
            if (isFirst) {
              state.setSectionY((bbox.min.y + bbox.max.y) / 2);
            }
          }
        }

        const localIds: number[] = await fmodel.getLocalIds();
        allLocalIdsRef.current = localIds;

        // Extract categories. The fragments lib exposes getCategories() and
        // getItemsOfCategories(); fall back to a single bucket if unavailable.
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
                  // API returns { [category]: number[] }
                  for (const [k, v] of Object.entries(res as Record<string, number[]>)) {
                    if (Array.isArray(v) && v.length) grouped[k] = (grouped[k] ?? []).concat(v);
                  }
                }
              } catch {
                // ignore single-category failures
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

        // Build a synthetic IfcElement list (one per item) for properties /
        // MQTT mapping. We use prefixed ids so multiple models don't collide.
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

        // Apply any current toolbar/category visibility state after indexing.
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

        // Background enrichment: pull real attributes (Name, GlobalId, …)
        // and the containing IfcBuildingStorey for every item so that the
        // Source/Categories/Levels panels, the Model Tree, and the
        // Properties panel all show real BIM data instead of "Item <n>" /
        // "Unassigned". Chunked to keep the worker responsive on large
        // models; cancelled cleanly if the component unmounts.
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
      const obj = objectRef.current;
      const frags = fragmentsRef.current;
      fragModelRegistry.delete(bimModel.id);
      objectRef.current = null;
      fragmentsRef.current = null;
      modelRef.current = null;
      if (obj) scene.remove(obj);
      if (frags) frags.disposeModel?.(bimModel.id).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bimModel.buffer, bimModel.id]);

  // Toggle entire-model visibility.
  useEffect(() => {
    const obj = objectRef.current;
    if (!obj) return;
    obj.visible = visible || ghostMode;
  }, [visible, ghostMode]);

  // React to category filters and per-element hide / isolate from the toolbar.
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

  // Click → select. Raycast and upsert the picked item with its real attrs.
  useEffect(() => {
    const dom = gl.domElement;
    let down = { x: 0, y: 0, t: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = async (e: PointerEvent) => {
      // Measurement tool owns clicks while active — don't change selection.
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
          // Clicked empty space → clear selection.
          selectElement(null);
          return;
        }
        // Snap-face section tool — set a section plane from the picked face.
        if (useDigitalTwinStore.getState().snapFaceMode) {
          const n = (hit.normal ?? hit.faceNormal ?? { x: 0, y: 1, z: 0 }) as { x: number; y: number; z: number };
          const p = hit.point as { x: number; y: number; z: number };
          useDigitalTwinStore.getState().snapFaceToPlane(
            [p.x, p.y, p.z],
            [n.x, n.y, n.z],
          );
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

  // Highlight all selected elements that belong to this model.
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

  // Reset prior visibility and opacity state before applying the effective mode.
  await fmodel.resetVisible?.();
  await fmodel.resetOpacity?.(undefined).catch(() => {});
  // Reset previously ghosted IDs so toggling off (or shrinking the hidden
  // set) actually clears the translucent material.
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
    // Ghost mode is a global source/model review mode: every element in every
    // source is shown at 10% opacity, including elements hidden by filters.
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
