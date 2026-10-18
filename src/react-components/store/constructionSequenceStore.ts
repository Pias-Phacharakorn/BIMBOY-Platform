import { create } from 'zustand'

/**
 * The 4D tab's scrub state. Here rather than in React state because the Gantt (left panel) and the
 * timeline (under the viewport) are siblings with the viewport between them, and both read and
 * write the month. Not in the URL: the grilling settled that 4D links are not shareable (yet).
 */
interface ConstructionSequenceState {
  /** The month the viewport shows, in Schedule months. `null` until the tab has a Schedule. */
  month: number | null
  setMonth: (month: number | null) => void
  isPlaying: boolean
  setPlaying: (playing: boolean) => void
  /** Show elements that belong to no Task. Off by default. */
  showUnscheduled: boolean
  setShowUnscheduled: (show: boolean) => void
}

export const useConstructionSequenceStore = create<ConstructionSequenceState>((set) => ({
  month: null,
  setMonth: (month) => set({ month }),
  isPlaying: false,
  setPlaying: (playing) => set({ isPlaying: playing }),
  showUnscheduled: false,
  setShowUnscheduled: (show) => set({ showUnscheduled: show }),
}))
