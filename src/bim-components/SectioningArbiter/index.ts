import * as OBC from "@thatopen/components";
// Relative, not the @/* alias: tsconfig excludes src/bim-components/**, so
// vite-tsconfig-paths does not rewrite aliases inside this folder. Repo-wide convention here.
import { ClipperCursor } from "../ClipperCursor";
import { SectionBox } from "../SectionBox";
import { SectioningArbiterState, SectioningTool } from "./src/types";

export * from "./src";

/**
 * Keeps the two sectioning tools from cropping at once: turn one on and the other is switched
 * off, and switch the winner off again and the loser comes back exactly as it was.
 *
 * ## Why this exists as a third component
 *
 * [ADR-0005](../../../docs/adr/0005-section-box-outside-clipper.md) declined an interlock on the
 * grounds that "forcing an interlock means teaching each feature about the other". An arbiter is
 * what avoids that: `ClipperCursor` and `SectionBox` do not import each other, gain no methods and
 * fire no new events for this. Everything below is built from API they already had — which also
 * keeps a circular import between two classes carrying static `uuid` fields out of the bundle.
 *
 * The mechanism ADR-0005 rejected — `bimStore.activeTool` — **is still rejected**, and this class
 * deliberately does not touch it: `ViewportRightToolbar` suppresses `Hoverer`, `Outliner` *and*
 * `postproduction` whenever `activeTool !== "select"`, so routing the box through it would cost
 * selection outlines and the whole post pass for as long as the box cropped. Only ADR-0005's
 * *consequence* that the box composes with the Clip tool is amended here.
 *
 * ## It derives who is cutting; it is not told
 *
 * Both components already fire `onStateChanged`, so this subscribes those and reads their public
 * state. That is not a shortcut — it is the only shape that works. A bespoke `onActivated` pair
 * signals activation and nothing else, so **nothing would ever fire when the winning tool was
 * switched off**, and the suspended tool would stay suspended with no way back.
 *
 * ## Suspension is reversible, and never silent
 *
 * There is no undo in this app, so nothing is destroyed. Cut planes are switched off through the
 * same `togglePlane` a user clicks, which is what makes it safe: that path ends in
 * `_syncVisibility()`, and so re-applies `suppressDefaultArrow` — `SimplePlane.enabled = true`
 * restores the plane's remembered visibility and with it the vendor's TransformControls arrow.
 *
 * `planeState.enabled` stays the *actual* cutting state, so the Clip menu never claims a plane is
 * cutting when it is not, and {@link state}`.suspended` is what lets the menu say why.
 */
