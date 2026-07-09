// @ts-nocheck
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";

const FONT_URL =
  "https://thatopen.github.io/engine_components/resources/fonts/PlusJakartaSans-Medium.ttf";

export type DrawingToolKey = "linear" | "angle" | "callout" | null;

export interface DrawingLevel {
  id: string;
  name: string;
  /** World-space Y height of this storey's cut plane, already folding in georeferencing offset. */
  elevationY: number;
}

interface LevelEntry {
  level: DrawingLevel;
  drawing: OBC.TechnicalDrawing;
  viewportId: string;
  projected: boolean;
}

const STOREY_MERGE_TOLERANCE = 0.3;

/**
 * Owns the session-only Drawing Editor engine state: real building-storey
 * levels (discovered via OBC.Views.createFromIfcStoreys), one lazily-created
 * TechnicalDrawing per level (cached for the session), the DrawingEditor
 * instance, and the three MVP annotation tools.
 *
 * Registered once as a singleton in `setup/index.ts` (cheap constructor).
 * `activate()`/`deactivate()` are called by the React panel on tab
 * mount/unmount — nothing 3D exists until `activate()` runs, and everything
 * (including every cached level drawing) is torn down on `deactivate()` so
 * switching tabs resets the drawing. See CONTEXT.md — "Drawing Editor — real
 * per-building-storey Levels (follow-up)".
 */
export class DrawingEditorSetup extends OBC.Component implements OBC.Disposable {
  static readonly uuid = "7a1e4c2b-6f3d-4b9a-8e5c-2d9f7a3b1c6e" as const;
  enabled = true;
  readonly onDisposed = new OBC.Event<string>();
  /** Fires whenever level/drawing/tool/layer/projection state changes — panel & board re-render on this. */
  readonly onChanged = new OBC.Event<void>();

  editor: OBF.DrawingEditor | null = null;
  /** Discovered levels, sorted by elevation descending (Roof first, matches the Levels panel mockup). */
  levels: DrawingLevel[] = [];
  activeLevelId: string | null = null;

  private _mainWorld: OBC.World | null = null;
  private _dimTool: OBF.LinearAnnotationsTool | null = null;
  private _angleTool: OBF.AngleAnnotationsTool | null = null;
  private _calloutTool: OBF.CalloutAnnotationsTool | null = null;
  private _sectionClipId: string | null = null;
  private _clipperWasEnabled = false;
  private _fontLoaded = false;
  /** Bumped on every activate()/deactivate() so stale async work (e.g. after a fast tab switch) can detect it's been superseded. */
  private _generation = 0;
  private _activating: Promise<void> | null = null;
  private readonly _levelCache = new Map<string, LevelEntry>();

  constructor(components: OBC.Components) {
    super(components);
    components.add(DrawingEditorSetup.uuid, this);
  }

  private get activeEntry(): LevelEntry | null {
    return this.activeLevelId ? this._levelCache.get(this.activeLevelId) ?? null : null;
  }

  /** The active level's drawing, or null if no level is selected yet. */
  get drawing() {
    return this.activeEntry?.drawing ?? null;
  }

  /** The active level's floor-plan viewport id. */
  get viewportId() {
    return this.activeEntry?.viewportId ?? null;
  }

  /** Whether the active level has already been projected from the model. */
  get isProjected() {
    return this.activeEntry?.projected ?? false;
  }

  get dimTool() {
    return this._dimTool;
  }

  get angleTool() {
    return this._angleTool;
  }

  get calloutTool() {
    return this._calloutTool;
  }

  get activeToolKey(): DrawingToolKey {
    if (!this.editor) return null;
    const ToolClass = (this.editor as any)._activeToolClass;
    if (ToolClass === OBF.LinearAnnotationsTool) return "linear";
    if (ToolClass === OBF.AngleAnnotationsTool) return "angle";
    if (ToolClass === OBF.CalloutAnnotationsTool) return "callout";
    return null;
  }

  /** Idempotent — re-entrant calls while already active/activating are no-ops. */
  async activate(mainWorld: OBC.World) {
    if (this.editor || this._activating) return this._activating ?? undefined;

    const gen = ++this._generation;
    this._activating = this._doActivate(mainWorld, gen);
    try {
      await this._activating;
    } finally {
      this._activating = null;
    }
  }

  private async _doActivate(mainWorld: OBC.World, gen: number) {
    this._mainWorld = mainWorld;

    const editor = this.components.get(OBF.DrawingEditor);
    editor.onStateChanged.add(this._notify);
    editor.setSource(mainWorld);

    this._dimTool = editor.use(OBF.LinearAnnotationsTool);
    this._angleTool = editor.use(OBF.AngleAnnotationsTool);
    this._calloutTool = editor.use(OBF.CalloutAnnotationsTool);

    this._dimTool.system.onCommit.add(this._notify);
    this._dimTool.system.onDelete.add(this._notify);
    this._angleTool.system.onCommit.add(this._notify);
    this._angleTool.system.onDelete.add(this._notify);
    this._calloutTool.system.onCommit.add(this._notify);
    this._calloutTool.system.onDelete.add(this._notify);
    this._dimTool.system.onMachineStateChanged?.add(this._notify);
    this._angleTool.system.onMachineStateChanged?.add(this._notify);

    this.editor = editor;
    // Notify immediately so the UI unblocks without waiting on the CDN font
    // fetch — text labels just render once it resolves. Fire-and-forget so a
    // slow/blocked network can't hang activation.
    this._notify();

    if (!this._fontLoaded) {
      editor.fonts
        .load(FONT_URL)
        .then(() => {
          if (gen !== this._generation) return;
          this._fontLoaded = true;
          this._notify();
        })
        .catch((err) => {
          console.warn("DrawingEditorSetup: annotation font failed to load — labels will be blank", err);
        });
    }

    await this.discoverLevels(mainWorld, gen);
  }

