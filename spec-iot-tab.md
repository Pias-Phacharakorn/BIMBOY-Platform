# Spec — IOT tab (phase 1, mock data)

> Status: **ready-for-agent** (label not applied — see § Further Notes, the tracker is unreachable).
> Grilled design + rejected alternatives: `CONTEXT.md` § *IOT tab*. Flow diagrams: `plan-visualizer.md`.

## Problem Statement

A BIM coordinator looking at a model in BIMBOY has no way to see how the building is actually
*performing*. The model tells them where the meeting room is; nothing tells them that its CO₂ has
been over 1400 ppm all afternoon. Today that information lives in a separate BMS or IoT portal —
a different tab, a different login, and a device list that identifies sensors by opaque IDs like
`ENV-3F-03` with no spatial context. Correlating "which sensor is alarming" with "where in the
building that is" is a manual, error-prone act of translation the coordinator performs in their head.

The Power BI tab does not solve this. It renders dashboards, but a dashboard cannot answer
*"take me to that room"* — it has no relationship to the geometry sitting in the viewport.

## Solution

An **IOT** tab in the BIM Model workspace, sitting alongside Room, GIS and Realistic.

The left panel lists the project's IoT devices with a live status dot and current reading, with
alarming devices sorted to the top. Clicking a device flies the camera to the element that device
is attached to — the same gesture as picking a room from the Room tab. The right panel shows that
device's recent history as a stack of small charts, one per metric it reports.

The result is a single motion from *"something is wrong"* to *"here is where it is"*: the
coordinator scans the list, sees one red dot, clicks it, and is looking at the geometry.

**Phase 1 runs entirely on mock data.** There is no IoT platform connected, and the developer has
confirmed real sensors will carry only a device ID — no BIM identity of any kind. Rather than guess
at a payload shape and a device↔element mapping schema, phase 1 puts a three-method provider
interface in front of the data and ships a deterministic mock behind it. Every piece of UI built —
list, selection, camera, charts, panel layout — is identical when a real source replaces the mock.

## User Stories

1. As a BIM coordinator, I want an IOT tab in the BIM Model workspace, so that building performance
   data lives beside the model instead of in a separate portal.
2. As a BIM coordinator, I want the IOT tab to use the same left-panel / viewport / right-panel
   layout as the Room and GIS tabs, so that I do not have to learn a new screen.
3. As a BIM coordinator, I want to see a list of every IoT device in the project, so that I know
   what is being monitored without asking the facilities team.
4. As a BIM coordinator, I want each device to show its human-readable label as well as its device
   ID, so that I can recognise "Meeting Room A" without memorising `ENV-3F-03`.
5. As a BIM coordinator, I want each device row to show its current reading, so that I can scan the
   list without clicking every entry.
6. As a BIM coordinator, I want a coloured status dot on each device, so that I can tell at a glance
   whether it is healthy, warning or alarming.
7. As a BIM coordinator, I want devices in alarm to sort to the top of the list, so that the list is
   a monitoring tool and not merely a directory.
8. As a BIM coordinator, I want an offline device to be visually distinct and to show no reading at
   all, so that I never mistake a dead sensor for a genuine reading of zero.
9. As a BIM coordinator, I want to see when a device was last heard from, so that I can judge how
   much to trust a stale value.
10. As a BIM coordinator, I want to click a device in the list and have the camera fly to the
    element it is attached to, so that I can locate a problem spatially without hunting the model.
11. As a BIM coordinator, I want the camera to keep its current viewing direction when it flies to a
    device, so that I stay oriented instead of being snapped to an arbitrary canned angle.
12. As a BIM coordinator, I want the selected device to stay visibly selected in the list, so that I
    know which device the right panel is describing.
13. As a BIM coordinator, I want the right panel to show the selected device's label and status
    prominently, so that the panel is self-describing after the camera has moved.
14. As a BIM coordinator, I want to see a recent history chart for the selected device, so that I
    can tell whether a reading is a spike or a sustained condition.
15. As a BIM coordinator, I want a device that reports several metrics to show all of them stacked,
    so that I can judge a room's overall condition in one look rather than clicking through a
    metric selector.
16. As a BIM coordinator, I want each chart labelled with its metric name, current value and unit,
    so that a chart is readable without cross-referencing a legend.
17. As a BIM coordinator, I want the charts to indicate the threshold at which a metric becomes a
    problem, so that I can see how close to trouble a value is, not merely its absolute number.
