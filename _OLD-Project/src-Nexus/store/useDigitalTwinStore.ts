import { create } from "zustand";

export type IfcElement = {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  properties: Record<string, string | number>;
  mqttTopic?: string;
};

export type IfcModel = {
  id: string;
  name: string;
  elements: IfcElement[];
};

/**
 * A model loaded into the viewer. Multiple models per project = federated view.
 * FRAG models carry a binary `buffer` parsed by @thatopen/fragments;
 * JSON/IFCJSON models carry pre-parsed `elements` directly.
 */
export type BimModel = {
  id: string; // uuid (also used as storage key segment)
  name: string;
  fileType: "frag" | "ifcjson";
  visible: boolean;
  storagePath?: string;
  buffer?: ArrayBuffer | null;
  elements: IfcElement[];
};

export type AlertState = {
  level: "warning" | "critical";
  message: string;
  at: number;
};

export type SavedView = {
  id: string;
  name: string;
  camera: { pos: [number, number, number]; target: [number, number, number] };
  hiddenIds: Record<string, true>;
  hiddenCategories: Record<string, true>;
  hiddenLevels: Record<string, true>;
  isolatedElementId: string | null;
  sectionEnabled: boolean;
  sectionY: number;
  sectionAxisX: boolean;
  sectionAxisZ: boolean;
  sectionX: number;
  sectionZ: number;
  createdAt: number;
};

