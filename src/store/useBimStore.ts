import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ─── BIM Tool Enum ────────────────────────────────────────────────────────────
export type BimTool =
  | 'select'
  | 'measure'
  | 'clip'
  | 'isolate'
  | 'hide'
  | 'section'
  | null

// ─── BIM Panel Enum ───────────────────────────────────────────────────────────
export type BimPanel = 'properties' | 'tree' | 'minimap' | 'smartviews' | null

// ─── BIM Store State ──────────────────────────────────────────────────────────
interface BimState {
  /** Currently active tool in the BIM viewer */
  activeTool: BimTool

  /** IFC Express IDs of currently selected elements */
  selectedElementIds: number[]

  /** Currently visible side panel */
  activePanel: BimPanel

  /** Whether the BIM engine is fully initialized */
  engineReady: boolean

  /** Whether a model is currently loading */
  isModelLoading: boolean

  /** Currently loaded model fragment IDs */
  loadedModelIds: string[]

  // ─── Actions ───────────────────────────────────────────────────────────────
  setActiveTool: (tool: BimTool) => void
  setSelectedElements: (ids: number[]) => void
  clearSelection: () => void
  setActivePanel: (panel: BimPanel) => void
  setEngineReady: (ready: boolean) => void
  setModelLoading: (loading: boolean) => void
  addLoadedModel: (modelId: string) => void
  removeLoadedModel: (modelId: string) => void
  resetBimState: () => void
}

// ─── Initial State ────────────────────────────────────────────────────────────
const initialState = {
  activeTool: null as BimTool,
  selectedElementIds: [] as number[],
  activePanel: null as BimPanel,
  engineReady: false,
  isModelLoading: false,
  loadedModelIds: [] as string[],
}

// ─── Zustand Store ────────────────────────────────────────────────────────────
// Uses subscribeWithSelector middleware to allow fine-grained subscriptions
// from the OBC BIM engine (non-React context)
export const useBimStore = create<BimState>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setActiveTool: (tool) => set({ activeTool: tool }),

    setSelectedElements: (ids) => set({ selectedElementIds: ids }),

    clearSelection: () => set({ selectedElementIds: [] }),

    setActivePanel: (panel) =>
      set((state) => ({
        activePanel: state.activePanel === panel ? null : panel,
      })),

    setEngineReady: (ready) => set({ engineReady: ready }),

    setModelLoading: (loading) => set({ isModelLoading: loading }),

    addLoadedModel: (modelId) =>
      set((state) => ({
        loadedModelIds: state.loadedModelIds.includes(modelId)
          ? state.loadedModelIds
          : [...state.loadedModelIds, modelId],
      })),

    removeLoadedModel: (modelId) =>
      set((state) => ({
        loadedModelIds: state.loadedModelIds.filter((id) => id !== modelId),
      })),

    resetBimState: () => set(initialState),
  })),
)