18. As a BIM coordinator, I want readings to update while I watch, so that the panel reads as live
    monitoring rather than a stale snapshot.
19. As a BIM coordinator, I want live updates never to disturb my navigation of the 3D model, so
    that the viewport does not stutter or reset while I am orbiting.
20. As a BIM coordinator, I want the IOT tab to work on any project I open, so that the feature is
    not silently empty on every model but one.
21. As a BIM coordinator, I want devices to be attached to elements that are actually visible when
    the camera arrives, so that clicking a device never flies me into an apparently empty void.
22. As a BIM coordinator, I want the same devices to be present when I reload the page, so that the
    tab feels like a real system rather than a random generator.
23. As a BIM coordinator, I want a clear empty state when no model is loaded, so that I understand
    the tab needs geometry rather than assuming it is broken.
24. As a BIM coordinator, I want to switch away from the IOT tab and back without losing my place,
    so that the tab is usable alongside the rest of the model workspace.
25. As a developer, I want IoT data to reach the UI through a narrow provider interface, so that
    connecting a real IoT platform later replaces one module rather than rewriting the feature.
26. As a developer, I want no database schema, migration or RLS policy in phase 1, so that we do not
    persist a device↔element mapping invented for fictional devices.
27. As a developer, I want device status computed from thresholds rather than stored on a reading,
    so that changing a threshold does not require rewriting history and so the interface stays
    satisfiable by a real platform that has never heard of our thresholds.
28. As a developer, I want no new charting dependency, so that chart styling stays on our design
    tokens instead of fighting a library's inline styles against our `!important` / raw `oklch()` ban.
29. As a developer, I want the live tick to stop when the IOT tab is not active, so that an interval
    does not run forever behind every other tab in the workspace.
30. As a developer, I want history bounded by a ring buffer, so that a long session does not grow an
    unbounded array.
31. As a developer, I want the mock to always contain one alarming, one warning and one offline
    device, so that every rendering path is exercisable on load instead of when a random generator
    happens to oblige.
32. As a QA engineer, I want the IOT tab covered by an end-to-end test against a real loaded model,
    so that the parts that survive into phase 2 — list, selection, camera — are protected.
33. As a facilities manager, I want to hand a colleague a description of where a problem is, so that
    the alarm becomes an actionable work order rather than a number on a screen.

## Implementation Decisions

**Placement — a tab in the BIM Model workspace, not a new sidebar workspace.**
The IOT tab is added to the model workspace's tab list and to its flex-layout set, so it inherits
the existing left-panel / viewport / right-panel arrangement. A separate sidebar workspace was
rejected: the viewport wrapper is mounted in exactly one place in the entire application, against a
singleton OBC world, so a second viewport-owning view is a teardown hazard. If IOT later warrants a
sidebar entry, that entry should navigate to the model workspace with the IOT tab preselected.

**Data access — a three-method provider interface.**
The feature consumes only:

```ts
listDevices(): Promise<Device[]>
getLatest(deviceIds: string[]): Promise<Reading[]>
getHistory(deviceId: string, metric: Metric, from: string, to: string): Promise<Reading[]>
```

Any real IoT platform can satisfy these three; a platform that cannot serve them cannot serve any
IoT UI. This defers the transport decision (vendor cloud REST vs. Supabase tables vs. MQTT) rather
than guessing it against an unseen payload.

**Domain types.**

```ts
type Metric = "temperature" | "humidity" | "co2" | "occupancy" | "power"

type Device = {
  deviceId: string     // the only key real sensors carry
  label: string
  metrics: Metric[]
  online: boolean
  lastSeen: string     // ISO
}

type Reading = {
  deviceId: string
  metric: Metric
  value: number
  unit: string
  ts: string           // ISO
}
```

`Device` deliberately carries **no BIM identity** — no IFC GlobalId, no element reference. If a BIM
identifier leaked into the device shape, the mock would be pretending to know something no real
sensor system knows, and the interface would stop being satisfiable by a real platform.

`Reading` deliberately carries **no status field**. Status is derived by a pure
`statusFor(metric, value)` over a threshold constant map. A stored status is a denormalised copy
that goes stale when a threshold changes, and no external platform will ever supply *our* thresholds.

