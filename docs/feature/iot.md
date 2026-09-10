# IOT — authored devices, live readings

> Roadmap: not one of the five numbered items — IOT grew out of the viewer once elements could be
> selected reliably. Phases 1 and 2 are covered here. **Phase 3 (viewport chips) shipped but has not
> been verified — see the last section.**

## Overview

The **IOT** tab in `ModelsView` turns IFC elements into monitored devices. A project admin selects
an element in the viewport and binds it (`IotBindPanel`), choosing which metrics it reports; the
left panel lists every bound device with its live headline reading (`IotDeviceList`), and the right
panel charts that device's recent history (`IotDataPanel`). Clicking a device flies the camera to
its element. A project with nothing bound is empty — there is no seeded roster.

Two shapes are kept deliberately apart, and the split is the load-bearing idea of the feature:

- **The authored device** (`iot_devices` row) carries BIM identity — that is its entire purpose.
- **The telemetry** (`Reading`, `IotProvider`) knows nothing about BIM. Today a mock satisfies that
  interface; a real platform will satisfy the same one. → [ADR-0028](../adr/0028-iot-provider-interface-defers-the-transport.md)

Devices are anchored to `ifc_guid`, never to `local_id` or `model_id`.
→ [ADR-0029](../adr/0029-iot-devices-anchored-to-ifc-guid.md)

## Patterns & conventions

- **The tab's state is owned once, in `ModelsView`.** `useIotTab` composes devices, binding and the
  tick (plus the phase-3 chips — last section), and the view hands the result down as props. The
  left and right panels are siblings with the viewport between them, so they cannot share a provider without wrapping the layout —
  calling the hooks in each panel instead would give the tab two selections, two ticks and two
  device lists.
- **Binding reads the selection the user already made.** `ViewportWrapper` publishes every pick to
  `bimStore` and `useIotBinding` reads it. There is deliberately no arm-then-pick mode: Measure,
  Clip, Sectionbox and Isolate already compete for the pointer — enough that `SectioningArbiter`
  exists to referee them and `ClipperPlacementManager` holds a lifetime-long global Escape handler.
  A fifth claimant would have to negotiate with both, to solve a problem plain selection does not
  have.
- **One device per element**, enforced by `unique (project_id, ifc_guid)`. Deletes are real deletes,
  not soft — a soft-deleted row would keep occupying that unique key, making it impossible to
  re-bind the element it no longer describes.
- **Reads are member-level, writes are project-admin, and RLS is what enforces it.** The UI hides
  write controls from non-admins as a courtesy only; `iotDevicesService.ts` does no authorisation.
- **`Metric` is the database enum**, re-exported from the generated Supabase types rather than
  hand-written as a parallel TypeScript union. Adding a metric therefore has to start with a
  migration — the two cannot drift.
- **Status is computed, never stored.** `statusFor` runs thresholds from `iotThresholds.ts` over the
  live value. A `status` column would go stale the moment a threshold moved, and no real platform
  will hand you *your* thresholds. Thresholds are still global constants; per-project thresholds
  need settings plumbing nobody has asked for yet, and `iotThresholds.ts` is the single place to
  change one meanwhile.
- **Alarming devices sort to the top** with a colour dot. A short alphabetical list is a
  navigation control; one red row at the top is a monitoring tool — and it is what makes
  click-to-zoom worth having, since you zoom to the alarm rather than to the fourth item.
- **Charts are hand-rolled SVG** (`IotSparkline`), not a charting library.
  → [ADR-0030](../adr/0030-hand-rolled-svg-charts-over-a-chart-library.md)
- **The 5-second tick lives in React state and never reaches the OBC world.**
  → [ADR-0031](../adr/0031-iot-tick-never-touches-the-obc-world.md)
- **Nothing in `useIotDevices` is cleared by an effect.** Where a value stops applying it is derived
  away at read time instead. That keeps `react-hooks/set-state-in-effect` satisfied and removes a
  class of flicker; keep new state derived rather than reset.

## Mock telemetry

