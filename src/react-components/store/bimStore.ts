import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import * as OBC from '@thatopen/components'
import * as BUI from '@thatopen/ui'

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
  // Core ThatOpen Engine References
  components: OBC.Components | null
  world: OBC.World | null
  viewport: BUI.Viewport | null

  // UI State
  activeTool: BimTool
  selectedElementIds: number[]
  selectionMap: OBC.ModelIdMap
  activePanel: BimPanel
  engineReady: boolean
  isModelLoading: boolean
  loadedModelIds: string[]

  // Actions
  setBimData: (
    components: OBC.Components | null,
    world: OBC.World | null,
    viewport: BUI.Viewport | null
  ) => void
  clearBimData: () => void
  setActiveTool: (tool: BimTool) => void
  setSelectedElements: (ids: number[], map: OBC.ModelIdMap) => void
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
  components: null as OBC.Components | null,
  world: null as OBC.World | null,
  viewport: null as BUI.Viewport | null,
  activeTool: null as BimTool,
  selectedElementIds: [] as number[],
  selectionMap: {} as OBC.ModelIdMap,
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

    setBimData: (components, world, viewport) =>
      set({ components, world, viewport, engineReady: !!components }),

    clearBimData: () => set(initialState),

    setActiveTool: (tool) => set({ activeTool: tool }),

    setSelectedElements: (ids, map) => set({ selectedElementIds: ids, selectionMap: map }),

    clearSelection: () => set({ selectedElementIds: [], selectionMap: {} }),

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
