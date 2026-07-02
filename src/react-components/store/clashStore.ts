import { create } from 'zustand'

interface ClashState {
  clashes: any[]
  setClashes: (clashes: any[]) => void
  selectedClashId: string | null
  setSelectedClashId: (id: string | null) => void
  filters: Record<string, any>
  setFilters: (filters: Record<string, any>) => void
  activeTab: "Dashboard" | "Clash Reports" | "Matrix" | "History"
  setActiveTab: (tab: "Dashboard" | "Clash Reports" | "Matrix" | "History") => void
  selectedReportId: string | null
  setSelectedReportId: (id: string | null) => void
  quickFilters: {
    onlyCritical: boolean
    unassigned: boolean
    arcVsMep: boolean
  }
  setQuickFilters: (filters: Partial<ClashState["quickFilters"]>) => void
}

export const useClashStore = create<ClashState>((set) => ({
  clashes: [],
  setClashes: (clashes) => set({ clashes }),
  selectedClashId: null,
  setSelectedClashId: (selectedClashId) => set({ selectedClashId }),
  filters: {},
  setFilters: (filters) => set({ filters }),
  activeTab: "Dashboard",
  setActiveTab: (activeTab) => set({ activeTab }),
  selectedReportId: null,
  setSelectedReportId: (selectedReportId) => set({ selectedReportId }),
  quickFilters: {
    onlyCritical: false,
    unassigned: false,
    arcVsMep: false,
  },
  setQuickFilters: (filters) =>
    set((state) => ({
      quickFilters: { ...state.quickFilters, ...filters },
    })),
}))