export type SelectionSet = { id: string; name: string; ids: string[]; createdAt: number };

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type Store = {
  // Module activation
  bimActive: boolean;
  iotActive: boolean;
  workflowActive: boolean;
  setModuleActive: (m: "bim" | "iot" | "workflow", v: boolean) => void;

  // Active project (workspace)
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  // BIM — federated models. `activeIfcModel` is a derived merged view of
  // ALL loaded models (regardless of visibility) so the properties panel,
  // MQTT mapping, and workflow engine keep working with stable element ids.
  models: BimModel[];
  activeIfcModel: IfcModel | null;
  hiddenCategories: Record<string, true>;
  hiddenLevels: Record<string, true>;
  addModel: (m: BimModel) => void;
  removeModel: (id: string) => void;
  toggleModelVisible: (id: string) => void;
  setAllModelsVisible: (v: boolean) => void;
  setModelElements: (id: string, elements: IfcElement[]) => void;
  toggleCategory: (cat: string) => void;
  setAllCategoriesVisible: (v: boolean) => void;
  toggleLevel: (lvl: string) => void;
  setAllLevelsVisible: (v: boolean) => void;
  clearAllModels: () => void;
  resetView: () => void;

  selectedElementId: string | null;
  loadIfcModel: (m: IfcModel | null) => void;
  selectElement: (id: string | null) => void;
  setElementMqtt: (elementId: string, topic: string | null) => void;
  upsertIfcElement: (el: IfcElement) => void;

  // Multi-select
  selectedElementIds: string[];
  toggleSelectedElement: (id: string, additive: boolean) => void;
  clearSelection: () => void;
  hideUnselected: () => void;
  selectionSets: SelectionSet[];
  saveSelectionSet: (name: string) => void;
  restoreSelectionSet: (id: string) => void;
  deleteSelectionSet: (id: string) => void;

  // Saved views
  savedViews: SavedView[];
  saveView: (name: string) => void;
  applyView: (id: string) => void;
  deleteView: (id: string) => void;
  pendingView: SavedView | null;
  applyViewTick: number;
  lastCameraState: { pos: [number, number, number]; target: [number, number, number] } | null;
  setLastCameraState: (s: { pos: [number, number, number]; target: [number, number, number] }) => void;
  homeViewTick: number;
  requestHomeView: () => void;

  // Viewer controls
  hiddenIds: Record<string, true>;
  isolatedElementId: string | null;
  hideElement: (id: string) => void;
  unhideElement: (id: string) => void;
  showAllElements: () => void;
  isolateElement: (id: string) => void;

  sectionEnabled: boolean;
  sectionY: number;
  sectionMin: number;
  sectionMax: number;
  sectionPlaneCenter: [number, number, number];
  sectionPlaneSize: number;
  toggleSection: () => void;
  setSectionY: (y: number) => void;
  setSectionBounds: (min: number, max: number, plane?: { center: [number, number, number]; size: number }) => void;

  // Multi-axis section box (X / Z planes — Y is the legacy section above)
  sectionAxisX: boolean;
  sectionAxisZ: boolean;
  sectionX: number;
  sectionZ: number;
  sectionXMin: number;
  sectionXMax: number;
  sectionZMin: number;
  sectionZMax: number;
  toggleSectionAxis: (axis: "x" | "y" | "z") => void;
  setSectionAxis: (axis: "x" | "y" | "z", v: number) => void;

  // Ghost mode — render hidden / non-isolated elements at low opacity
  ghostMode: boolean;
  toggleGhostMode: () => void;

  // Snap-face section tool — next click on a face becomes a section plane
  snapFaceMode: boolean;
  setSnapFaceMode: (v: boolean) => void;
  snapFaceToPlane: (point: [number, number, number], normal: [number, number, number]) => void;

  // Quality preset (controls AA, shadows, env map, pixel ratio, LOD)
  qualityPreset: "low" | "medium" | "high";
  setQualityPreset: (q: "low" | "medium" | "high") => void;

  // Walk / first-person mode (WASD + mouse-look)
  walkMode: boolean;
  toggleWalkMode: () => void;
  walkEyeHeight: number;

  // Measurement tool
  measureMode: "off" | "distance" | "area" | "angle";
  measurePoints: [number, number, number][];
  measurements: {
    id: string;
    kind: "distance" | "area" | "angle";
    points: [number, number, number][];
    value: number; // meters / m² / degrees
  }[];
  setMeasureMode: (m: "off" | "distance" | "area" | "angle") => void;
  addMeasurePoint: (p: [number, number, number]) => void;
  commitMeasurement: () => void;
  clearMeasurements: () => void;

  focusTick: number;
  focusElementId: string | null;
  requestFocus: (id: string | null) => void;
  fitTick: number;
  requestFit: () => void;

  // Screenshot trigger — ViewerCommands listens and renders+downloads.
  screenshotTick: number;
  requestScreenshot: () => void;

  // IoT overlay (collapsible) panel state — shared so toolbar can offset above it
  iotOverlayOpen: boolean;
  setIotOverlayOpen: (v: boolean) => void;

  // IoT
  mqttLiveData: Record<string, { value: number; unit: string; ts: number; history: { t: number; v: number }[] }>;
  pushMqtt: (topic: string, value: number, unit: string) => void;

  // Alerts (keyed by element id OR topic)
  alertStates: Record<string, AlertState>;
  setAlert: (key: string, alert: AlertState | null) => void;
  clearModelLogs: (modelId: string, elementIds?: string[]) => void;

  // Notifications log (LINE/Telegram mock)
  notifications: { id: string; channel: string; text: string; ts: number }[];
  pushNotification: (channel: string, text: string) => void;
};

/** Merge all loaded models into one IfcModel (for properties / mapping lookups). */
function mergeModels(models: BimModel[]): IfcModel | null {
  if (models.length === 0) return null;
  const elements: IfcElement[] = [];
  for (const m of models) elements.push(...m.elements);
  return {
    id: models.map((m) => m.id).join("+"),
    name: models.length === 1 ? models[0].name : `${models.length} models`,
    elements,
  };
}

