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
  | 'coordinate'
  | null

// ─── BIM Panel Enum ───────────────────────────────────────────────────────────
export type BimPanel = 'properties' | 'tree' | 'minimap' | 'smartviews' | null

// ─── Cloud Model Loading Progress ─────────────────────────────────────────────
export type LoadingFileStatus = 'pending' | 'loading' | 'done' | 'error'
export interface LoadingFile {
  name: string
  status: LoadingFileStatus
}

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
  loadingFiles: LoadingFile[]
  loadedModelIds: string[]
  alignAngle: number
  aligningDirection: 'front' | 'back' | 'left' | 'right' | null

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
  setLoadingFiles: (files: LoadingFile[]) => void
  updateLoadingFileStatus: (name: string, status: LoadingFileStatus) => void
  addLoadedModel: (modelId: string) => void
  removeLoadedModel: (modelId: string) => void
  resetLoadedModels: () => void
  setAlignAngle: (angle: number) => void
  setAligningDirection: (direction: 'front' | 'back' | 'left' | 'right' | null) => void
  resetAlignment: () => void
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
  loadingFiles: [] as LoadingFile[],
  loadedModelIds: [] as string[],
  alignAngle: 0,
  aligningDirection: null as 'front' | 'back' | 'left' | 'right' | null,
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

    setLoadingFiles: (files) => set({ loadingFiles: files }),

    updateLoadingFileStatus: (name, status) =>
      set((state) => ({
        loadingFiles: state.loadingFiles.map((f) =>
          f.name === name ? { ...f, status } : f
        ),
      })),

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

    resetLoadedModels: () => set({ loadedModelIds: [] }),

    setAlignAngle: (angle) => set({ alignAngle: angle }),

    setAligningDirection: (direction) => set({ aligningDirection: direction }),

    resetAlignment: () => set({ alignAngle: 0, aligningDirection: null }),

    resetBimState: () => set(initialState),
  })),
)
