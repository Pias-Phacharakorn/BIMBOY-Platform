/** The two tools that crop the model. Named after the component that owns each. */
export type SectioningTool = "clipper" | "box";

/** Flat, React-friendly snapshot of the interlock. */
export interface SectioningArbiterState {
  /** Whichever tool is cutting right now, or `null` when nothing is. */
  live: SectioningTool | null;
  /**
   * The tool the interlock switched off, or `null` when nothing is suspended. A toolbar reads
   * this to explain why its own controls look inactive — without it, a user with three placed
   * cut planes opens the Clip menu, finds three rows switched off, and concludes they lost them.
   */
  suspended: SectioningTool | null;
}
