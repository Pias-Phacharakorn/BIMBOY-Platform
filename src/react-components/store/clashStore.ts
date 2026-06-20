import { create } from 'zustand'

interface ClashState {
  clashes: any[]
  setClashes: (clashes: any[]) => void
  selectedClashId: string | null
  setSelectedClashId: (id: string | null) => void
  filters: Record<string, any>
  setFilters: (filters: Record<string, any>) => void
}

export const useClashStore = create<ClashState>((set) => ({
  clashes: [],
  setClashes: (clashes) => set({ clashes }),
  selectedClashId: null,
  setSelectedClashId: (selectedClashId) => set({ selectedClashId }),
  filters: {},
  setFilters: (filters) => set({ filters }),
}))
