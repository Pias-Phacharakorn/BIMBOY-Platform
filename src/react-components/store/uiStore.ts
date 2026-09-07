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
   * The user's IFCSpace preference — what the Settings checkbox writes, and the *only* thing that
   * writes it. Never read on its own: the value actually applied to `OBC.Hider` is
   * `showIfcSpaces || ifcSpacesForced`, derived at each reader. See
   * `features/ifc-space-visibility/useIfcSpaceVisibility.ts`.
   *
   * Deliberately not persisted (this store has no `persist` middleware), so every reload starts
   * with spaces hidden.
   */
  showIfcSpaces: boolean
  setShowIfcSpaces: (show: boolean) => void
  /**
   * "Some tab requires IFCSPACE visible" — currently only the Room tab, whose whole content is a
   * list of spaces. Written by `useIfcSpaceVisibility`, never by the checkbox.
   *
   * A flag rather than the tab name so a second tab needing spaces sets the same boolean instead
   * of growing an `||`, and so nothing outside `ModelsView` has to know a tab is called "Room".
   */
  ifcSpacesForced: boolean
  setIfcSpacesForced: (forced: boolean) => void
  /**
   * Bumped whenever something resets viewport visibility wholesale — today only Show All
   * (`ToolbarVisibility`). Anything holding a standing visibility filter watches this and
   * re-asserts itself; without it, one Show All silently defeats the IFCSpace checkbox and the
   * checkbox is left describing a state that is no longer true.
   */
  visibilityEpoch: number
  bumpVisibilityEpoch: () => void

  /**
   * Whether the IOT tab's floating reading chips are drawn.
   *
   * Lives here rather than in the feature so it survives selecting or binding a device and models
   * finishing loading. It is also the escape hatch for clickable chips: they cannot be occluded, so
   * one will eventually sit on an element the user needs to pick, and a single click cannot mean
   * both "select this device" and "pick what is behind it".
   */
  iotChipsVisible: boolean
  setIotChipsVisible: (visible: boolean) => void
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
  /**
   * Full-screen viewport mode — `AppShell` drops the `Sidebar` and `ModelsView` drops the
   * `WorkspaceHeader` while it is set.
   *
   * **Only `useViewportFullscreen` writes this, and only from a `fullscreenchange` event.** The
   * toolbar button asks the browser and writes nothing, so this boolean can never claim a mode the
   * browser is not actually in — which is what makes Esc and F11 exit correctly without this app
   * binding a keydown listener of its own.
   *
   * Deliberately not persisted (this store has no `persist` middleware, and `AppShell`'s
   * neighbouring `sidebarCollapsed` localStorage key is not a precedent to follow here):
   * `requestFullscreen()` needs a user gesture, so a value restored at boot would hide the chrome
   * with no fullscreen behind it.
   */
  isViewportFullscreen: boolean
  setViewportFullscreen: (fullscreen: boolean) => void
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
  showIfcSpaces: false,
  setShowIfcSpaces: (show) => set({ showIfcSpaces: show }),
  ifcSpacesForced: false,
  setIfcSpacesForced: (forced) => set({ ifcSpacesForced: forced }),
  visibilityEpoch: 0,
  bumpVisibilityEpoch: () => set((state) => ({ visibilityEpoch: state.visibilityEpoch + 1 })),

  iotChipsVisible: true,
  setIotChipsVisible: (visible) => set({ iotChipsVisible: visible }),
  viewportBackground: null,
  setViewportBackground: (background) => set({ viewportBackground: background }),
  isViewportFullscreen: false,
  setViewportFullscreen: (fullscreen) => set({ isViewportFullscreen: fullscreen }),
}))
