import { useEffect, useRef } from "react";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { useBimStore } from "@/react-components/store/bimStore";
import { useUIStore } from "@/react-components/store/uiStore";

/**
 * stats.js frame meter, toggled by the Viewport Settings "Performance" row. Unlike Scene
 * Diagnostics this genuinely is live state, so a checkbox models it exactly.
 *
 * Three deliberate departures from the ThatOpen tutorial snippet this is based on:
 *
 * - ⚠️ **`showPanel(0)`, not `2`.** The panels are `0: FPS`, `1: MS`, `2: MB` — and panel 2 is
 *   only *created* when `self.performance.memory` exists, which is Chromium-only. `showPanel(2)`
 *   on Safari/iOS selects a child that was never added and renders a blank box. stats.js already
 *   cycles panels on click, so MS and MB stay one tap away.
 * - ⚠️ **The render hooks are removed again.** The tutorial only ever calls `.add()`.
 *   `ViewportWrapper` unmounts whenever you leave the model view, so without the matching
 *   `.remove()` every revisit would stack another `begin`/`end` pair on the renderer.
 * - **The DOM lives in a React-owned container**, not `document.body`. Same reason
 *   `MiniMapOverlay` mounts `minimap.uiContainer` into a ref: an element appended to the body
 *   outlives the component that made it.
 */
export function PerformanceOverlay() {
  const world = useBimStore((s) => s.world);
  const showPerformance = useUIStore((s) => s.showPerformance);
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPerformance || !world) return;

    const container = mountRef.current;
    if (!container) return;

    const stats = new Stats();
    stats.showPanel(0);

    // The widget positions itself `fixed` at the viewport corner by default; inside our own
    // absolutely-positioned container it has to sit in normal flow instead.
    stats.dom.style.position = "relative";
    stats.dom.style.top = "";
    stats.dom.style.left = "";
    stats.dom.style.zIndex = "unset";
    container.append(stats.dom);

    const begin = () => stats.begin();
    const end = () => stats.end();

    // `world.renderer` is a getter that can throw once the world is torn down — the same hazard
    // documented under bim-viewer.md § Gotchas for camera access in dispose paths.
    let renderer: typeof world.renderer | null = null;
    try {
      renderer = world.renderer;
      renderer?.onBeforeUpdate.add(begin);
      renderer?.onAfterUpdate.add(end);
    } catch {
      renderer = null;
    }

    return () => {
      try {
        renderer?.onBeforeUpdate.remove(begin);
        renderer?.onAfterUpdate.remove(end);
      } catch {
        // Renderer already disposed — its event lists went with it.
      }
      stats.dom.remove();
    };
  }, [world, showPerformance]);

  if (!showPerformance) return null;

  return <div ref={mountRef} className="pointer-events-auto absolute left-3 top-3 z-40" />;
}
