import { PanelSection } from "@/react-components/components/layout";
import { SliderRow, ToggleRow } from "@/react-components/components/ui";
import { useRealisticView } from "./useRealisticView";

/**
 * Controls for the daylight rig — the three.js Sponza example's GUI minus everything that belonged
 * to its light-probe grid, which this app cannot run (see `RealisticView`'s class doc) — plus this
 * tab's own gloss and ambient occlusion.
 *
 * Mounting this panel is what activates the rig; leaving the tab restores the working viewport.
 *
 * **Gloss and AO are this tab's, not the app's.** `PostRenderPanel` drives the same two passes for
 * the house look; `RealisticView` snapshots them on activate and restores them on deactivate, so
 * the two sets of values never meet. The one render setting still shared with PostRender is the PD
 * denoise block, which the vendor exposes write-only and which is therefore not offered here.
 */
export function RealisticPanel() {
  const { settings, update, updateAo, updateGloss, resetDaylight, resetRender, ready } =
    useRealisticView();

  if (!ready) {
    return (
      <PanelSection label="Daylight" icon="CAMERA" defaultOpen={true}>
        <p className="text-xs text-muted">
          The viewer is still starting up. Daylight controls appear once the world exists.
        </p>
      </PanelSection>
    );
  }

  return (
    <>
      <PanelSection label="Sun" icon="CAMERA" defaultOpen={true}>
        <div className="flex flex-col gap-3.5">
          <SliderRow
            label="Azimuth"
            value={settings.azimuth}
            min={-180}
            max={180}
            step={1}
            onChange={(azimuth) => update({ azimuth })}
          />
          {/* Clamped away from the horizon and the zenith in `applySun` — at 90° the sun direction
              is parallel to Object3D.up and the light's own lookAt degenerates. */}
          <SliderRow
            label="Elevation"
            value={settings.elevation}
            min={5}
            max={85}
            step={1}
            onChange={(elevation) => update({ elevation })}
          />
          <SliderRow
            label="Intensity"
            value={settings.intensity}
            min={0}
            max={10}
            step={0.1}
            onChange={(intensity) => update({ intensity })}
          />
          <ToggleRow
            label="Shadows"
            checked={settings.shadows}
            onChange={(shadows) => update({ shadows })}
            note="The shadow map only re-renders when the sun moves or geometry changes — orbiting is free."
          />
        </div>
      </PanelSection>

      <PanelSection label="Sky & exposure" icon="COLORIZE" defaultOpen={true}>
        <div className="flex flex-col gap-3.5">
          <SliderRow
            label="Exposure"
            value={settings.exposure}
            min={0.1}
            max={3}
            step={0.01}
            onChange={(exposure) => update({ exposure })}
          />
          <SliderRow
            label="Sky haze"
            value={settings.turbidity}
            min={1}
            max={20}
            step={0.5}
            onChange={(turbidity) => update({ turbidity })}
          />
          {/* Scoped to the sun and sky on purpose. Those get moved constantly; gloss and AO get set
              once, and losing them to a "put the sun back" is the reason there are two buttons. */}
          <button
            type="button"
            onClick={resetDaylight}
            className="self-start inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-radius bg-surface-alt text-xs font-semibold text-muted hover:border-accent hover:text-fg transition-colors duration-120"
          >
            Reset daylight
          </button>
        </div>
      </PanelSection>

      <PanelSection label="Gloss" icon="APPLY" defaultOpen={false}>
        <div className="flex flex-col gap-3.5">
          <ToggleRow
            label="Enabled"
            checked={settings.glossEnabled}
            onChange={(enabled) => updateGloss({ enabled })}
            note="Costs a full extra scene render every frame — unlike shadows, it cannot be cached between orbits."
          />
          {/* Not a gloss floor: it is added wherever gloss is *absent*, so a negative value darkens
              every low-gloss surface and the whole sky. See `RENDER_DEFAULTS`. */}
          <SliderRow label="Min gloss" value={settings.gloss.minGloss} min={-1} max={1} step={0.01} onChange={(minGloss) => updateGloss({ minGloss })} />
          <SliderRow label="Max gloss" value={settings.gloss.maxGloss} min={-1} max={1} step={0.01} onChange={(maxGloss) => updateGloss({ maxGloss })} />
          <SliderRow label="Gloss exponent" value={settings.gloss.glossExponent} min={0.1} max={20} step={0.01} onChange={(glossExponent) => updateGloss({ glossExponent })} />
          <SliderRow label="Fresnel exponent" value={settings.gloss.fresnelExponent} min={0.1} max={50} step={0.01} onChange={(fresnelExponent) => updateGloss({ fresnelExponent })} />
          <SliderRow label="Gloss factor" value={settings.gloss.glossFactor} min={0} max={1} step={0.01} onChange={(glossFactor) => updateGloss({ glossFactor })} />
          <SliderRow label="Fresnel factor" value={settings.gloss.fresnelFactor} min={0} max={10} step={0.01} onChange={(fresnelFactor) => updateGloss({ fresnelFactor })} />
        </div>
      </PanelSection>

      <PanelSection label="Ambient occlusion" icon="TRANSPARENT" defaultOpen={false}>
        <div className="flex flex-col gap-3.5">
          <ToggleRow
            label="Screen space radius"
            checked={settings.ao.screenSpaceRadius}
            onChange={(screenSpaceRadius) => updateAo({ screenSpaceRadius })}
          />
          {/* Starts at 0.5 rather than the house look's 1: this tab drops ambient light to a tenth
              and adds real sun shadows, so full-strength AO doubles up on them. */}
          <SliderRow label="Blend intensity" value={settings.aoBlend} min={0} max={1} step={0.01} onChange={(blend) => updateAo({ blend })} />
          <SliderRow label="Radius" value={settings.ao.radius} min={0.01} max={1} step={0.01} onChange={(radius) => updateAo({ radius })} />
          <SliderRow label="Distance exponent" value={settings.ao.distanceExponent} min={1} max={10} step={0.01} onChange={(distanceExponent) => updateAo({ distanceExponent })} />
          <SliderRow label="Thickness" value={settings.ao.thickness} min={0.01} max={10} step={0.01} onChange={(thickness) => updateAo({ thickness })} />
          <SliderRow label="Distance falloff" value={settings.ao.distanceFallOff} min={0} max={1} step={0.01} onChange={(distanceFallOff) => updateAo({ distanceFallOff })} />
          <SliderRow label="Scale" value={settings.ao.scale} min={0.01} max={10} step={0.01} onChange={(scale) => updateAo({ scale })} />
          <SliderRow label="Samples" value={settings.ao.samples} min={2} max={32} step={1} onChange={(samples) => updateAo({ samples })} />

          <button
            type="button"
            onClick={resetRender}
            className="self-start inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-radius bg-surface-alt text-xs font-semibold text-muted hover:border-accent hover:text-fg transition-colors duration-120"
          >
            Reset render
          </button>
        </div>
      </PanelSection>
    </>
  );
}
