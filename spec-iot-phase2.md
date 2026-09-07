# Spec — IOT phase 2: IFC elements as devices, persisted

> Grilled design + rejected alternatives: `CONTEXT.md` § *IOT phase 2*.
> Flow diagrams and files-changed: `plan-visualizer.md`.
> Migration already written (not applied): `supabase/migrations/20260907120000_create_iot_devices_schema.sql`.
> Status label not applied — the tracker is unreachable, see § Further Notes.

## Problem Statement

Phase 1 proved the IOT tab is useful, but every project shows the same six invented devices,
attached to whatever elements a runtime walk of the model happened to pick. Nothing a user does in
the tab persists, and nothing in it is true. A BIM coordinator cannot say "this AHU on level 3 is
the one with the temperature sensor" — they can only watch fictional numbers on an element chosen
by an algorithm.

What the coordinator actually needs is the Autodesk Tandem gesture: point at the real air handling
unit in the model, say *this is a monitored device*, choose what it reports, and have that survive
a reload, a new browser, and a colleague opening the same project. Until the binding is authored by
a human and stored, the tab is a demo rather than a tool.

There is a second, quieter problem. A project that has never configured IoT currently shows six
devices anyway, which tells the user the feature is already set up when it is not.

## Solution

Devices become **real project data, authored by pointing at geometry**.

A project admin selects an IFC element in the viewport exactly as they select anything else, and a
panel offers to make that element a device. They confirm a label — prefilled from the element's own
properties — and tick which metrics it reports: temperature, humidity, CO₂, power, occupancy, or
the newly added **PM2.5**. The device is stored in Supabase against the element's IFC GlobalId.

From then on, everyone on the project sees that device. Clicking it flies the camera to the element,
exactly as in phase 1. A project with nothing bound shows an honest empty state inviting an admin to
bind the first element.

Telemetry remains mock, because no IoT platform is connected yet. But the mock now derives each
device's values from that device's own identity, so a bound device has its own stable behaviour
rather than borrowing one from a hardcoded roster.

## User Stories

1. As a project admin, I want to select an element in the viewport and turn it into an IoT device,
   so that monitoring reflects the real building rather than an algorithm's guess.
2. As a project admin, I want to bind devices using the same selection gesture I already use for
   everything else, so that I do not have to learn or enter a special mode.
3. As a project admin, I want the device's label prefilled from the element's own properties, so
   that I am not naming twenty sensors by hand.
4. As a project admin, I want to correct that prefilled label before saving, so that the device
   carries a name my team recognises.
5. As a project admin, I want to choose which metrics a device reports, so that a power meter does
   not pretend to measure CO₂.
6. As a project admin, I want PM2.5 available as a metric, so that air quality monitoring covers
   particulates and not only CO₂.
7. As a project admin, I want to be prevented from binding an element that is already a device, so
   that I do not create a duplicate by accident.
8. As a project admin, I want to be told which device an already-bound element belongs to, so that
   I can go and edit it instead of guessing.
9. As a project admin, I want the bind action disabled with a stated reason when I have selected
   more than one element, so that I understand why nothing is happening.
10. As a project admin, I want to be refused with an explanation if the element has no IFC GlobalId,
    so that I never create a device that can never be found again.
11. As a project admin, I want to record the real device code from our IoT system when I know it, so
    that connecting the real platform later is a matter of matching, not re-surveying.
12. As a project admin, I want to leave that code blank when I do not know it yet, so that I am not
    forced to invent one that has to be cleaned up later.
13. As a project admin, I want to edit a device's label and metrics after creating it, so that a
    mistake is not permanent.
14. As a project admin, I want to delete a device, so that a wrong binding can be removed.
15. As a project admin, I want to re-bind an element I previously removed a device from, so that
    correcting a mistake is a normal action rather than a dead end.
16. As a project member, I want to see every device my colleagues have bound, so that the whole team
    is monitoring the same building.
17. As a project member, I want to be unable to change device bindings, so that the project's
    monitoring configuration is not altered casually.
