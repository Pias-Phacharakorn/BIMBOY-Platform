# 01: Move the IoT engine work into a BIM component

**What to build:** nothing a user can see. The IOT tab behaves exactly as it does today — bind an
element, see the device, click it, the camera flies, delete it — but the parts that talk to the
engine now live where this project keeps engine code.

This is the prefactor. Every later ticket adds Three.js objects to the scene with a lifecycle and a
disposal obligation, and doing that from the React feature layer would put engine ownership somewhere
nobody looks for it. Make the change easy, then make the easy change.

Phase 1 deliberately kept IoT out of the BIM layer, and the criterion recorded at the time was
whether the feature **owns engine resources that outlive a render and must be disposed**. Until now
the answer was no: two read-only queries and one camera call. The chips make the answer yes, so this
ticket is that decision being honoured rather than reversed.

The new component follows the room-view precedent it will sit beside: activate and deactivate, and a
dispose that leaves nothing behind. Resolution of a stored IFC GlobalId to geometry, and the camera
flight to a resolved device, both move into it. The React feature keeps the device list, the
selection, the telemetry and the query hooks, and calls the component — the same split the rooms hook
and the room-view component already have.

**This is surgery on code that just passed its end-to-end test**, so the bar is that the test still
passes untouched. If the test needs editing to accommodate this ticket, something has been moved that
should not have been.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A BIM component owns GlobalId resolution and the camera flight
- [ ] It exposes activate and deactivate, and disposes cleanly
- [ ] The React feature no longer imports the engine for resolution or camera work
- [ ] Binding an element still creates a device that appears in the list
- [ ] Clicking a device still flies the camera to its element
- [ ] A device whose model is not loaded is still listed and still shows readings
- [ ] The model hint is still corrected when an element is found in another model
- [ ] The existing end-to-end test passes **without modification**
- [ ] Leaving and re-entering the IOT tab raises no engine errors
- [ ] The typecheck, the lint and the production build pass