  /**
   * Disposes a temporary `View` helper from `createFromIfcStoreys` — we only
   * needed its plane/id. Defensive: a helper may already be disposed if this
   * races with `deactivate()` (e.g. React re-invoking effects in dev), which
   * would otherwise double-dispose the same Three.js helper and throw.
   */
  private _disposeTempView(views: OBC.Views, view: OBC.View) {
    try {
      view.dispose();
    } catch {
      // Already disposed elsewhere — safe to ignore.
    }
    views.list.delete(view.id);
  }

  /**
   * Discovers real building storeys from every loaded model via
   * `OBC.Views.createFromIfcStoreys()`, merges storeys across models that
   * fall within STOREY_MERGE_TOLERANCE of each other's elevation (first-seen
   * name wins), and sorts the result descending by elevation. Cheap —
   * metadata only, no geometry projection.
   *
   * `gen` guards against a stale call resuming after `deactivate()` already
   * ran (e.g. a fast tab switch, or React re-invoking effects in dev) — if
   * the generation has moved on, discovered views are disposed but the
   * result is discarded instead of repopulating a deactivated instance.
   */
  async discoverLevels(mainWorld: OBC.World, gen = this._generation) {
    const views = this.components.get(OBC.Views);
    const rawViews = await views.createFromIfcStoreys({ world: mainWorld });

    if (gen !== this._generation) {
      for (const view of rawViews) this._disposeTempView(views, view);
      return;
    }

    const buckets: DrawingLevel[] = [];
    for (const view of rawViews) {
      const elevationY = view.plane.constant;
      const name = view.id;
      this._disposeTempView(views, view);

      const existing = buckets.find((b) => Math.abs(b.elevationY - elevationY) <= STOREY_MERGE_TOLERANCE);
      if (!existing) buckets.push({ id: name, name, elevationY });
    }

    if (gen !== this._generation) return;

    buckets.sort((a, b) => b.elevationY - a.elevationY);

    const seenIds = new Set<string>();
    this.levels = buckets.map((b) => {
      let id = b.id;
      let i = 2;
      while (seenIds.has(id)) id = `${b.id} (${i++})`;
      seenIds.add(id);
      return { ...b, id };
    });

    this._notify();
  }

  /**
   * Switches the active level. Creates + caches that level's TechnicalDrawing
   * on first visit; subsequent visits just switch back (no re-projection).
   * Auto-cancels any in-progress placement first — never blocks the switch.
   */
  async selectLevel(levelId: string, fragments: OBC.FragmentsManager) {
    if (!this.editor || !this._mainWorld) return;
    if (levelId === this.activeLevelId) return;

    const gen = this._generation;
    this._cancelInProgress();

    let entry = this._levelCache.get(levelId);
    if (!entry) {
      const level = this.levels.find((l) => l.id === levelId);
      if (!level) return;
      entry = this._createLevelDrawing(level);
      this._levelCache.set(levelId, entry);
    }

    this.editor.activeDrawing = entry.drawing;
    this.activeLevelId = levelId;
    this._updateSectionClip(entry.drawing);
    this._notify();

    if (!entry.projected) {
      await this._projectLevel(entry, fragments, gen);
    }
  }

  private _createLevelDrawing(level: DrawingLevel): LevelEntry {
    const techDrawings = this.components.get(OBC.TechnicalDrawings);
    const drawing = techDrawings.create(this._mainWorld!);
    // Top-down floor plan: local -Y points toward world -Y (matches how createFromIfcStoreys orients its planes).
    drawing.orientTo(new THREE.Vector3(0, -1, 0));
    drawing.three.position.set(0, level.elevationY, 0);

    const levelIndex = this.levels.findIndex((l) => l.id === level.id);
    const levelAbove = levelIndex > 0 ? this.levels[levelIndex - 1] : null;
    // Capture up to the next level above; the topmost level has no "next" so fall back to a default depth.
    drawing.far = levelAbove ? Math.max(0.5, levelAbove.elevationY - level.elevationY) : 4;

    drawing.layers.create("Visible", { material: new THREE.LineBasicMaterial({ color: 0x000000 }) });
    drawing.layers.create("Hidden", {
      material: new THREE.LineDashedMaterial({ color: 0x888888, dashSize: 0.2, gapSize: 0.1 }),
      visible: false,
    });
    drawing.layers.create("Annotations", { material: new THREE.LineBasicMaterial({ color: 0x000000 }) });
    drawing.activeLayer = "Annotations";

    const viewport = drawing.viewports.create({ left: -25, right: 25, top: 15, bottom: -15, scale: 100, name: level.name });

    return { level, drawing, viewportId: viewport.uuid, projected: false };
  }

