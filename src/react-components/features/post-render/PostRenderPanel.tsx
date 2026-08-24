import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { PanelSection } from "@/react-components/components/layout";
import { useBimStore } from "@/react-components/store/bimStore";
import { ColorRow, SelectRow, SliderRow, ToggleRow } from "./PostRenderControls";

/**
 * Live controls for the world's postproduction passes — the `PostproductionRenderer` tutorial's
 * panel, rebuilt as React (BUI `<bim-*>` is confined to `ViewportWrapper`) and pointed at the
 * real singleton world instead of a demo scene.
 *
 * **The engine is the source of truth.** Values seed from the live passes on mount and are held
 * in local state only, exactly as `ToolbarSettings` does for grid/projection/hover — so nothing
 * persists across a reload and re-opening the tab re-reads reality. `ModelsView` mounts this
 * only while the PostRender tab is active, which is what makes the re-seed happen.
 *
 * **No `update()` calls anywhere.** `RendererMode` is `AUTO` and `setupRenderCoalescer` already
 * guarantees one render per animation frame, so every write here is visible on the next frame.
 * The tutorial's `updateIfManualMode()` is dead code in this app and is not ported — nor is its
 * Manual mode section, which would switch the renderer into a state where nothing sets
 * `needsUpdate` (see `render-coalescer.ts` and CONTEXT.md).
 */

type Postproduction = OBF.PostproductionRenderer["postproduction"];
type AoParameters = Postproduction["defaultAoParameters"];
type AoNumberKey =
  | "radius"
  | "distanceExponent"
  | "thickness"
  | "scale"
  | "samples"
  | "distanceFallOff";
type GlossKey =
  | "minGloss"
  | "maxGloss"
  | "glossExponent"
  | "fresnelExponent"
  | "glossFactor"
  | "fresnelFactor";

interface PdParameters {
  lumaPhi: number;
  depthPhi: number;
  normalPhi: number;
  radius: number;
  radiusExponent: number;
  rings: number;
  samples: number;
}

/**
 * The poisson-denoise pass is **write-only**: `GTAOPass` exposes `updatePdMaterial` but no getter
 * for what it applied, so these seven values cannot be read back off the engine. They seed from
 * the tutorial's constants and live in React state — the one place in this panel where the UI,
 * not the renderer, is the source of truth.
 */
const PD_DEFAULTS: PdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

/**
 * The house look for this view: model colours preserved, near-black edge lines on every element,
 * and ambient occlusion doing the soft shading in reveals and under slabs — the reference the
 * developer asked for. Applied when the PostRender view first opens (see `PRESET_APPLIED`).
 *
 * Tuned for **building scale**, which a first pass got wrong. Edge detection works in screen
 * pixels, not world units, so a line that reads as a fine pencil edge on a 2 m facade close-up
 * becomes ink hatching on a 50 m whole-building view — every plank, pile and railing member gets
 * the same line. Hence a mid-grey edge (`#6b6b6b`) at the width floor, and `GLOBAL` mode, which
 * skips LOD geometry (fewer lines, and the faster of the two paths on a heavy scene).
 *
 * Three values are deliberately off the vendor's defaults:
 * - `distanceExponent: 1` against the vendor's `5.7`, which collapses AO to a hairline contact
 *   seam. Low exponent + `radius: 0.5` is what produces broad soft shading.
 * - `aoBlend: 1` — anything less is invisible against this scene's ambient light (see below).
 * - `fillOpacity: 0.85` against `setupHighlighter`'s `0.3`, which reads as pale green wash over
 *   light surfaces instead of the solid green in the reference.
 *
 * ⚠️ **AO cannot carry the whole look.** `create-world.ts` sets `ambientLight.intensity = 1.5`
 * against `directionalLight.intensity = 1.0`; ambient that high flattens form, so surfaces read
 * uniformly bright no matter what this pass does. The grey-side/white-front modelling in the
 * reference is lighting, and lighting lives in `setup/`.
 *
 * `enabled` is **not** part of the preset: `setupHighlighter` already turns postproduction on,
 * and that flag is co-owned by `ViewportRightToolbar` during tool suppression — writing it from a
 * mount-time preset could land inside that window and fight the arbiter's snapshot.
 */