18. As a BIM coordinator, I want devices to survive a page reload and to appear on any machine I log
    in from, so that the tab is a system rather than a session.
19. As a BIM coordinator, I want a project with no devices to say so plainly, so that I can tell
    "not configured" apart from "broken".
20. As a project admin, I want that empty state to tell me how to bind the first device, so that I
    am not left guessing at the next step.
21. As a BIM coordinator, I want devices to stay bound after a model is re-exported and re-uploaded,
    so that a routine model re-issue does not silently destroy the monitoring setup.
22. As a BIM coordinator, I want to see every device in the project even when its model is not
    loaded, so that the list never lies about what is configured.
23. As a BIM coordinator, I want a device whose element is not in a loaded model to say so, so that
    I understand why it cannot be located rather than assuming data loss.
24. As a BIM coordinator, I want to still see that device's readings, so that monitoring a value
    does not require loading 3D geometry.
25. As a BIM coordinator, I want the camera to fly to a device's element as it did before, so that
    the phase 1 workflow is unchanged.
26. As a BIM coordinator, I want each device row to show a meaningful identifier beneath its label,
    so that I can distinguish two similarly named devices.
27. As a BIM coordinator, I want that identifier to fall back to the element's category when no
    device code is recorded, so that the row is never showing me a meaningless internal id.
28. As a BIM coordinator, I want alarming devices to sort to the top as before, so that the list
    stays a monitoring tool.
29. As a BIM coordinator, I want a mix of healthy, warning, alarming and offline devices to appear
    across a set of bound devices, so that I can see the feature works without waiting for a real
    fault.
30. As a BIM coordinator, I want each device's values to stay the same across reloads, so that the
    tab feels like it is reading something real.
31. As a BIM coordinator, I want a device I delete and re-create to behave as a new device, so that
    the system does not appear to remember something I removed.
32. As a developer, I want the IFC GlobalId to be the stored identity, so that bindings survive the
    element id churn that a model re-export causes.
33. As a developer, I want the model reference stored only as a hint, so that a renamed or
    re-uploaded model file does not orphan every device bound to it.
34. As a developer, I want the metric set enforced by the database, so that the schema and the
    TypeScript union cannot drift apart.
35. As a developer, I want device status still computed from thresholds rather than stored, so that
    the phase 1 invariant survives into persisted data.
36. As a developer, I want the schema identical on both Supabase projects, so that switching the app
    between them does not break the feature.
37. As a developer, I want the runtime binding walk deleted rather than kept as a fallback, so that
    there is exactly one source of devices and no way to silently show invented ones.
38. As a hub admin, I want to manage devices on any project, so that I can help a team that has no
    available project admin.

## Implementation Decisions

**Anchoring — the IFC GlobalId is the identity; the model reference is a hint.**
A device row stores the element's IFC GlobalId as its anchor, plus the model it was bound from as a
non-authoritative hint used to avoid searching every loaded model. Resolution goes GlobalId →
local ids → the engine's model/local-id map, which is what the camera consumes.

This was verified rather than assumed. A throwaway probe against three real models in this project
found a GlobalId on every element sampled (500 of 500, 211 of 211, 8 of 8) and confirmed the
GlobalId → local id lookup returns the original id. The same probe found a loaded model whose
identifier ends in `(1)` — storage had renamed a duplicate upload — which is direct evidence that
the model reference drifts in practice and cannot be part of any key.

Element local ids are explicitly **not** stored: they are positional within a file and change on
every re-export, so a device keyed on one would silently re-point at an unrelated element after a
routine model re-issue, which is worse than losing the binding outright.

**One element is one device.**
Uniqueness is enforced on (project, GlobalId). Multiple devices per element was rejected because the
later colour-by-value work would then have two competing statuses on one element and need a
tie-break rule; one device spanning several elements was rejected because it requires a join table
for a need that has not arisen.

**Metrics are a database enum, stored as an array on the device.**

```sql
create type iot_metric as enum
  ('temperature','humidity','co2','power','occupancy','pm25');
```

