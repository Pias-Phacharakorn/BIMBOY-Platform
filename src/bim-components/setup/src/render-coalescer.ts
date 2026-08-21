import * as OBC from "@thatopen/components";

/**
 * Collapses every `renderer.update()` call within one animation frame into a single render.
 *
 * **The problem this solves.** `SimpleRenderer.update()` and `PostproductionRenderer.update()`
 * both gate on `mode === MANUAL && !needsUpdate` — but `mode` defaults to
 * `RendererMode.AUTO`, and this app never changes it. In AUTO the `needsUpdate` flag is never
 * read, so *every* call to `update()` renders the whole scene unconditionally.
 *
 * Nothing calls `update()` just once per frame. `Components.update` is a `requestAnimationFrame`
 * loop that ticks every updateable component, and `Worlds` renders from there — that is render
 * one. On top of it sit five camera-controls listeners (three on `update`, two on `control`)
 * plus six cursor components on `pointermove`, and any path that reaches `update()` renders
 * again. Profiling a 60-model scene measured **2.96 renders per animation frame**, the same
 * framebuffer filled three times at ~3,558 draw calls each — 22.8 ms of a 34.9 ms frame.
 *
 * **Why coalescing and not `RendererMode.MANUAL`.** MANUAL is the vendor's designed answer and
 * would fix idle cost too, but it requires every scene mutation to set `needsUpdate = true`,
 * and *nothing does* — not this app, and not the vendor's own viewport components. Upstream
 * sets that flag almost exclusively in the `TechnicalDrawings` subsystem; `Hoverer` never sets
 * it. Switching to MANUAL therefore freezes vendor visuals (hover, outliner, measurement
 * previews) alongside ours until something else happens to trigger a render. That conversion
 * is a real audit, not a one-liner. This wrapper buys most of the win with none of that risk.
 *
 * **Why it defers rather than drops.** The obvious shape — "render the first call this frame,
 * ignore the rest" — needs a per-frame flag reset, which makes correctness depend on whether
 * our `rAF` callback happens to run before or after the vendor's. Lose that race and a
 * legitimate render is dropped, halving the framerate. Deferring instead is order-independent:
 * the first call schedules one `rAF` that performs exactly one real render, and every further
 * call in that window is absorbed. No render is ever skipped, only merged.
 *
 * ⚠️ **This does not fix idle rendering.** In AUTO the vendor loop still calls `update()` every
 * tick, so a completely static scene still repaints once per frame (~7.84 ms on a 2.4M-triangle
 * model). Capping renders at one per frame is the ceiling this can reach; removing them
 * entirely needs the MANUAL conversion above.
 *
 * ⚠️ **It monkey-patches a vendor method.** If a future version changes `update`'s shape or
 * calls its own renderer internals directly, this silently stops helping rather than breaking
 * loudly. Pinned at `@thatopen/components` 3.4.8 / `components-front` 3.4.4.
 *
 * @returns a teardown that restores the original `update`, for world disposal.
 */
export const setupRenderCoalescer = (world: OBC.World) => {
  const renderer = world.renderer;
  if (!renderer) {
    throw new Error(
      "setupRenderCoalescer: the world must have its renderer before coalescing renders.",
    );
  }

  const original = renderer.update.bind(renderer);
  let scheduled = false;

  renderer.update = () => {
    // Already a render queued for this frame — this call is redundant, absorb it.
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      original();
    });
  };

  return () => {
    renderer.update = original;
  };
};
