# ADR-0031: The IoT live tick stays in React state and never reaches the OBC world

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/iot.md`](../feature/iot.md)

## Context

Static readings read as broken — a monitoring panel whose numbers never move looks like a failed
fetch, not a calm building. So the IOT tab ticks every 5 seconds.

The app it ticks inside has a hard-won rendering discipline. [ADR-0020](0020-one-render-per-frame-and-hover-on-settle.md)
established one render per frame however many callers ask, with hover work deferred until the camera
settles, and `render-coalescer.ts` exists to enforce it. A 5-second interval that reaches into the
viewport is precisely the kind of caller that erodes that.

The temptation is concrete and will recur: pulse the bound element, tint it by status, animate an
alarm. Each is a small change, and each puts a timer on the render path.

## Decision

**The tick drives React state only.** It never calls into the OBC world, never asks for a render,
and never mutates scene objects.

**The interval is gated on the tab being active**, not on component mount.

## Alternatives rejected

- **Colouring or pulsing geometry on the tick.** Phase 1 and 2 only *zoom* the camera; nothing about
  the feature requires geometry to change on a timer. Adding it means a render every 5 seconds
  forever, in a viewport whose whole render policy exists to avoid exactly that — and it would undo
  ADR-0020 by accident rather than by decision.
- **Mount-scoped interval.** `ModelsView` keeps inactive tabs mounted but `hidden`, so an interval
  scoped to mount runs forever on every other tab in the app — burning a timer, and generating
  readings nobody is looking at.

## Consequences

- Readings on the model itself were therefore out of scope for phases 1–2 and became phase 3's
  problem, where the chips are CSS2D overlays rather than tick-driven scene mutations. That phase is
  merged but unverified — see `docs/feature/iot.md` § Viewport chips.
- If status-coloured geometry is ever wanted, it needs its own decision and its own ADR, weighed
  against ADR-0020 explicitly. Do not add it as an increment to the tick.
- The tick's cost is bounded and visible: it is a `setInterval` in one hook, gated on one boolean.
  Anyone auditing render pressure can rule the IOT tab out by reading that gate.
