# ADR-0033: The right rail suppresses selection affordances, not the look

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/bim-viewport-righttoolbars.md`](../feature/bim-viewport-righttoolbars.md) § FX suppression

## Context

`ViewportRightToolbar` snapshotted and disabled three things whenever `activeTool` held anything
other than `"select"`: `OBF.Hoverer.enabled`, `OBF.Outliner.enabled` **and**
`postproduction.enabled`, restoring the snapshot on return to idle.

The developer raised it as *"why does the Model Render change when I use the sectioning tool"* — and
it did, visibly, the instant **Add plane** was pressed.

The original reasoning was that all three are redundant while `CursorSurface` owns the cursor.

## Decision

Hover and outline stay in the list. **Postproduction comes out.**

The redundancy argument holds for hover and outline, which are *selection affordances*. It does not
transfer to postproduction, which is *how the model looks* — and for sectioning it is actively
backwards, since element edges are exactly what tell you which face you are about to cut.

It also bought nothing measurable. `activeTool` holds a non-select value only while a tool is armed
(`ClipperCursor` returns to `"select"` the moment a placement resolves), so the sole visible effect
was a flat-render flash per plane placed — and the per-frame pass it "saved" is already paid
throughout select mode, which is where the viewport spends nearly all of its time.

## Alternatives rejected

- **Make it a Viewport Setting.** A toggle for a behaviour whose correct value is "on" is a setting
  nobody will find a reason to change.
- **Suppress it for the measure tools but not for clip.** Per-tool exceptions to a blanket rule are
  how the rule became wrong in the first place.
- **Leave it and re-tune the flash.** There is nothing to tune: the pass is either on or off, and
  off is the wrong value for every tool in the rail.

## Consequences

- **The snapshot-and-restore discipline still binds `Hoverer` and `Outliner`.** Engine code that
  flips either will be silently reverted the next time a tool deactivates — Settings → Hover
  Highlight is the known violation. Postproduction is no longer under that discipline, so
  `PostRenderPanel`'s master toggle no longer needs its `activeTool` gate to protect anything.
- ⚠️ **VW-04 — the cut clips surfaces but not edges — is now visible *during* placement too.** This
  exposes nothing new: postproduction is on in select mode, so VW-04 was already on screen the rest
  of the time. If it reads worse while placing, VW-04 is the thing to fix, not this.
- Two guide passages described the old behaviour and were corrected when this landed:
  `bim-viewport-righttoolbars.md` § FX suppression, and the pointer to it in `bim-viewer.md`
  § Gotchas.
