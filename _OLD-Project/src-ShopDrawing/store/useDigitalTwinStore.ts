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

export type BimModel = {
  id: string;
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
  bimActive: boolean;
  iotActive: boolean;
  workflowActive: boolean;
  setModuleActive: (m: "bim" | "iot" | "workflow", v: boolean) => void;

  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

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

  selectedElementIds: string[];
  toggleSelectedElement: (id: string, additive: boolean) => void;
  clearSelection: () => void;
  hideUnselected: () => void;
  selectionSets: SelectionSet[];
  saveSelectionSet: (name: string) => void;
  restoreSelectionSet: (id: string) => void;
  deleteSelectionSet: (id: string) => void;

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

  hiddenIds: Record<string, true>;
  isolatedElementId: string | null;
  hideElement: (id: string) => void;
  unhideElement: (id: string) => void;
  showAllElements: () => void;
  isolateElement: (id: string) => void;

  clipperEnabled: boolean;
  clipperPlaneCount: number;
  setClipperEnabled: (enabled: boolean) => void;
  setClipperPlaneCount: (count: number) => void;
  toggleClipper: () => void;

  ghostMode: boolean;
  toggleGhostMode: () => void;

  renderStyle: "basic" | "color-shadows";
  setRenderStyle: (s: "basic" | "color-shadows") => void;

  walkMode: boolean;
  toggleWalkMode: () => void;
  flyMode: boolean;
  toggleFlyMode: () => void;
  walkEyeHeight: number;

  measureMode: "off" | "distance" | "area" | "angle";
  measurePoints: [number, number, number][];
  measurements: {
    id: string;
    kind: "distance" | "area" | "angle";
    points: [number, number, number][];
    value: number;
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

  screenshotTick: number;
  requestScreenshot: () => void;

  iotOverlayOpen: boolean;
  setIotOverlayOpen: (v: boolean) => void;

  mqttLiveData: Record<string, { value: number; unit: string; ts: number; history: { t: number; v: number }[] }>;
  pushMqtt: (topic: string, value: number, unit: string) => void;

  alertStates: Record<string, AlertState>;
  setAlert: (key: string, alert: AlertState | null) => void;

  notifications: { id: string; channel: string; text: string; ts: number }[];
  pushNotification: (channel: string, text: string) => void;
};

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
  iotActive: false,
  workflowActive: false,
  setModuleActive: (m, v) =>
    set((s) => ({
      bimActive: m === "bim" ? v : s.bimActive,
      iotActive: m === "iot" ? v : s.iotActive,
      workflowActive: m === "workflow" ? v : s.workflowActive,
    })),

  activeProjectId: null,
  setActiveProjectId: (id) => {
    set({
      activeProjectId: id,
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
      clipperEnabled: false,
      clipperPlaneCount: 0,
      focusElementId: null,
      fitTick: 0,
      ghostMode: false,
      measureMode: "off",
      measurePoints: [],
      measurements: [],
    }),

  selectedElementId: null,
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

  ghostMode: false,
  toggleGhostMode: () => set((s) => ({ ghostMode: !s.ghostMode })),

  renderStyle:
    typeof window !== "undefined"
      ? ((window.localStorage.getItem("dt.renderStyle") as "basic" | "color-shadows") ?? "basic")
      : "basic",
  setRenderStyle: (s) => {
    if (typeof window !== "undefined") window.localStorage.setItem("dt.renderStyle", s);
    set({ renderStyle: s });
  },

  walkMode: false,
  toggleWalkMode: () => set((s) => ({ walkMode: !s.walkMode, flyMode: s.walkMode ? s.flyMode : false })),
  flyMode: false,
  toggleFlyMode: () => set((s) => ({ flyMode: !s.flyMode, walkMode: s.flyMode ? s.walkMode : false })),
  walkEyeHeight: 1.7,

  clipperEnabled: false,
  clipperPlaneCount: 0,
  setClipperEnabled: (enabled) => set({ clipperEnabled: enabled }),
  setClipperPlaneCount: (count) => set({ clipperPlaneCount: count }),
  toggleClipper: () => set((s) => ({ clipperEnabled: !s.clipperEnabled })),

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
        const n = [0, 0, 0];
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

  iotOverlayOpen: false,
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

  notifications: [],
  pushNotification: (channel, text) =>
    set((s) => ({
      notifications: [
        { id: Math.random().toString(36).slice(2), channel, text, ts: Date.now() },
        ...s.notifications,
      ].slice(0, 50),
    })),
}));