An enum rather than free text so the generated TypeScript types and the application's metric union
cannot drift; an array rather than a child table because metrics are always read with their device
and never carry per-metric data today. The known future pressure is **per-device thresholds** — a
server room and an office should not alarm at the same temperature — and that is the trigger to
promote metrics to a child table. Adding a metric deliberately requires a migration, which forces
the author to also supply its unit, thresholds and chart domain.

PM2.5 joins with a warning at 35 and an alarm at 55 µg/m³, following common AQI breakpoints. The WHO
24-hour guideline of 15 is stricter; thresholds live in one module and can be retuned there.

**Binding reuses the existing selection, and introduces no new pointer mode.**
The viewport already writes the current selection to the BIM store on every pick. The bind panel
reads it. A "click the button then pick an element" mode was rejected specifically because this
codebase already has four tools competing for the pointer — enough that a dedicated arbiter
component exists to referee them, and a placement manager binds a global Escape handler for its
lifetime. A fifth mode would have to negotiate with both.

The bind action is enabled only when exactly one element is selected. An already-bound element is
reported as such, with its device named, before the user can attempt a save that the unique
constraint would reject. The GlobalId is resolved at save time; an element that has none is refused
with a reason rather than stored as an unresolvable row.

**Permissions: read is member-level, write is project-admin.**
Every existing feature table uses member-level writes, and this deliberately departs from that. A
device binding is project configuration that changes what everyone sees, not content like a clash
report — an element bound to the wrong sensor makes the entire team misread the building, with no
signal that anything is wrong. Loosening this later is a one-line policy change; tightening it later
means removing access people already had.

The three membership helper functions used by every policy in this database were verified on both
projects: each is `SECURITY DEFINER` with a pinned search path, and each already tests that the
membership row is active, so no policy repeats that condition.

**Deletion is a hard delete.**
The clash tables use a soft-delete flag; this table does not. A soft-deleted row would continue to
occupy the (project, GlobalId) uniqueness, so a user who removed a device could never bind that
element again — which is exactly what they do when correcting a mistake. Keeping history would
require a partial unique index to preserve a record nobody reads. The existing audit log table is
the right home if an audit trail is later wanted.

**The element's category is denormalised onto the device row, for display only.**
Because devices are listed even when their model is not loaded, there is nothing to query in that
state; without a stored category those rows would have nothing to show beneath their label. It is
accepted that this value can go stale, and it is never used for a decision — only rendered.

**Mock telemetry is seeded from the device's own identity.**
Values derive from the device id, the metric and the time bucket, keeping phase 1's property that
readings are reproducible across reloads without storing anything. A hash of the device id also
selects which band the device sits in — roughly 70% healthy, 15% warning, 10% alarm, 5% offline —
so that binding a handful of elements on any project exercises every rendering path without a
column of demo configuration polluting a table that must outlive the mock.

Seeding from the GlobalId was rejected: deleting a device and re-binding the same element would
return the identical value series, implying the system remembers something the user deleted. A
user-chosen behaviour column was rejected as fake-data configuration in a table that must survive
into real telemetry — the same reasoning that kept phase 1 from persisting anything at all.

**Device code is optional and unique when present.**
It is the waiting room for the real IoT platform's own device identifier, which the developer
confirmed is the only key real sensors carry. Present from the start so that connecting a real
system is a matching exercise rather than a migration plus a re-survey; optional because forcing it
before a real system exists produces invented codes that have to be cleaned later.

**The schema is applied to both Supabase projects.**
This installation has two: the app switches between them through local environment configuration,
and both carry the same tables and the same membership helpers. A schema present in only one is a
time bomb for whoever switches back, with nothing to connect the failure to the migration.

**Phase 1 code that is deleted, not adapted.**
The runtime binding walk is removed entirely — inventing devices has no place once they are
authored, and keeping it as a fallback would mean a project could silently display fictional devices.
The hardcoded roster is removed. The "is a model loaded" condition stops gating the tab; the real
empty state becomes "this project has no devices yet".

Everything else from phase 1 survives unchanged: the list, the sorting, the status derivation, the
five-second tick and its isolation from the render loop, the hand-rolled charts, the status badges,
and the camera flight.