/** Best-effort extraction of a "Level" / "Storey" from an element's IFC properties. */
export function getElementLevel(el: IfcElement): string {
  for (const [k, v] of Object.entries(el.properties)) {
    const key = k.toLowerCase();
    if (key.includes("level") || key.includes("storey") || key.includes("story") || key.endsWith(".floor")) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "Unassigned";
}

export const useDigitalTwinStore = create<Store>((set) => ({
  bimActive: true,
  iotActive: true,
  workflowActive: true,
  setModuleActive: (m, v) =>
    set((s) => ({
      bimActive: m === "bim" ? v : s.bimActive,
      iotActive: m === "iot" ? v : s.iotActive,
      workflowActive: m === "workflow" ? v : s.workflowActive,
    })),

  activeProjectId:
    typeof window !== "undefined"
      ? window.localStorage.getItem("dt.activeProjectId")
      : null,
  setActiveProjectId: (id) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem("dt.activeProjectId", id);
      else window.localStorage.removeItem("dt.activeProjectId");
    }
    set({
      activeProjectId: id,
      // Reset per-project UI state when switching projects.
      models: [],
      activeIfcModel: null,
      selectedElementId: null,
      hiddenIds: {},
      isolatedElementId: null,
      hiddenCategories: {},
    });
  },

  models: [],
  activeIfcModel: null,
  hiddenCategories: {},
  hiddenLevels: {},
  addModel: (m) =>
    set((s) => {
      const next = [...s.models.filter((x) => x.id !== m.id), m];
      return { models: next, activeIfcModel: mergeModels(next) };
    }),
  removeModel: (id) =>
    set((s) => {
      const next = s.models.filter((m) => m.id !== id);
      return { models: next, activeIfcModel: mergeModels(next) };
    }),
  toggleModelVisible: (id) =>
    set((s) => ({
      models: s.models.map((m) => (m.id === id ? { ...m, visible: !m.visible } : m)),
    })),
  setAllModelsVisible: (v) =>
    set((s) => ({ models: s.models.map((m) => ({ ...m, visible: v })) })),
  setModelElements: (id, elements) =>
    set((s) => {
      const next = s.models.map((m) => (m.id === id ? { ...m, elements } : m));
      return { models: next, activeIfcModel: mergeModels(next) };
    }),
  toggleCategory: (cat) =>
    set((s) => {
      const next = { ...s.hiddenCategories };
      if (next[cat]) delete next[cat];
      else next[cat] = true;
      return { hiddenCategories: next };
    }),
  setAllCategoriesVisible: (v) =>
    set((s) => {
      if (v) return { hiddenCategories: {} };
      const cats: Record<string, true> = {};
      for (const m of s.models) for (const e of m.elements) cats[e.type] = true;
      return { hiddenCategories: cats };
    }),
  toggleLevel: (lvl) =>
    set((s) => {
      const next = { ...s.hiddenLevels };
      if (next[lvl]) delete next[lvl];
      else next[lvl] = true;
      return { hiddenLevels: next };
    }),
  setAllLevelsVisible: (v) =>
    set((s) => {
      if (v) return { hiddenLevels: {} };
      const lvls: Record<string, true> = {};
      for (const m of s.models) for (const e of m.elements) lvls[getElementLevel(e)] = true;
      return { hiddenLevels: lvls };
    }),
  clearAllModels: () =>
    set({ models: [], activeIfcModel: null, selectedElementId: null, hiddenIds: {}, isolatedElementId: null }),
  resetView: () =>
    set({
      selectedElementId: null,
      hiddenIds: {},
      isolatedElementId: null,
      hiddenCategories: {},
      sectionEnabled: false,
      sectionY: 2,
      sectionPlaneCenter: [0, 0, 0],
      sectionPlaneSize: 20,
      focusElementId: null,
      fitTick: 0,
      sectionAxisX: false,
      sectionAxisZ: false,
      ghostMode: false,
      measureMode: "off",
      measurePoints: [],
      measurements: [],
    }),

  selectedElementId: null,
  // Legacy single-model loader — replaces all models with a single demo/JSON model.
  loadIfcModel: (m) =>
    set(() => {
      if (!m) return { models: [], activeIfcModel: null, selectedElementId: null, isolatedElementId: null };
      const model: BimModel = {
        id: m.id,
        name: m.name,
        fileType: "ifcjson",
        visible: true,
        elements: m.elements,
      };
      return { models: [model], activeIfcModel: mergeModels([model]), selectedElementId: null, isolatedElementId: null };
    }),
  selectElement: (id) =>
    set({ selectedElementId: id, selectedElementIds: id ? [id] : [] }),

  selectedElementIds: [],
  toggleSelectedElement: (id, additive) =>
    set((s) => {
      if (!additive) {
        return { selectedElementIds: [id], selectedElementId: id };
      }
      const has = s.selectedElementIds.includes(id);
      const next = has
        ? s.selectedElementIds.filter((x) => x !== id)
        : [...s.selectedElementIds, id];
      return {
        selectedElementIds: next,
        selectedElementId: next[next.length - 1] ?? null,
      };
    }),
  clearSelection: () => set({ selectedElementIds: [], selectedElementId: null }),
  hideUnselected: () =>
    set((s) => {
      const model = s.activeIfcModel;
      if (!model) return {};
      const sel = new Set(
        s.selectedElementIds.length
          ? s.selectedElementIds
          : s.selectedElementId
            ? [s.selectedElementId]
            : [],
      );
      if (sel.size === 0) return {};
      const hidden = { ...s.hiddenIds };
      for (const el of model.elements) {
        if (!sel.has(el.id)) hidden[el.id] = true;
      }
      return { hiddenIds: hidden };
    }),
  selectionSets: [],
  saveSelectionSet: (name) =>
    set((s) => {
      const ids = s.selectedElementIds.length
        ? s.selectedElementIds
        : s.selectedElementId
          ? [s.selectedElementId]
          : [];
      if (ids.length === 0) return {};
      return {
        selectionSets: [
          ...s.selectionSets,
          {
            id: Math.random().toString(36).slice(2),
            name,
            ids: [...ids],
            createdAt: Date.now(),
          },
        ],
      };
    }),
  restoreSelectionSet: (id) =>
    set((s) => {
      const set_ = s.selectionSets.find((x) => x.id === id);
      if (!set_) return {};
      return {
        selectedElementIds: [...set_.ids],
        selectedElementId: set_.ids[set_.ids.length - 1] ?? null,
      };
    }),
  deleteSelectionSet: (id) =>
    set((s) => ({ selectionSets: s.selectionSets.filter((x) => x.id !== id) })),

  savedViews:
    typeof window !== "undefined"
      ? safeParse<SavedView[]>(window.localStorage.getItem("dt.savedViews"), [])
      : [],
  saveView: (name) =>
    set((s) => {
      const cam =
        s.lastCameraState ?? {
          pos: [6, 5, 7] as [number, number, number],
          target: [0, 0, 0] as [number, number, number],
        };
      const view: SavedView = {
        id: Math.random().toString(36).slice(2),
        name,
        camera: cam,
        hiddenIds: { ...s.hiddenIds },
        hiddenCategories: { ...s.hiddenCategories },
        hiddenLevels: { ...s.hiddenLevels },
        isolatedElementId: s.isolatedElementId,
        sectionEnabled: s.sectionEnabled,
        sectionY: s.sectionY,
        sectionAxisX: s.sectionAxisX,
        sectionAxisZ: s.sectionAxisZ,
        sectionX: s.sectionX,
        sectionZ: s.sectionZ,
        createdAt: Date.now(),
      };
      const next = [...s.savedViews, view];
      if (typeof window !== "undefined") {
        window.localStorage.setItem("dt.savedViews", JSON.stringify(next));
      }
      return { savedViews: next };
    }),
  applyView: (id) =>
    set((s) => {
      const v = s.savedViews.find((x) => x.id === id);
      if (!v) return {};
      return {
        hiddenIds: { ...v.hiddenIds },
        hiddenCategories: { ...v.hiddenCategories },
        hiddenLevels: { ...v.hiddenLevels },
        isolatedElementId: v.isolatedElementId,
        sectionEnabled: v.sectionEnabled,
        sectionY: v.sectionY,
        sectionAxisX: v.sectionAxisX,
        sectionAxisZ: v.sectionAxisZ,
        sectionX: v.sectionX,
        sectionZ: v.sectionZ,
        pendingView: v,
        applyViewTick: s.applyViewTick + 1,
      };
    }),
  deleteView: (id) =>
    set((s) => {
      const next = s.savedViews.filter((x) => x.id !== id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("dt.savedViews", JSON.stringify(next));
      }
      return { savedViews: next };
    }),
  pendingView: null,
  applyViewTick: 0,
  lastCameraState: null,
  setLastCameraState: (s) => set({ lastCameraState: s }),
  homeViewTick: 0,
  requestHomeView: () =>
    set((s) => ({ homeViewTick: s.homeViewTick + 1, fitTick: s.fitTick + 1 })),
  upsertIfcElement: (el) =>
    set((s) => {
      // Figure out which model this element belongs to. Element ids are
      // prefixed with `${modelId}::` for federated FRAG models.
      const sep = el.id.indexOf("::");
      const modelId = sep > 0 ? el.id.slice(0, sep) : s.models[0]?.id;
      if (!modelId || s.models.length === 0) return {};
      const nextModels = s.models.map((m) => {
        if (m.id !== modelId) return m;
        const idx = m.elements.findIndex((e) => e.id === el.id);
        const elements =
          idx === -1
            ? [...m.elements, el]
            : m.elements.map((e, i) => (i === idx ? { ...e, ...el } : e));
        return { ...m, elements };
      });
      return { models: nextModels, activeIfcModel: mergeModels(nextModels) };
    }),
  setElementMqtt: (elementId, topic) =>
    set((s) => {
      const nextModels = s.models.map((m) => ({
        ...m,
        elements: m.elements.map((e) =>
          e.id === elementId ? { ...e, mqttTopic: topic ?? undefined } : e,
        ),
      }));
      return { models: nextModels, activeIfcModel: mergeModels(nextModels) };
    }),

  hiddenIds: {},
  isolatedElementId: null,
  hideElement: (id) => set((s) => ({ hiddenIds: { ...s.hiddenIds, [id]: true } })),
  unhideElement: (id) =>
    set((s) => {
      const next = { ...s.hiddenIds };
      delete next[id];
      return { hiddenIds: next };
    }),
  showAllElements: () => set({ hiddenIds: {}, isolatedElementId: null }),
  isolateElement: (id) => set({ hiddenIds: {}, isolatedElementId: id }),


  sectionEnabled: false,
  sectionY: 2,
  sectionMin: -5,
  sectionMax: 20,
  sectionPlaneCenter: [0, 0, 0],
  sectionPlaneSize: 20,
  toggleSection: () => set((s) => ({ sectionEnabled: !s.sectionEnabled })),
  setSectionY: (y) => set({ sectionY: y }),
  setSectionBounds: (min, max, plane) =>
    set((s) => ({
      sectionMin: min,
      sectionMax: max,
      sectionY: Math.min(Math.max(s.sectionY, min), max),
      sectionPlaneCenter: plane?.center ?? s.sectionPlaneCenter,
      sectionPlaneSize: plane ? Math.max(plane.size, 10) : s.sectionPlaneSize,
      sectionXMin: plane ? plane.center[0] - plane.size / 2 : s.sectionXMin,
      sectionXMax: plane ? plane.center[0] + plane.size / 2 : s.sectionXMax,
      sectionZMin: plane ? plane.center[2] - plane.size / 2 : s.sectionZMin,
      sectionZMax: plane ? plane.center[2] + plane.size / 2 : s.sectionZMax,
      sectionX: plane ? plane.center[0] : s.sectionX,
      sectionZ: plane ? plane.center[2] : s.sectionZ,
    })),

  sectionAxisX: false,
  sectionAxisZ: false,
  sectionX: 0,
  sectionZ: 0,
  sectionXMin: -20,
  sectionXMax: 20,
  sectionZMin: -20,
  sectionZMax: 20,
  toggleSectionAxis: (axis) =>
    set((s) => {
      if (axis === "y") return { sectionEnabled: !s.sectionEnabled };
      if (axis === "x") return { sectionAxisX: !s.sectionAxisX };
      return { sectionAxisZ: !s.sectionAxisZ };
    }),
  setSectionAxis: (axis, v) =>
    set(() => {
      if (axis === "y") return { sectionY: v };
      if (axis === "x") return { sectionX: v };
      return { sectionZ: v };
    }),

  ghostMode: false,
  toggleGhostMode: () => set((s) => ({ ghostMode: !s.ghostMode })),

  snapFaceMode: false,
  setSnapFaceMode: (v) => set({ snapFaceMode: v }),
  snapFaceToPlane: (point, normal) =>
    set((s) => {
      const ax = Math.abs(normal[0]);
      const ay = Math.abs(normal[1]);
      const az = Math.abs(normal[2]);
      const axis: "x" | "y" | "z" = ax >= ay && ax >= az ? "x" : ay >= az ? "y" : "z";
      const v = point[axis === "x" ? 0 : axis === "y" ? 1 : 2];
      if (axis === "x") {
        return { sectionAxisX: true, sectionX: v, snapFaceMode: false };
      }
      if (axis === "y") {
        return { sectionEnabled: true, sectionY: v, snapFaceMode: false };
      }
      return { sectionAxisZ: true, sectionZ: v, snapFaceMode: false };
    }),

  qualityPreset:
    typeof window !== "undefined"
      ? ((window.localStorage.getItem("dt.qualityPreset") as "low" | "medium" | "high") ?? "medium")
      : "medium",
  setQualityPreset: (q) => {
    if (typeof window !== "undefined") window.localStorage.setItem("dt.qualityPreset", q);
    set({ qualityPreset: q });
  },

  walkMode: false,
  toggleWalkMode: () => set((s) => ({ walkMode: !s.walkMode })),
  walkEyeHeight: 1.7,

  measureMode: "off",
  measurePoints: [],
  measurements: [],
  setMeasureMode: (m) => set({ measureMode: m, measurePoints: [] }),
  addMeasurePoint: (p) => set((s) => ({ measurePoints: [...s.measurePoints, p] })),
  commitMeasurement: () =>
    set((s) => {
      const pts = s.measurePoints;
      const kind = s.measureMode;
      if (kind === "off" || pts.length < 2) return { measurePoints: [] };
      let value = 0;
      if (kind === "distance" && pts.length >= 2) {
        const [a, b] = pts;
        value = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      } else if (kind === "area" && pts.length >= 3) {
        // Newell's method, projected to triangle fan
        let n = [0, 0, 0];
        for (let i = 0; i < pts.length; i++) {
          const c = pts[i];
          const nxt = pts[(i + 1) % pts.length];
          n[0] += (c[1] - nxt[1]) * (c[2] + nxt[2]);
          n[1] += (c[2] - nxt[2]) * (c[0] + nxt[0]);
          n[2] += (c[0] - nxt[0]) * (c[1] + nxt[1]);
        }
        value = Math.hypot(n[0], n[1], n[2]) / 2;
      } else if (kind === "angle" && pts.length >= 3) {
        const [a, b, c] = pts;
        const v1 = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
        const v2 = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
        const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
        const l1 = Math.hypot(v1[0], v1[1], v1[2]);
        const l2 = Math.hypot(v2[0], v2[1], v2[2]);
        value = (Math.acos(Math.max(-1, Math.min(1, dot / (l1 * l2)))) * 180) / Math.PI;
      } else {
        return { measurePoints: [] };
      }
      const id = Math.random().toString(36).slice(2);
      return {
        measurePoints: [],
        measurements: [
          ...s.measurements,
          { id, kind: kind as "distance" | "area" | "angle", points: pts, value },
        ],
      };
    }),
  clearMeasurements: () => set({ measurements: [], measurePoints: [] }),

  focusTick: 0,
  focusElementId: null,
  requestFocus: (id) => set((s) => ({ focusElementId: id, focusTick: s.focusTick + 1 })),
  fitTick: 0,
  requestFit: () => set((s) => ({ fitTick: s.fitTick + 1, focusElementId: null })),

  screenshotTick: 0,
  requestScreenshot: () => set((s) => ({ screenshotTick: s.screenshotTick + 1 })),

  iotOverlayOpen: true,
  setIotOverlayOpen: (v) => set({ iotOverlayOpen: v }),

  mqttLiveData: {},
  pushMqtt: (topic, value, unit) =>
    set((s) => {
      const prev = s.mqttLiveData[topic];
      const history = [...(prev?.history ?? []), { t: Date.now(), v: value }].slice(-30);
      return {
        mqttLiveData: {
          ...s.mqttLiveData,
          [topic]: { value, unit, ts: Date.now(), history },
        },
      };
    }),

  alertStates: {},
  setAlert: (key, alert) =>
    set((s) => {
      const next = { ...s.alertStates };
      if (alert) next[key] = alert;
      else delete next[key];
      return { alertStates: next };
    }),
  clearModelLogs: (modelId, elementIds = []) =>
    set((s) => {
      const scopedIds = new Set(elementIds);
      const hasModelPrefix = (value: string) => value.startsWith(`${modelId}::`);
      const alertStates = { ...s.alertStates };
      for (const key of Object.keys(alertStates)) {
        if (hasModelPrefix(key) || scopedIds.has(key)) delete alertStates[key];
      }
      return {
        alertStates,
        notifications: s.notifications.filter((n) => {
          if (hasModelPrefix(n.text)) return false;
          for (const id of scopedIds) if (n.text.includes(id)) return false;
          return true;
        }),
      };
    }),

  notifications: [],
  pushNotification: (channel, text) =>
    set((s) => ({
      notifications: [
        { id: Math.random().toString(36).slice(2), channel, text, ts: Date.now() },
        ...s.notifications,
      ].slice(0, 50),
    })),
}));

