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
  showMinimap: true,
  setShowMinimap: (show) => set({ showMinimap: show }),
}))
