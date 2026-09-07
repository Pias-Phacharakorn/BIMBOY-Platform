# 01: Spike — does fitting the camera to a single element frame it usefully?

**What to build:** throwaway exploration, not shipped code. Answer one question that gates the IOT
tab's core interaction: when the camera is asked to fit to exactly one element, does the user end
up looking at something legible, or jammed inside the geometry?

The only existing caller in the app fits the camera to the *whole model*. Nothing has ever asked it
to frame a single item. A large piece of equipment or a room volume will probably be fine; a small
air terminal or a pipe fitting may frame so tight that the user arrives with no spatial context and
no idea what they are looking at.

This matters because the IOT tab's entire value is "click a device, understand where it is". If
fitting one element is unusable, the camera work needs a padded bounding box instead, and that
changes the shape of ticket 03. Discovering that inside 03 means rescoping mid-ticket; discovering
it here costs an afternoon.

Try it against a real project model at several element scales — a room volume, a large piece of
equipment, and the smallest element you can find. Record what you see.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Camera fitted to a single large element (room volume or equipment) — result recorded
- [ ] Camera fitted to a single small element (terminal, fitting) — result recorded
- [ ] A recommendation stated: fit directly, or pad the bounding box (and by roughly how much)
- [ ] Confirmed whether fitting preserves the current view direction rather than snapping to a
      canned angle, since staying oriented is a stated requirement
- [ ] Finding written into `CONTEXT.md` under the IOT tab's untested assumptions, replacing
      assumption 1 with what was actually observed
- [ ] All spike code discarded — nothing from this ticket is merged
