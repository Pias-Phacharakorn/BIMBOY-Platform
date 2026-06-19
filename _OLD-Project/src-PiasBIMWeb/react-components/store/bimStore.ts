import { create } from "zustand";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";

interface BIMState {
  components: OBC.Components | null;
  world: OBC.World | null;
  viewport: BUI.Viewport | null;
  setBimData: (
    components: OBC.Components | null,
    world: OBC.World | null,
    viewport: BUI.Viewport | null
  ) => void;
  clearBimData: () => void;
}

export const useBimStore = create<BIMState>((set) => ({
  components: null,
  world: null,
  viewport: null,
  setBimData: (components, world, viewport) =>
    set({ components, world, viewport }),
  clearBimData: () => set({ components: null, world: null, viewport: null }),
}));