`mockIotProvider` answers "what is this device reading" and nothing else — it does not know which
devices exist, because they live in the database. That is the same shape a real platform answers,
which is why `listDevices` left the provider interface after phase 1.

- **Values are a pure function of `(deviceId, metric, timeBucket)`.** Nothing accumulates, so a
  value is reproducible across a reload without storing anything, and `MAX_HISTORY_POINTS` *is* the
  ring buffer — a cap on how many buckets are ever requested, with no array to trim or leak. A
  seeded random walk was the grilled design and was replaced during implementation: it needed
  stored state to be reproducible and bought nothing the pure function does not give.
- **A hash of `device_id` also picks the device's behaviour band** — roughly 70% healthy, 15% warn,
  10% alarm, 5% offline. Phase 1 scripted those states into a fixed roster, which is impossible once
  devices are user-created; without the band, every bound device would read healthy and the warn,
  alarm and offline rendering paths would never be seen on a real project.
- **Seeding from `ifc_guid` was rejected** — deleting a device and re-binding the same element would
  replay the identical series, implying the system remembers something the user deleted.
- **Offline must never render as `0`.** Zero is a reading; absent is not.

## Gotchas / watch-outs

- **`element_category` is denormalised on purpose.** Devices are listed even when their model is not
  loaded, and at that moment there is nothing to query — without the stored column those rows would
  have nothing to show under the name. It is display-only and may be stale; never branch on it.
- **Unresolvable devices stay in the list.** A device whose GUID is not in any loaded model still
  shows its readings, just without zoom. Hiding them would make the list lie: a user who bound 20
  devices and sees 6 concludes the data was lost and binds them again, straight into the unique
  constraint. Reading CO₂ should not require geometry to finish loading.
- **`model_id` drifts, and this is not theoretical** — a duplicate upload in this very project
  produced `6ad248cc-…-d8c558989946 (1)`. It is a lookup hint that gets overwritten when wrong,
  never an identity. `local_id` is worse: it changes on every re-export, so a stale one would rebind
  a sensor to an unrelated element silently, which is worse than losing it.
- **The IOT tab does not force IFCSPACE geometry visible, and that is a reversal.** Phase 1 planned
  to force it, because runtime binding *picked* elements and could land on a hidden space. Devices
  are now bound by a user who could see what they selected, so a device on a hidden space is simply
  reported as unlocatable. `useIfcSpaceVisibility(isRoomTab)` — the Room tab is the only forcer.
- **Re-entering the tab regenerates a slightly different past**, since history is walked backwards
  from *now*. Accepted: reproducible history is real work for a benefit nobody looking at a mock
  notices.
- **Never verified:** that `fitToItems` frames a single small element usefully. It has only ever
  been exercised bare (whole model) by `Views2DList`; a lone air terminal may frame far too tight.
  Carried unresolved from phase 1 — the spike was never done.
- **Both databases need the migration.** `iot_devices` and the `iot_metric` enum must exist on PIAS
  *and* RITTA, or the feature breaks with "relation does not exist" the moment somebody switches
  `.env.local` back. → `backend.md` § Two projects, no staging.

## Viewport chips — shipped, not yet verified

Phase 3 put the readings on the model itself: `bim-components/IotView/` (`IotChips.ts`) owns the
scene objects, `useIotChips` mirrors the panel's rows into chip requests, `uiStore.iotChipsVisible`
drives the layer switch, and `.iot-chip` styles them.

**This code is merged but has not been confirmed in the running app**, so it is not documented here
as settled behaviour. Its design, its decisions, and the list of what still needs eyes on it — chip
legibility at real viewport widths, overlap when devices cluster on one ceiling, and one e2e
assertion whose last recorded state was red — live in **`CONTEXT.md` § *IOT phase 3***. Promote that
section into this guide once it has been verified, and add the CSS2D ADR it calls for.

One convention already worth respecting if you touch it: `useIotChips` is a *mirror*. It derives
each chip's status from the same rows the panel renders and hands the result to `IotView`; the
engine layer computes no status and knows no thresholds. Deriving them twice is exactly how a chip
and its row end up disagreeing.