  /** Projects edges from every currently loaded model, unioned into one ModelIdMap, onto the given level's drawing. */
  private async _projectLevel(entry: LevelEntry, fragments: OBC.FragmentsManager, gen: number) {
    const modelIdMap: OBC.ModelIdMap = {};
    for (const [modelId, model] of fragments.list) {
      const ids = await model.getItemsIdsWithGeometry();
      if (ids.length > 0) modelIdMap[modelId] = new Set(ids);
    }

    // Bail if deactivate() (or a fresh activate()) superseded this mid-flight —
    // the drawing may already be disposed/detached at this point.
    if (gen !== this._generation) return;

    if (Object.keys(modelIdMap).length > 0) {
      await entry.drawing.addProjectionFromItems(modelIdMap, {
        layers: { visible: "Visible", hidden: "Hidden" },
      });
    }

    if (gen !== this._generation) return;

    entry.projected = true;
    this._notify();
  }

  /** Clips everything above the given drawing's plane so only its projected slice is visible in the 3D viewport. */
  private _updateSectionClip(drawing: OBC.TechnicalDrawing) {
    if (!this._mainWorld) return;
    const clipper = this.components.get(OBC.Clipper);

    if (this._sectionClipId) {
      clipper.delete(this._mainWorld, this._sectionClipId);
      this._sectionClipId = null;
    } else {
      this._clipperWasEnabled = clipper.enabled;
    }
    clipper.enabled = true;

    drawing.three.updateWorldMatrix(true, false);
    const clipNormal = new THREE.Vector3(0, -1, 0)
      .transformDirection(drawing.three.matrixWorld)
      .normalize();
    const clipPoint = new THREE.Vector3()
      .setFromMatrixPosition(drawing.three.matrixWorld)
      .addScaledVector(clipNormal, -0.05);
    this._sectionClipId = clipper.createFromNormalAndCoplanarPoint(this._mainWorld, clipNormal, clipPoint);
    const plane = clipper.list.get(this._sectionClipId);
    if (plane) plane.visible = false;
  }

  private _cancelInProgress() {
    try {
      this.editor?.cancel();
    } catch {
      // Cancelling an idle tool is harmless; ignore.
    }
  }

  /** Cancels in-progress placement, removes the section clip, and clears every cached level's drawing. Safe to call repeatedly. */
  deactivate() {
    // Bump unconditionally (even if there's nothing else below to clean up) so any
    // in-flight activate()/discoverLevels() work detects it's been superseded and bails.
    this._generation++;
    this._activating = null;

    if (!this.editor && this._levelCache.size === 0 && this.levels.length === 0) return;

    this._cancelInProgress();
    if (this.editor) {
      try {
        this.editor.activeTool = null;
        this.editor.onStateChanged.remove(this._notify);
        try {
          // `world.camera`/`renderer` throw once torn down during unrelated teardown — guard defensively.
          if (this._mainWorld?.renderer?.three) {
            this.editor.clearSource(this._mainWorld.renderer.three.domElement);
          }
        } catch {
          // renderer/world already torn down elsewhere — nothing to unbind.
        }
        this.editor.activeDrawing = null;
      } catch {
        // ignore
      }
    }

    try {
      if (this._sectionClipId && this._mainWorld) {
        const clipper = this.components.get(OBC.Clipper);
        clipper.delete(this._mainWorld, this._sectionClipId);
        clipper.enabled = this._clipperWasEnabled;
      }
    } catch {
      // Clipper/world may already be disposed during page-level teardown.
    }

    try {
      const techDrawings = this.components.get(OBC.TechnicalDrawings);
      for (const entry of this._levelCache.values()) {
        techDrawings.list.delete(entry.drawing.uuid);
      }
    } catch {
      // TechnicalDrawings may already be disposed during page-level teardown.
    }

    this._sectionClipId = null;
    this._levelCache.clear();
    this.levels = [];
    this.activeLevelId = null;
    this.editor = null;
    this._dimTool = null;
    this._angleTool = null;
    this._calloutTool = null;
    this._mainWorld = null;
  }

  setActiveTool(tool: DrawingToolKey) {
    if (!this.editor) return;
    this.editor.activeTool =
      tool === "linear"
        ? OBF.LinearAnnotationsTool
        : tool === "angle"
          ? OBF.AngleAnnotationsTool
          : tool === "callout"
            ? OBF.CalloutAnnotationsTool
            : null;
    this._notify();
  }

  setLayerVisible(name: string, visible: boolean) {
    this.drawing?.layers.setVisibility(name, visible);
    this._notify();
  }

  private _notify = () => {
    this.onChanged.trigger();
  };

  dispose() {
    this.deactivate();
    this.onDisposed.trigger(DrawingEditorSetup.uuid);
    this.onDisposed.reset();
  }
}
