# ADR-0029: IoT devices are anchored to `ifc_guid`, one device per element

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/iot.md`](../feature/iot.md)

## Context

Binding a sensor to an IFC element means storing a pointer to that element. Three candidates were
available, and the choice is effectively permanent — every row written under the wrong one has to be
re-authored by hand.

Two of the three were checked against real project data with Playwright before deciding, not
reasoned about:

- **IFC GlobalId is present and complete.** Three models probed, 500/500, 211/211 and 8/8 elements
  returned a GUID rather than null, and `getLocalIdsByGuids` round-tripped back to the original
  `localId` (`133079` → GUID → `133079`). The whole design rests on this; had it failed, the feature
  needed a different shape entirely.
- **`modelId` already drifts in this repo.** The value found in a real project was
  `6ad248cc-…-d8c558989946 (1)` — the ` (1)` appended because a file of the same name was uploaded
  twice. Not a theoretical risk.

## Decision

**`ifc_guid` is the identity. `model_id` is a lookup hint only, and gets overwritten when it turns
out to be wrong.** If the hint misses, resolution falls back to searching every loaded model and
writes the corrected hint back.

**One device per element**, enforced by `unique (project_id, ifc_guid)`.

**Deletes are real deletes**, not soft.

## Alternatives rejected

- **`local_id` as the key.** It is reassigned on every re-export of the IFC. The day a new model
  arrives, sensors would silently reattach to unrelated elements — quietly wrong readings on the
  wrong equipment, which is worse than a device that visibly cannot be located.
- **`model_id` as part of the key.** It derives from the uploaded filename and has already drifted
  in this project (above). A key that changes when somebody re-uploads a file is not a key.
- **Many devices per element.** It creates two contradictory statuses on one element the moment the
  feature colours geometry, forcing an arbitrary "who wins" rule to be invented up front.
- **One device spanning many elements.** Needs a join table and a join on every query, to solve a
  problem nobody has yet had.
- **Soft delete.** A soft-deleted row keeps occupying `unique (project_id, ifc_guid)`, so the element
  it no longer describes can never be re-bound. The fix is a partial index, added to preserve history
  that nobody has asked to read.

## Consequences

- `element_category` is stored on the row even though it can be read from the model. Devices are
  listed even when their model is not loaded, and at that moment there is nothing to query — those
  rows would otherwise render with nothing under the name. A deliberate denormalisation: display
  only, possibly stale, never branched on.
- Devices whose GUID resolves in no loaded model still appear, with readings but no zoom. Hiding them
  would make the list lie, and a user who thinks their bindings vanished re-creates them straight
  into the unique constraint.
- Re-binding an element after deleting its device produces a **different** reading series, because
  the mock seeds from `device_id` rather than from the GUID. That is intentional — see
  [ADR-0028](0028-iot-provider-interface-defers-the-transport.md) — a system that replayed the old
  series would appear to remember something the user deleted.
- Moving to a model with genuinely different GUIDs (a re-authored IFC, not a re-export) orphans every
  device. No migration path exists; it would need a GUID remap tool.
