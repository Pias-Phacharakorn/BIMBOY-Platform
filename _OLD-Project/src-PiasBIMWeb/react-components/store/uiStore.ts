import { create } from "zustand";

interface UIState {
  sidebarCollapsed: boolean;
  isProjectModalOpen: boolean;
  userDropdownOpen: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setIsProjectModalOpen: (isOpen: boolean) => void;
  setUserDropdownOpen: (isOpen: boolean) => void;
}

export const useUIStore = create<UIState>((set) => {
  // Load initial sidebar collapsed state from localStorage safely
  const initialSidebarCollapsed = typeof window !== "undefined"
    ? localStorage.getItem("sidebarCollapsed") === "true"
    : false;

  return {
    sidebarCollapsed: initialSidebarCollapsed,
    isProjectModalOpen: false,
    userDropdownOpen: false,

    toggleSidebarCollapsed: () =>
      set((state) => {
        const next = !state.sidebarCollapsed;
        localStorage.setItem("sidebarCollapsed", String(next));
        return { sidebarCollapsed: next };
      }),

    setSidebarCollapsed: (collapsed: boolean) => {
      localStorage.setItem("sidebarCollapsed", String(collapsed));
      set({ sidebarCollapsed: collapsed });
    },

    setIsProjectModalOpen: (isOpen: boolean) =>
      set({ isProjectModalOpen: isOpen }),

    setUserDropdownOpen: (isOpen: boolean) =>
      set({ userDropdownOpen: isOpen }),
  };
});