**Device↔element binding — runtime, not persisted.**
On entering the tab, the feature walks the loaded model and assigns mock devices to real elements,
using a **category preference chain**: MEP/equipment categories first, then `IFCSPACE`, then any
element with geometry. Deterministic, so the same device lands on the same element across reloads.

Three alternatives were rejected. A hardcoded GlobalId list works on exactly one IFC and renders an
empty list on every other project. A real mapping table would be durable storage of fiction —
mapping invented device IDs to real GlobalIds, to be discarded the moment real device IDs arrive.
Building the click-element-to-bind authoring UI now would design that flow before we know whether
real device IDs are per-room, per-equipment or per-panel, and that shape drives the UI.

The binding source is the single thing phase 2 replaces. Every other part of the feature is
unchanged by that swap.

**Camera — a single vendor call.**
Selection resolves the bound element to the engine's model/local-id map shape and hands it to the
camera's fit-to-items call. This routes through the controls' fit-to-sphere path, which preserves
the current view direction rather than snapping to a canned angle. No bounding-box arithmetic, no
stored viewpoints. Note that the clash list's zoom is *not* the precedent here — it replays a
stored BCF camera in project coordinates, a different mechanism that does not apply.

**Space visibility.**
`IFCSPACE` geometry is hidden in the viewport unless a tab requires it; today only the Room tab
forces it. If the binding chain falls through to `IFCSPACE`, the IOT tab must force it too, or the
camera flies to invisible geometry. The existing visibility hook takes a single boolean and is
extended by the IOT tab's need, with its parameter renamed to reflect that it now serves two
callers. Behaviour is unchanged — the hook's documented "only ever hides, never shows" asymmetry is
load-bearing for Isolate and must not be touched.

Forcing spaces visible *unconditionally* on the IOT tab was rejected: when the chain binds to
equipment, translucent space volumes would obscure the very elements the camera is flying to.

**Liveness — a 5-second tick that never touches the 3D engine.**
The tick updates React state only. Phase 1 zooms to geometry but never colours it, so the tick has
no legitimate reason to reach the world, and this boundary is recorded explicitly to protect
ADR-0020's one-render-per-frame contract from a later "helpful" pulsing highlight.

The tick is gated on the tab being **active**, not on component mount: the model workspace keeps
inactive tabs mounted-but-hidden, so a mount-scoped interval would run forever behind every other
tab. History is a ring buffer of roughly 200 points per device/metric.

**Mock generation — deterministic drift, a pure function of the time bucket.**
*Implemented as a change from this spec's original "seeded random walk":* an accumulating walk needs
stored state to be reproducible across a reload, while deriving each value from
`(deviceId, metric, bucketIndex)` gives reproducibility and the history bound for free. It satisfies
every property the walk was chosen for. Not a static fixture and not raw randomness. Static data produces flat-line charts that cannot
distinguish a rendering bug from real data; raw randomness produces noise that looks broken. A
seeded walk drifts plausibly and is stable across reloads.

Three device states are **scripted** rather than left to chance: one device in CO₂ alarm, one over
temperature, one offline. This guarantees all three rendering paths are present on every load.
**An offline device must render as an explicit no-value indicator, never as `0`.**

Accepted: history is walked backwards from *now*, so re-entering the tab regenerates a slightly
different past. Reproducible history is real work for a benefit nobody looking at a mock notices.

**Charts — hand-rolled SVG, no new dependency.**
Three forms only: a time-series line, a current-value stat tile, and a status pill. A charting
library was rejected on theming grounds — libraries render their own SVG subtree with inline
`fill`/`stroke`, so every axis, grid line and tooltip becomes a design token threaded through a
prop, against hard constraints banning `!important` and raw `oklch()` in JSX. Hand-rolled SVG takes
a Tailwind token class directly. React 19 compatibility of the obvious candidate is also unverified.

A multi-metric device renders **stacked mini-charts**, not one large chart behind a metric selector:
the panel answers "how is this room doing" at a glance, and a selector costs three clicks to learn
the same thing.

**Layer placement.**
All new code is a single feature module under the features layer: types, threshold constants, mock
provider, the state hook, and three presentational components. The view layer changes only to add
the tab and mount the two panels. No changes to the BIM component layer, the stores, the viewport
wrapper, Supabase, or migrations. Selection state lives in local state inside the feature hook,
matching the existing rooms hook rather than introducing a new store.

## Testing Decisions

