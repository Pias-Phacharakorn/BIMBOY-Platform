import { PanelSection } from "@/react-components/components/layout";
import { SliderRow, ToggleRow } from "@/react-components/components/ui";
import { useRealisticView } from "./useRealisticView";

/**
 * Controls for the daylight rig — the three.js Sponza example's GUI minus everything that belonged
 * to its light-probe grid, which this app cannot run (see `RealisticView`'s class doc).
 *
 * Mounting this panel is what activates the rig; leaving the tab restores the working viewport.
 */
export function RealisticPanel() {
  const { settings, update, reset, ready } = useRealisticView();

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
          <button
            type="button"
            onClick={reset}
            className="self-start inline-flex items-center gap-2 px-2.5 py-1 border border-border rounded-radius bg-surface-alt text-xs font-semibold text-muted hover:border-accent hover:text-fg transition-colors duration-120"
          >
            Reset daylight
          </button>
        </div>
      </PanelSection>
    </>
  );
}