const PRESET = {
  style: OBF.PostproductionAspect.COLOR_PEN_SHADOWS,
  outlines: true,
  smaa: true,
  glossEnabled: false,
  edgeWidth: 1,
  edgeColor: "#6b6b6b",
  edgeMode: OBF.EdgeDetectionPassMode.GLOBAL,
  ao: {
    screenSpaceRadius: true,
    radius: 0.5,
    distanceExponent: 1,
    thickness: 1.5,
    scale: 2,
    samples: 16,
    distanceFallOff: 1,
  } satisfies AoParameters,
  aoBlend: 1,
  selection: {
    color: "#bcf124",
    fillColor: "#bcf124",
    fillOpacity: 0.85,
    thickness: 3,
  },
};

/**
 * Worlds whose passes have already been given the preset. Keyed on the `Postproduction` instance
 * so the preset lands **once per world**, not once per mount: opening the tab, tuning a slider,
 * leaving and coming back keeps your tweaks. A page reload builds a new world and starts from the
 * preset again, and "Restore preset" re-applies it on demand.
 */
const PRESET_APPLIED = new WeakSet<object>();

const STYLE_OPTIONS = [
  { label: "Basic", value: OBF.PostproductionAspect.COLOR },
  { label: "Pen", value: OBF.PostproductionAspect.PEN },
  { label: "Shadowed Pen", value: OBF.PostproductionAspect.PEN_SHADOWS },
  { label: "Color Pen", value: OBF.PostproductionAspect.COLOR_PEN },
  { label: "Color Shadows", value: OBF.PostproductionAspect.COLOR_SHADOWS },
  { label: "Color Pen Shadows", value: OBF.PostproductionAspect.COLOR_PEN_SHADOWS },
];

const EDGE_MODE_OPTIONS = [
  { label: "Default (with LODs)", value: OBF.EdgeDetectionPassMode.DEFAULT },
  { label: "Global (faster)", value: OBF.EdgeDetectionPassMode.GLOBAL },
];

interface PanelState {
  enabled: boolean;
  outlines: boolean;
  smaa: boolean;
  style: OBF.PostproductionAspect;
  edgeWidth: number;
  edgeColor: string;
  edgeMode: OBF.EdgeDetectionPassMode;
  selection: { thickness: number; fillOpacity: number; color: string; fillColor: string };
  glossEnabled: boolean;
  gloss: Record<GlossKey, number>;
  ao: AoParameters;
  aoBlend: number;
  pd: PdParameters;
}

/**
 * `OBF.AOPass extends GTAOPass` from `three/examples/jsm`, but this repo pins
 * `@types/three@0.156.0` — which predates `GTAOPass` entirely, and `three@0.182` ships no
 * typings for `examples/jsm` — so every inherited member is invisible to `tsc`. Declaring the
 * three we actually use keeps the call sites checked instead of widening the pass to `any`.
 * Verified against `node_modules/three/examples/jsm/postprocessing/GTAOPass.js`.
 */
interface AoPassApi {
  blendIntensity: number;
  updateGtaoMaterial: (parameters: Partial<AoParameters>) => void;
  updatePdMaterial: (parameters: Partial<PdParameters>) => void;
}

const aoPassOf = (postproduction: Postproduction) =>
  postproduction.aoPass as unknown as AoPassApi;

const hex = (color: THREE.Color) => `#${color.getHexString()}`;

/**
 * Writes the whole preset onto the live passes.
 *
 * Order is load-bearing: the AO parameters go in **before** the style, because the vendor's style
 * setter pushes `defaultAoParameters` into the material itself when the style leaves
 * `PEN_SHADOWS`. Applying GTAO/PD explicitly afterwards covers every other transition — the
 * object is otherwise aspirational (the shader ships `distanceExponent: 1` / `thickness: 1`).
 */
