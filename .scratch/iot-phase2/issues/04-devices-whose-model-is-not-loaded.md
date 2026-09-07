# 04: Devices whose model is not loaded still list, and say so

**What to build:** a coordinator who opens a project with only the architectural model loaded still
sees every device in the project — including the ones bound to elements in the MEP model — with their
readings, and a clear indication of which ones cannot be located until that model is loaded.

This is the state that makes devices *project data* rather than *model data*, and it is not an edge
case. This installation auto-loads cloud models behind a per-project flag that can be turned off, a
single project already carries several model files, and a user can open the tab before anything has
finished loading.

**Hiding the unresolvable ones was rejected, and the reason is worth keeping in view.** A user who
configured twenty devices and sees six will conclude the data is gone, not that a model is missing —
and will try to create them again, colliding with the uniqueness rule on elements they cannot see.
The list must never quietly under-report what is configured.

So: every device is listed, always. A device whose GlobalId does not resolve in any currently loaded
model shows its readings normally, is visually marked as unlocatable, and offers no camera action —
or offers one that explains why it cannot act rather than doing nothing. The identifier line beneath
the label falls back to the stored element category, which is exactly why that category is stored.

Resolution uses the stored model reference as a hint only. If the element is not in that model, look
through the others before giving up — the reference is derived from a filename and this project
already contains a model whose name was altered by a duplicate upload. When the element is found
somewhere else, update the hint.

**Blocked by:** 03 (devices must exist and be listed).

**Status:** ready-for-agent

- [ ] Every device in the project appears in the list regardless of which models are loaded
- [ ] A device whose element is not in a loaded model is visibly distinguished
- [ ] That device still shows its current reading and status
- [ ] That device's camera action is unavailable, and the reason is discoverable rather than silent
- [ ] Loading the missing model makes the device locatable without a page reload
- [ ] Resolution tries the stored model hint first, then the remaining loaded models
- [ ] A device found in a model other than its hint has its hint corrected
- [ ] Unloading a model moves its devices into the unlocatable state rather than removing them
- [ ] The identifier beneath the label falls back to the stored element category when no device code
      is recorded
- [ ] The typecheck, the lint and the production build pass
