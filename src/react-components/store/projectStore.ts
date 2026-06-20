import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Project Store State ──────────────────────────────────────────────────────
interface ProjectState {
  /** Currently active project ID (from URL) */
  activeProjectId: string | null

  /** Layout preference for project list view */
  projectListLayout: 'grid' | 'list'

  /** Last visited sub-route per project (for navigation restoration) */
  lastVisitedRoutes: Record<string, string>

  // ─── Actions ───────────────────────────────────────────────────────────────
  setActiveProjectId: (id: string | null) => void
  setProjectListLayout: (layout: 'grid' | 'list') => void
  setLastVisitedRoute: (projectId: string, route: string) => void
  clearActiveProject: () => void
}

// ─── Zustand Store (with persistence) ────────────────────────────────────────
// Persists layout preference and last-visited routes to localStorage so
// the user's preferences survive page refreshes
export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      projectListLayout: 'grid',
      lastVisitedRoutes: {},

      setActiveProjectId: (id) => set({ activeProjectId: id }),

      setProjectListLayout: (layout) => set({ projectListLayout: layout }),

      setLastVisitedRoute: (projectId, route) =>
        set((state) => ({
          lastVisitedRoutes: {
            ...state.lastVisitedRoutes,
            [projectId]: route,
          },
        })),

      clearActiveProject: () => set({ activeProjectId: null }),
    }),
    {
      name: 'bimboy-project-store',
      // Only persist layout and route preferences, not the active project ID
      partialize: (state) => ({
        projectListLayout: state.projectListLayout,
        lastVisitedRoutes: state.lastVisitedRoutes,
      }),
    },
  ),
)