## Testing Decisions

**What makes a good test here.** Assert what a user can observe — a device appears after binding, a
bound element is refused a second time, a member cannot bind at all. Never assert on the mock's
internals, the resolution fallback order, or the shape of the map handed to the camera.

**One seam, as in phase 1: an end-to-end spec driving the real application.** This remains the only
test infrastructure in the repository — Playwright, no unit runner — and phase 1's spec is the
direct prior art, including the shared login helper, project discovery from the rendered list, the
fixed engine-boot wait, and filtered console/page-error collection.

**A new constraint that phase 1 did not have: the test now writes to a live database.** There is no
staging environment; both Supabase projects are production. A test that binds a device is creating
a real row that real users will see.

The chosen approach is **create-and-clean-up within the test**: bind a device to an element, assert
against it, then delete it through the same UI, and assert it is gone. This exercises the full
lifecycle including the delete path, and leaves nothing behind. The test skips when the account
lacks project-admin rights on the discovered project, and when no model is loaded.

Two alternatives were weighed. A read-only test that assumes a device already exists cannot cover
binding at all — the feature's entire point. Seeding a dedicated test project would be cleaner but
requires provisioning and maintaining fixture data across two databases.

**Covered at this seam:**

- The IOT tab shows an empty state on a project with no devices.
- Selecting one element enables binding; selecting several does not.
- Binding creates a device that appears in the list with its label and chosen metrics.
- Selecting the same element again reports it as already bound rather than allowing a duplicate.
- Selecting the device drives the right panel and moves the camera without engine errors.
- Deleting the device removes it from the list.
- A device whose model is not loaded still lists and still shows values, with zoom unavailable.

**Deliberately not covered:** the value generator's determinism, the exact threshold boundaries, the
resolution fallback ordering, chart pixel output, and RLS enforcement at the database level — the
last of these is a policy assertion better made with a direct query than through a browser.

## Out of Scope

- **Any real IoT data source.** Telemetry stays mock; the provider interface is unchanged.
- **Colouring geometry by sensor value**, heatmaps, or anything affecting surrounding areas. This
  remains the next phase, and it is what will justify moving the binding and camera work into a
  BIM component with a real lifecycle.
- **Per-device thresholds.** Thresholds remain global constants.
- **Bulk binding** of several elements at once.
- **A repair flow for broken bindings** — a device whose GlobalId no longer resolves shows as
  unlocatable, but cannot be re-pointed at a new element.
- **Importing devices** from a spreadsheet or an external system.
- **Alarm history, acknowledgement, notification, or work orders.**
- **Audit trail for binding changes.**
- **Per-project or per-metric unit configuration.**
- **A unit test runner.** Still not introduced.

## Further Notes

**Not filed to a tracker.** No tracker or triage-label vocabulary was provided, the
`setup-matt-pocock-skills` skill is not installed, and the GitHub MCP server failed to connect this
session with a malformed-authorization-header error. The `ready-for-agent` label could not be
applied.

**A documentation correction is bundled in.** The backend guide states this installation has a
single Supabase project and names the one that is currently inactive. There are two, and the app
points at the other. This is a factual fix to a stale document rather than new-feature
documentation, so it does not wait for the post-testing documentation step.

**Applying the migration is a separate approval from approving this spec.** It writes to two
production databases and is materially harder to reverse than code. The intended sequence is: apply
to both projects, run the security and performance advisors on both, then regenerate the shared
TypeScript types — which the application code depends on and which must never be hand-edited.

**Known untested assumptions**, carried forward:

1. Whether fitting the camera to a single small element frames it usefully. Inherited from phase 1
   and still not spiked; it matters more now that users choose the element, and they will choose
   small ones.
2. How often a real project contains elements without a GlobalId. The probe found none in three
   models, but that is a small sample and the refusal path depends on it.
3. Whether the element's category and name can be read reliably at bind time across element types.

**One decision worth revisiting if it proves wrong in use:** admin-only writes. If the people who
physically tag sensors are not project admins, they will be blocked and the feature will stall on
waiting for someone else. Changing the four policies is a small migration.