**What makes a good test here.** Assert what the coordinator can observe — a device appears, a
status reads as alarming, a click changes what the right panel describes — never how it is
computed. No test should reference the seeded generator's internals, the binding chain's category
order, or the shape of the map handed to the camera. Those are all expected to change in phase 2,
and a test coupled to them would fail on a refactor that broke nothing.

**One seam: an end-to-end spec at the IOT tab, driven through the real application.**
This is an existing seam and the highest available one. The repository has **no unit test runner**
— the entire suite is Playwright, and there are zero unit tests in the source tree. Introducing one
was considered and rejected for this feature.

The argument is *what survives phase 2*. The mock provider exists to be deleted; unit-testing the
determinism of a seeded random walk is investment in code with a known expiry date. What survives
is the list, the selection, the camera flight and the panel layout — and those are only meaningful
against a real loaded model, which is precisely where this seam sits. The threshold and offline
edge cases that would otherwise argue for unit tests are observable at this seam anyway, because
the mock's scripted alarm/warning/offline devices are guaranteed present on every load.

**Covered at this seam:**

- The IOT tab is reachable in the model workspace and renders both panels.
- The device list populates against a real project model.
- A device in alarm is present and sorted above healthy devices.
- The offline device renders a no-value indicator and **not** `0`.
- Selecting a device updates the right panel to describe that device.
- Selecting a device does not raise a page error or console error from the engine.
- Leaving and re-entering the tab does not leak an interval or crash on teardown.

**Prior art.** `e2e/model-teardown.spec.ts` is the closest template: it logs in via the shared
`loginAsTestUser` helper, discovers a project id from the rendered project list, navigates to the
model route, and waits a fixed interval for engine setup because there is no ready signal. It also
demonstrates the console/`pageerror` collection pattern with a signature filter, which the IOT spec
should reuse for the "selection does not crash the engine" assertion. `e2e/helpers.ts` skips the
test when test-account credentials are absent — the IOT spec must do the same, and additionally
skip when the test account has no project with a loaded model.

**Explicitly not tested.** Seeded-walk determinism across reloads, exact threshold boundary values,
the category fallback chain's ordering, and chart pixel output. All are either throwaway or
implementation detail.

## Out of Scope

- **Any real IoT data source.** No vendor integration, no MQTT, no webhook, no ingestion.
- **Persistence of any kind.** No table, migration, RLS policy or storage. No per-project device
  configuration in project settings.
- **A device↔element mapping authoring UI** (click element in viewport, assign device). This is the
  phase 2 centrepiece and must not be designed against fictional device IDs.
- **Colouring geometry by sensor value** — heatmaps, thresholds painted onto rooms, affecting
  surrounding areas. Explicitly deferred by the developer. Phase 1 zooms only, and this is what
  keeps the live tick away from the render loop.
- **Configurable thresholds.** Constants in phase 1; settings UI lands with the mapping table.
- **Alarm history, acknowledgement, notification, or work-order creation.**
- **A standalone IOT sidebar workspace**, and any second viewport mount.
- **Free-floating sensors at XYZ coordinates** with no element relationship — a different feature
  needing placement UI and CRS handling, and unable to participate in element-based interactions.
- **Reading IoT data on the AR page, in drawings, or in Power BI.**
- **Unit test infrastructure.** Not introduced by this feature.

## Further Notes

**This spec was not filed to an issue tracker.** No tracker or triage-label vocabulary was provided
to the skill, and the `setup-matt-pocock-skills` skill is not installed. Independently, the GitHub
MCP server failed to connect this session with a malformed-authorization-header error. The
`ready-for-agent` label therefore could not be applied. Fixing the MCP connection is worthwhile
regardless of this feature.

**Known untested assumptions**, carried from the design session and worth confirming early, because
the first would change the camera approach:

1. That fitting the camera to a **single small element** frames it usefully. The one existing
   caller only ever fits the whole model. A single air terminal may frame far too tight, in which
   case a padded bounding box is needed.
2. That the category fallback chain finds bindable elements in a real project IFC at all.
3. That the `dataviz` skill's palette and axis guidance — which must be loaded before the first
   line of chart code — does not conflict with `DESIGN.md` tokens.

**Phase 2, for context only.** When a real IoT source is chosen: replace the mock behind the
provider interface, introduce a real device↔element mapping table with an in-app authoring flow,
move thresholds into project settings, and only then consider colouring geometry — at which point
the tick's isolation from the render loop stops being free and needs its own design.
