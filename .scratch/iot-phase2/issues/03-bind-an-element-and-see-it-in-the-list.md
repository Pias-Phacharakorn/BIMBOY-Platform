# 03: Bind an element and see it in the device list

**What to build:** the feature. A project admin picks an air handling unit in the viewport, says
*this is a monitored device*, chooses what it reports, and it appears in the list — with readings,
a status, and a camera that flies to it. Reload the page and it is still there. A colleague opens
the project and sees the same device.

This is the tracer bullet: it cuts from the viewport selection all the way to the database and back,
and it is the first point at which the feature is demoable. It is deliberately not split, because
every smaller piece would be a half that cannot be shown to anyone — a read path with nothing to
read, or a write path with nothing displaying the result.

**Binding reuses the selection the user already makes.** The viewport already publishes the current
selection; the bind panel reads it. Do not introduce a mode where the user arms a button and then
picks — four tools already compete for the pointer in this app, enough that a dedicated arbiter
component exists to referee them and a placement manager holds a global Escape handler for its
lifetime. A fifth claimant would have to negotiate with both.

The bind action is offered only to project admins, and only when exactly one element is selected.
When several are selected it is disabled *with the reason stated*, not silently inert. The label is
prefilled from the element's own properties so nobody names twenty sensors by hand, and remains
editable. Metrics are chosen by the user. The optional device code — the waiting room for the real
IoT system's identifier — can be left blank.

**The element's IFC GlobalId is resolved and stored at save time.** A probe against three real models
found a GlobalId on every element sampled, and confirmed the reverse lookup returns the original
element. If an element has none, refuse with an explanation rather than storing a row that can never
be located again. Store the element's category alongside, for display when the model is not loaded.

**An element that is already a device must be reported as such before the user can attempt a save.**
Name the device it belongs to. Letting the database's uniqueness rule produce a raw error is not
acceptable — the user selected an element and deserves to be told what it already is.

**Two pieces of phase 1 are deleted, not adapted:**

- The runtime walk that invented devices by spreading them across whatever the model contained.
  Keeping it as a fallback would let a project silently display fictional devices.
- The hardcoded roster of six devices.

The mock generator stays, but each device's values now derive from its own database identity, and a
hash of that identity places the device in a status band — roughly seventy percent healthy, fifteen
warning, ten alarming, five offline — so that binding a handful of elements exercises every rendering
path without a column of demo configuration in a table that must outlive the mock. Seeding from the
GlobalId was rejected: deleting a device and re-binding the same element would replay the identical
values, implying the system remembers something the user deleted.

**The empty state changes meaning.** "No model loaded" stops gating the tab. The real empty state is
"this project has no devices yet", and for an admin it says how to create the first one.

PM2.5 joins the metric set on the application side here — unit, thresholds (warning 35, alarm 55
µg/m³) and a chart range — matching the enum applied in ticket 02.

**Blocked by:** 02 (the table and the generated types must exist).

**Status:** ready-for-agent

- [ ] A project with no devices shows an empty state saying so, not a "load a model" message
- [ ] An admin sees how to create the first device; a non-admin does not
- [ ] Selecting exactly one element offers to bind it
- [ ] Selecting several elements disables binding and states why
- [ ] The label is prefilled from the element and can be edited before saving
- [ ] The user chooses which metrics the device reports, including PM2.5
- [ ] The device code can be left blank
- [ ] Saving stores the element's IFC GlobalId, not its local id
- [ ] An element with no GlobalId is refused with an explanation and nothing is stored
- [ ] Selecting an already-bound element reports which device it is, before any save attempt
- [ ] The new device appears in the list with its label, status and current reading
- [ ] Selecting the device fills the right panel and flies the camera to its element
- [ ] The device is still present after a full page reload
- [ ] A non-admin sees the device but is offered no way to create one
- [ ] Devices from the database are the only source — the runtime binding walk is deleted
- [ ] The hardcoded roster is deleted
- [ ] Each device's values are stable across reloads
- [ ] Binding several elements produces a mix of healthy, warning, alarming and offline devices
- [ ] An offline device still renders a no-value marker and never a zero
- [ ] The five-second tick still touches no engine, renderer or camera call
- [ ] The typecheck, the lint and the production build pass
