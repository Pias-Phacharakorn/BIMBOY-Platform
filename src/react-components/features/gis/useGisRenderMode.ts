import { useEffect } from "react";
import * as OBF from "@thatopen/components-front";
import { getPostproduction } from "@/bim-components";
import { useBimStore } from "@/react-components/store/bimStore";

/**
 * Drops the app's default pen-and-shadows look back to plain colour for as long as the GIS panel
 * is mounted, and puts back whatever was there on the way out.
 *
 * **Why GIS is an exception.** `GisLayer3d` adds its Google/OSM tile groups straight into
 * `world.scene.three`, so streamed photogrammetry goes through the same edge-detection pass as the
 * BIM model. Pen edges over photogrammetry is ink hatching on every roof, tree and kerb — the
 * building-scale failure `POSTPRODUCTION_PRESET` already warns about, only worse.
 *
 * **Why `style` and nothing else.** `postproduction.enabled` is co-owned by
 * `ViewportRightToolbar`, which snapshots and forces it during tool suppression; a second writer
 * of that flag is the ADR-0017 hazard. Swapping the style leaves AO and SMAA alone and keeps the
 * selection outliner working, which needs postproduction on.
 *
 * **Why a mount lifecycle is the tab boundary.** `ModelsView` renders `GisPanel` only while the
 * GIS tab is active, so mounting and unmounting this hook *is* entering and leaving the tab —
 * the same shape `useRealisticView` uses for the daylight rig.
 *
 * The snapshot is read, not assumed: the user may have changed the style in the PostRender tab
 * before opening GIS, and that is what they should get back.
 */
export function useGisRenderMode() {
  const { world } = useBimStore();

  useEffect(() => {
    const postproduction = getPostproduction(world);
    if (!postproduction) return;

    let previousStyle: OBF.PostproductionAspect;
    try {
      previousStyle = postproduction.style;
      postproduction.style = OBF.PostproductionAspect.COLOR;
    } catch (error) {
      console.warn("useGisRenderMode: the render passes are not ready — style left as is.", error);
      return;
    }

    return () => {
      try {
        postproduction.style = previousStyle;
      } catch (error) {
        console.warn("useGisRenderMode: could not restore the previous style.", error);
      }
    };
  }, [world]);
}
