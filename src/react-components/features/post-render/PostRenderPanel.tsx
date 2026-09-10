import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import * as OBF from "@thatopen/components-front";
import { PanelSection } from "@/react-components/components/layout";
import { useBimStore } from "@/react-components/store/bimStore";
import { ColorRow, SelectRow, SliderRow, ToggleRow } from "@/react-components/components/ui";
import {
  POSTPRODUCTION_PRESET,
  PD_DEFAULTS,
  applyPostproductionPreset,
  aoPassOf,
  getPostproduction,
  type AoParameters,
  type PdParameters,
  type Postproduction,
} from "@/bim-components";

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
 * `needsUpdate` (see `render-coalescer.ts`, and `docs/adr/0020-one-render-per-frame-and-hover-on-settle.md`).
 */

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

const hex = (color: THREE.Color) => `#${color.getHexString()}`;

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
      // Read-only: the preset is installed on the world at bootstrap by `setupPostproduction`,
      // so this only mirrors whatever the passes currently hold — a tab round-trip never
      // overwrites what the user tuned here.
      const outliner = components.get(OBF.Outliner);
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
              apply(applyPostproductionPreset, {
                style: POSTPRODUCTION_PRESET.style,
                outlines: POSTPRODUCTION_PRESET.outlines,
                smaa: POSTPRODUCTION_PRESET.smaa,
                glossEnabled: POSTPRODUCTION_PRESET.glossEnabled,
                edgeWidth: POSTPRODUCTION_PRESET.edgeWidth,
                edgeColor: POSTPRODUCTION_PRESET.edgeColor,
                edgeMode: POSTPRODUCTION_PRESET.edgeMode,
                ao: { ...POSTPRODUCTION_PRESET.ao },
                aoBlend: POSTPRODUCTION_PRESET.aoBlend,
                pd: { ...PD_DEFAULTS },
                selection: { ...POSTPRODUCTION_PRESET.selection },
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
                  outliner.color = new THREE.Color(POSTPRODUCTION_PRESET.selection.color);
                  outliner.fillColor = new THREE.Color(POSTPRODUCTION_PRESET.selection.fillColor);
                  outliner.fillOpacity = POSTPRODUCTION_PRESET.selection.fillOpacity;
                  outliner.thickness = POSTPRODUCTION_PRESET.selection.thickness;
                },
                { selection: { ...POSTPRODUCTION_PRESET.selection } },
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
