import { create } from "zustand";

interface ClashState {
  activeClashReportId: string | null;
  setActiveClashReportId: (id: string | null) => void;
}

export const useClashStore = create<ClashState>((set) => ({
  activeClashReportId: null,
  setActiveClashReportId: (id) => set({ activeClashReportId: id }),
}));