const applyPreset = (postproduction: Postproduction, outliner: OBF.Outliner) => {
  Object.assign(postproduction.defaultAoParameters, PRESET.ao);

  postproduction.style = PRESET.style;
  postproduction.outlinesEnabled = PRESET.outlines;
  postproduction.smaaEnabled = PRESET.smaa;
  postproduction.glossEnabled = PRESET.glossEnabled;

  postproduction.edgesPass.width = PRESET.edgeWidth;
  postproduction.edgesPass.color = new THREE.Color(PRESET.edgeColor);
  postproduction.edgesPass.mode = PRESET.edgeMode;

  aoPassOf(postproduction).blendIntensity = PRESET.aoBlend;
  aoPassOf(postproduction).updateGtaoMaterial(postproduction.defaultAoParameters);
  aoPassOf(postproduction).updatePdMaterial(PD_DEFAULTS);

  outliner.color = new THREE.Color(PRESET.selection.color);
  outliner.fillColor = new THREE.Color(PRESET.selection.fillColor);
  outliner.fillOpacity = PRESET.selection.fillOpacity;
  outliner.thickness = PRESET.selection.thickness;
};

/**
 * The vendor's `get postproduction()` **throws** ("Renderer not initialized yet with a world!")
 * rather than returning undefined, and each pass getter throws until `initialize()` has run —
 * which only happens once something sets `enabled = true` (`setupHighlighter` does). So every
 * read and write goes through a try/catch and a missing engine is treated as "not ready yet".
 */
const getPostproduction = (world: OBC.World | null): Postproduction | null => {
  const renderer = world?.renderer as OBF.PostproductionRenderer | undefined;
  if (!renderer) return null;
  try {
    return renderer.postproduction;
  } catch {
    return null;
  }
};

const readState = (postproduction: Postproduction, outliner: OBF.Outliner): PanelState => {
  const { edgesPass, glossPass } = postproduction;
  return {
    enabled: postproduction.enabled,
    outlines: postproduction.outlinesEnabled,
    smaa: postproduction.smaaEnabled,
    style: postproduction.style,
    edgeWidth: edgesPass.width,
    edgeColor: hex(edgesPass.color),
    edgeMode: edgesPass.mode,
    selection: {
      thickness: outliner.thickness,
      fillOpacity: outliner.fillOpacity,
      color: hex(outliner.color),
      fillColor: hex(outliner.fillColor),
    },
    glossEnabled: postproduction.glossEnabled,
    gloss: {
      minGloss: glossPass.minGloss,
      maxGloss: glossPass.maxGloss,
      glossExponent: glossPass.glossExponent,
      fresnelExponent: glossPass.fresnelExponent,
      glossFactor: glossPass.glossFactor,
      fresnelFactor: glossPass.fresnelFactor,
    },
    ao: { ...postproduction.defaultAoParameters },
    aoBlend: aoPassOf(postproduction).blendIntensity,
    pd: { ...PD_DEFAULTS },
  };
};