export class SectioningArbiter extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "b4d7e1f2-9c05-4a83-8e6b-2f1a7c9d3e58" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  readonly onStateChanged = new OBC.Event<void>();

  private readonly _components: OBC.Components;

  private _live: SectioningTool | null = null;
  private _suspended: SectioningTool | null = null;
  /**
   * Which cut planes were enabled when the box took over, by plane id. The sole record of user
   * intent while the clipper is suspended, so a restore cannot switch on a plane the user had
   * deliberately switched off — the `fxBaselineRef` pattern from `ViewportRightToolbar`.
   */
  private _planeSnapshot: Map<string, boolean> | null = null;

  /** Previous view of who was cutting, so a *transition* can be told from a steady state. */
  private _clipperWasCutting = false;
  private _boxWasCutting = false;

  /**
   * True while this class is the one mutating the tools. `suspend`/`restore` drive `togglePlane`
   * and `enable`/`disable`, each of which fires the `onStateChanged` this class listens to — so
   * without this flag a restore re-enters, suspends the tool it is restoring *from*, and clobbers
   * its own snapshot.
   */
  private _reconciling = false;
  private readonly _onToolChanged: () => void;

  constructor(components: OBC.Components) {
    super(components);
    this._components = components;
    components.add(SectioningArbiter.uuid, this);

    this._onToolChanged = () => this._reconcile();
    this._clipper.onStateChanged.add(this._onToolChanged);
    this._box.onStateChanged.add(this._onToolChanged);

    // Both tools start idle, but a world can be rebuilt under us — read rather than assume.
    this._clipperWasCutting = this._clipperCuts();
    this._boxWasCutting = this._boxCuts();
  }

  get state(): SectioningArbiterState {
    return { live: this._live, suspended: this._suspended };
  }

  /** The tool the interlock switched off, or `null`. Read by ToolbarClip. */
  get suspendedTool() {
    return this._suspended;
  }

  dispose() {
    this._clipper.onStateChanged.remove(this._onToolChanged);
    this._box.onStateChanged.remove(this._onToolChanged);

    this._planeSnapshot = null;
    this._live = null;
    this._suspended = null;

    this.onDisposed.trigger(SectioningArbiter.uuid);
    this.onDisposed.reset();
    this.onStateChanged.reset();
  }

  /**
   * Cast because `Components.get` is typed for one-argument constructors and `ClipperCursor`
   * takes a world and a viewport too. It is always already registered — `setup` constructs it
   * before this class — so this only ever looks the instance up, never builds one. Same
   * workaround `ToolbarClip` uses.
   */
  private get _clipper() {
    return this._components.get(ClipperCursor as any) as ClipperCursor;
  }

  private get _box() {
    return this._components.get(SectionBox);
  }

  /** Enabled planes are the ones actually registered with the renderer, so this is "is it cutting". */
  private _clipperCuts() {
    return this._clipper.planes.some((plane) => plane.enabled);
  }

  private _boxCuts() {
    return this._box.active;
  }

  /**
   * A plane's `enabled` setter throws with no renderer, and `SectionBox._teardownWorldParts`
   * drops `_active` silently — so during teardown there is nothing safe to do and nothing worth
   * doing. Bail rather than guess.
   */
  private get _canReconcile() {
    const world = this._box.world;
    return !!world?.renderer && !world.isDisposing;
  }

  private _reconcile() {
    if (this._reconciling || !this._canReconcile) return;

    const clipperCuts = this._clipperCuts();
    const boxCuts = this._boxCuts();
    const clipperRose = clipperCuts && !this._clipperWasCutting;
    const boxRose = boxCuts && !this._boxWasCutting;

    if (clipperCuts && boxCuts) {
      // Whichever just started cutting wins; if neither transition is visible (a world rebuilt
      // with both live, say) the incumbent keeps it.
      const winner: SectioningTool = clipperRose
        ? "clipper"
        : boxRose
          ? "box"
          : (this._live ?? "clipper");
      this._suspend(winner === "clipper" ? "box" : "clipper");
      this._live = winner;
    } else if (!clipperCuts && !boxCuts) {
      if (this._suspended) this._restore();
      else this._live = null;
    } else {
      // Exactly one is cutting, which is the state this class exists to produce.
      this._live = clipperCuts ? "clipper" : "box";
      // A tool the user drove back to life on its own is no longer suspended, and any snapshot
      // taken for it is stale: they have expressed fresher intent than it records.
      if (this._suspended === this._live) {
        this._suspended = null;
        this._planeSnapshot = null;
      }
    }

    this._clipperWasCutting = this._clipperCuts();
    this._boxWasCutting = this._boxCuts();
    this.onStateChanged.trigger();
  }

  private _suspend(tool: SectioningTool) {
    if (this._suspended === tool) return;

    this._reconciling = true;
    try {
      if (tool === "clipper") {
        const clipper = this._clipper;
        this._planeSnapshot = new Map(clipper.planes.map((p) => [p.id, p.enabled]));
        for (const plane of [...clipper.planes]) {
          if (plane.enabled) clipper.togglePlane(plane.id, false);
        }
      } else {
        this._box.disable();
      }
      this._suspended = tool;
    } finally {
      this._reconciling = false;
    }
  }

  /** Puts the suspended tool back exactly as it was, skipping anything since deleted. */
  private _restore() {
    const tool = this._suspended;
    if (!tool) return;

    this._reconciling = true;
    try {
      if (tool === "clipper") {
        const clipper = this._clipper;
        for (const [planeId, wasEnabled] of this._planeSnapshot ?? []) {
          if (!wasEnabled) continue;
          if (clipper.planes.some((p) => p.id === planeId)) clipper.togglePlane(planeId, true);
        }
      } else {
        this._box.enable();
      }
    } finally {
      this._reconciling = false;
      this._suspended = null;
      this._planeSnapshot = null;
    }

    this._live = this._clipperCuts() ? "clipper" : this._boxCuts() ? "box" : null;
  }
}