// Sample model used by the BIM viewer when none is loaded externally.
export const SAMPLE_MODEL: IfcModel = {
  id: "sample-twin",
  name: "Demo Plant - Building A",
  elements: [
    {
      id: "IFC-WALL-001",
      name: "North Wall",
      type: "IfcWall",
      position: [-2, 1, 0],
      size: [0.3, 2, 4],
      color: "#a3a3a3",
      properties: { Material: "Concrete", Height: "2.0m", Length: "4.0m" },
    },
    {
      id: "IFC-SLAB-002",
      name: "Ground Slab",
      type: "IfcSlab",
      position: [0, 0, 0],
      size: [6, 0.15, 4],
      color: "#6b7280",
      properties: { Material: "Reinforced Concrete", Thickness: "150mm" },
    },
    {
      id: "IFC-PIPE-003",
      name: "Steam Pipe",
      type: "IfcPipeSegment",
      position: [1.5, 1.5, -1],
      size: [2.5, 0.25, 0.25],
      color: "#cbd5e1",
      properties: { Diameter: "DN200", Medium: "Steam" },
      mqttTopic: "plant/a/pipe-03/temp",
    },
    {
      id: "IFC-PUMP-004",
      name: "Pump P-01",
      type: "IfcMechanicalFastener",
      position: [-1, 0.6, 1],
      size: [0.8, 0.8, 0.8],
      color: "#f59e0b",
      properties: { Model: "Grundfos CR-32", Rated: "11kW" },
      mqttTopic: "plant/a/pump-01/vibration",
    },
    {
      id: "IFC-TANK-005",
      name: "Storage Tank T-2",
      type: "IfcTank",
      position: [2, 1.2, 1],
      size: [1.4, 2.2, 1.4],
      color: "#2563eb",
      properties: { Capacity: "5000L", Fluid: "Water" },
      mqttTopic: "plant/a/tank-02/level",
    },
  ],
};