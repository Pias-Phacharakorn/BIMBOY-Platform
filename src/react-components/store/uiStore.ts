import { create } from 'zustand'
import type { ViewportBackground } from '@/lib/viewportBackground'

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
  isBackgroundModalOpen: boolean
  setBackgroundModalOpen: (open: boolean) => void
  /**
   * Viewport backdrop. `null` means "no override" — the branded gradient in `style.css` — and is
   * both the initial value and what Reset returns to; see `lib/viewportBackground.ts`.
   *
   * Here rather than in `ToolbarSettings` state because the CSS variable lives on `documentElement`
   * and outlives a React remount: component state could reset and leave the settings row's swatch
   * disagreeing with the viewport.
   */
  viewportBackground: ViewportBackground | null
  setViewportBackground: (background: ViewportBackground | null) => void
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
  isBackgroundModalOpen: false,
  setBackgroundModalOpen: (open) => set({ isBackgroundModalOpen: open }),
  viewportBackground: null,
  setViewportBackground: (background) => set({ viewportBackground: background }),
}))
