import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  activeLayouts: Record<string, string>
  setActiveLayout: (viewId: string, layout: string) => void
  isCloudModalOpen: boolean
  setCloudModalOpen: (open: boolean) => void
  showMinimap: boolean
  setShowMinimap: (show: boolean) => void
  /** Scene Diagnostics panel — a snapshot, recomputed on open and on Refresh. Never live. */
  showSceneDiagnostics: boolean
  setShowSceneDiagnostics: (show: boolean) => void
  /** stats.js FPS meter. Unlike the panel above this genuinely is live state. */
  showPerformance: boolean
  setShowPerformance: (show: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  activeLayouts: {},
  setActiveLayout: (viewId, layout) =>
    set((state) => ({
      activeLayouts: { ...state.activeLayouts, [viewId]: layout },
    })),
  isCloudModalOpen: false,
  setCloudModalOpen: (open) => set({ isCloudModalOpen: open }),
  showMinimap: false,
  setShowMinimap: (show) => set({ showMinimap: show }),
  showSceneDiagnostics: false,
  setShowSceneDiagnostics: (show) => set({ showSceneDiagnostics: show }),
  showPerformance: false,
  setShowPerformance: (show) => set({ showPerformance: show }),
}))