export function PostRenderPanel() {
  const { components, world, activeTool } = useBimStore();
  const [ui, setUi] = useState<PanelState | null>(null);

  // A viewport tool (Measure / Clip / Coordinate) owns `postproduction.enabled` while it runs:
  // `ViewportRightToolbar` snapshots the flag, forces it false, and restores the snapshot on
  // exit. Writing it from here during that window would make this a second owner of one global —
  // the hazard ADR-0017 is about — so the master toggle is read-only until the tool is released.
  const toolHoldsPostproduction = !!activeTool && activeTool !== "select";

  useEffect(() => {
    const postproduction = getPostproduction(world);
    if (!postproduction || !components) {
      setUi(null);
      return;
    }
    try {
      const outliner = components.get(OBF.Outliner);
      // First open of this view on this world: install the house look. Afterwards the panel only
      // reads, so a tab round-trip never overwrites what the user tuned.
      if (!PRESET_APPLIED.has(postproduction)) {
        applyPreset(postproduction, outliner);
        PRESET_APPLIED.add(postproduction);
      }
      setUi(readState(postproduction, outliner));
    } catch (error) {
      console.warn("PostRenderPanel: postproduction passes are not ready yet.", error);
      setUi(null);
    }
  }, [components, world]);

  /** Writes the engine first, then mirrors the change into state — never the other way round. */
  const apply = useCallback(
    (
      mutate: (postproduction: Postproduction, outliner: OBF.Outliner) => void,
      next: Partial<PanelState>,
    ) => {
      const postproduction = getPostproduction(world);
      if (!postproduction || !components) return;
      try {
        mutate(postproduction, components.get(OBF.Outliner));
      } catch (error) {
        console.warn("PostRenderPanel: could not apply the change.", error);
        return;
      }
      setUi((previous) => (previous ? { ...previous, ...next } : previous));
    },
    [components, world],
  );

  if (!ui) {
    return (
      <PanelSection label="Post Render" icon="COLORIZE" defaultOpen={true}>
        <p className="text-xs text-muted">
          The viewer is still starting up. Postproduction controls appear once the world and its
          render passes exist.
        </p>
      </PanelSection>
    );
  }

  const setAo = (key: AoNumberKey, value: number) =>
    apply(
      (postproduction) => {
        postproduction.defaultAoParameters[key] = value;
        aoPassOf(postproduction).updateGtaoMaterial(postproduction.defaultAoParameters);
      },
      { ao: { ...ui.ao, [key]: value } },
    );

  const setPd = (key: keyof PdParameters, value: number) => {
    const next = { ...ui.pd, [key]: value };
    apply((postproduction) => aoPassOf(postproduction).updatePdMaterial(next), { pd: next });
  };

  const setGloss = (key: GlossKey, value: number) =>
    apply(
      (postproduction) => {
        postproduction.glossPass[key] = value;
      },
      { gloss: { ...ui.gloss, [key]: value } },
    );

  return (
    <>
      <PanelSection label="General" icon="COLORIZE" defaultOpen={true}>
        <div className="flex flex-col gap-3.5">
          <ToggleRow
            label="Postproduction enabled"
            checked={ui.enabled}
            disabled={toolHoldsPostproduction}
            note={
              toolHoldsPostproduction
                ? "Suppressed while a viewport tool is active — close Measure / Section / Coordinate to change it."
                : undefined
            }
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.enabled = value;
              }, { enabled: value })
            }
          />
          <ToggleRow
            label="Outlines enabled"
            checked={ui.outlines}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.outlinesEnabled = value;
              }, { outlines: value })
            }
          />
          <ToggleRow
            label="SMAA anti-aliasing"
            checked={ui.smaa}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.smaaEnabled = value;
              }, { smaa: value })
            }
          />
          <SelectRow
            label="Style"
            value={ui.style}
            options={STYLE_OPTIONS}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.style = value;
              }, { style: value })
            }
          />

          {/* The preset lands once per world, so this is the way back to it after tuning —
              including for the sections below, which the panel otherwise never resets. */}
          <button
            type="button"
            onClick={() =>
              apply(applyPreset, {
                style: PRESET.style,
                outlines: PRESET.outlines,
                smaa: PRESET.smaa,
                glossEnabled: PRESET.glossEnabled,
                edgeWidth: PRESET.edgeWidth,
                edgeColor: PRESET.edgeColor,
                edgeMode: PRESET.edgeMode,
                ao: { ...PRESET.ao },
                aoBlend: PRESET.aoBlend,
                pd: { ...PD_DEFAULTS },
                selection: { ...PRESET.selection },
              })
            }
            className="self-start inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-radius bg-surface-alt text-xs font-semibold text-muted hover:border-accent hover:text-fg transition-colors duration-120"
          >
            Restore preset
          </button>
        </div>
      </PanelSection>

      <PanelSection label="Edges" icon="RULER" defaultOpen={false}>
        <div className="flex flex-col gap-3.5">
          <SliderRow
            label="Width"
            value={ui.edgeWidth}
            min={1}
            max={3}
            step={0.1}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.edgesPass.width = value;
              }, { edgeWidth: value })
            }
          />
          <ColorRow
            label="Edge colour"
            value={ui.edgeColor}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.edgesPass.color = new THREE.Color(value);
              }, { edgeColor: value })
            }
          />
          <SelectRow
            label="Mode"
            value={ui.edgeMode}
            options={EDGE_MODE_OPTIONS}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.edgesPass.mode = value;
              }, { edgeMode: value })
            }
          />
        </div>
      </PanelSection>

      {/*
        Named "Selection outline", not "Outline", because that is what it is: the 3.4.4 typings
        document `Outliner.color/thickness/fillColor/fillOpacity` as delegates to the outline
        pass's "default" group, which `setupHighlighter` configures and binds to the Highlighter's
        select events. These four rows retune every selection in the app, on every tab — hence
        Reset. Driven through `Outliner` rather than `outlinePass` because its setters also copy
        the colour onto the point material.
      */}
      <PanelSection label="Selection outline" icon="SELECT" defaultOpen={false}>
        <div className="flex flex-col gap-3.5">
          <SliderRow
            label="Thickness"
            value={ui.selection.thickness}
            min={1}
            max={10}
            /* Integer on purpose: the pass packs thickness into one byte of its palette texture
               (`Math.round`), so the tutorial's 0.1 steps are lost before the shader sees them. */
            step={1}
            onChange={(value) =>
              apply((_, outliner) => {
                outliner.thickness = value;
              }, { selection: { ...ui.selection, thickness: value } })
            }
          />
          <SliderRow
            label="Fill opacity"
            value={ui.selection.fillOpacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              apply((_, outliner) => {
                outliner.fillOpacity = value;
              }, { selection: { ...ui.selection, fillOpacity: value } })
            }
          />
          <ColorRow
            label="Line colour"
            value={ui.selection.color}
            onChange={(value) =>
              apply((_, outliner) => {
                outliner.color = new THREE.Color(value);
              }, { selection: { ...ui.selection, color: value } })
            }
          />
          <ColorRow
            label="Fill colour"
            value={ui.selection.fillColor}
            onChange={(value) =>
              apply((_, outliner) => {
                outliner.fillColor = new THREE.Color(value);
              }, { selection: { ...ui.selection, fillColor: value } })
            }
          />
          <button
            type="button"
            onClick={() =>
              apply(
                (_, outliner) => {
                  outliner.color = new THREE.Color(PRESET.selection.color);
                  outliner.fillColor = new THREE.Color(PRESET.selection.fillColor);
                  outliner.fillOpacity = PRESET.selection.fillOpacity;
                  outliner.thickness = PRESET.selection.thickness;
                },
                { selection: { ...PRESET.selection } },
              )
            }
            className="self-start inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-radius bg-surface-alt text-xs font-semibold text-muted hover:border-accent hover:text-fg transition-colors duration-120"
          >
            Reset outline to preset
          </button>
        </div>
      </PanelSection>

      <PanelSection label="Gloss" icon="APPLY" defaultOpen={false}>
        <div className="flex flex-col gap-3.5">
          <ToggleRow
            label="Enabled"
            checked={ui.glossEnabled}
            onChange={(value) =>
              apply((postproduction) => {
                postproduction.glossEnabled = value;
              }, { glossEnabled: value })
            }
          />
          <SliderRow label="Min gloss" value={ui.gloss.minGloss} min={-1} max={1} step={0.01} onChange={(v) => setGloss("minGloss", v)} />
          <SliderRow label="Max gloss" value={ui.gloss.maxGloss} min={-1} max={1} step={0.01} onChange={(v) => setGloss("maxGloss", v)} />
          <SliderRow label="Gloss exponent" value={ui.gloss.glossExponent} min={0.1} max={20} step={0.01} onChange={(v) => setGloss("glossExponent", v)} />
          <SliderRow label="Fresnel exponent" value={ui.gloss.fresnelExponent} min={0.1} max={50} step={0.01} onChange={(v) => setGloss("fresnelExponent", v)} />
          <SliderRow label="Gloss factor" value={ui.gloss.glossFactor} min={0} max={1} step={0.01} onChange={(v) => setGloss("glossFactor", v)} />
          <SliderRow label="Fresnel factor" value={ui.gloss.fresnelFactor} min={0} max={10} step={0.01} onChange={(v) => setGloss("fresnelFactor", v)} />
        </div>
      </PanelSection>

      <PanelSection label="Ambient occlusion" icon="TRANSPARENT" defaultOpen={false}>
        <div className="flex flex-col gap-3.5">
          <ToggleRow
            label="Screen space radius"
            checked={ui.ao.screenSpaceRadius}
            onChange={(value) =>
              apply(
                (postproduction) => {
                  postproduction.defaultAoParameters.screenSpaceRadius = value;
                  aoPassOf(postproduction).updateGtaoMaterial(postproduction.defaultAoParameters);
                },
                { ao: { ...ui.ao, screenSpaceRadius: value } },
              )
            }
          />
          <SliderRow
            label="Blend intensity"
            value={ui.aoBlend}
            min={0}
            max={1}
            step={0.01}
            onChange={(value) =>
              apply((postproduction) => {
                aoPassOf(postproduction).blendIntensity = value;
              }, { aoBlend: value })
            }
          />
          <SliderRow label="Radius" value={ui.ao.radius} min={0.01} max={1} step={0.01} onChange={(v) => setAo("radius", v)} />
          <SliderRow label="Distance exponent" value={ui.ao.distanceExponent} min={1} max={10} step={0.01} onChange={(v) => setAo("distanceExponent", v)} />
          <SliderRow label="Thickness" value={ui.ao.thickness} min={0.01} max={10} step={0.01} onChange={(v) => setAo("thickness", v)} />
          <SliderRow label="Distance falloff" value={ui.ao.distanceFallOff} min={0} max={1} step={0.01} onChange={(v) => setAo("distanceFallOff", v)} />
          <SliderRow label="Scale" value={ui.ao.scale} min={0.01} max={10} step={0.01} onChange={(v) => setAo("scale", v)} />
          <SliderRow label="Samples" value={ui.ao.samples} min={2} max={32} step={1} onChange={(v) => setAo("samples", v)} />

          <div className="h-[1px] bg-border/60 my-0.5" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Denoise (write-only)
          </span>

          <SliderRow label="PD luma phi" value={ui.pd.lumaPhi} min={0} max={20} step={0.1} onChange={(v) => setPd("lumaPhi", v)} />
          <SliderRow label="PD depth phi" value={ui.pd.depthPhi} min={0.01} max={20} step={0.1} onChange={(v) => setPd("depthPhi", v)} />
          <SliderRow label="PD normal phi" value={ui.pd.normalPhi} min={0.01} max={20} step={0.1} onChange={(v) => setPd("normalPhi", v)} />
          <SliderRow label="PD radius" value={ui.pd.radius} min={0} max={32} step={1} onChange={(v) => setPd("radius", v)} />
          <SliderRow label="PD radius exponent" value={ui.pd.radiusExponent} min={0.1} max={4} step={0.1} onChange={(v) => setPd("radiusExponent", v)} />
          <SliderRow label="PD rings" value={ui.pd.rings} min={1} max={16} step={0.125} onChange={(v) => setPd("rings", v)} />
          <SliderRow label="PD samples" value={ui.pd.samples} min={2} max={32} step={1} onChange={(v) => setPd("samples", v)} />
        </div>
      </PanelSection>
    </>
  );
}
