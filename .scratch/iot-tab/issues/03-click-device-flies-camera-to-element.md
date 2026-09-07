# 03: Clicking a device flies the camera to its element

**What to build:** the interaction the whole feature exists for. A BIM coordinator sees a device in
the list, clicks it, and the camera flies to the element that device is attached to — the same
gesture as picking a room from the Room tab. They go from "something is wrong" to "here is where it
is" in one motion.

**Binding devices to elements happens at runtime, and nothing is persisted.** On entering the tab,
walk the loaded model and assign mock devices to real elements using a category preference chain:
MEP/equipment categories first, then space volumes, then any element with geometry. The assignment
is deterministic, so the same device lands on the same element across reloads.

The fallback chain is what makes the feature demoable on *any* project. A hardcoded GlobalId list
would work on exactly one IFC and render an empty list on every other model — the feature would
look broken to everyone but the person who authored the list. An architectural-only model has no
equipment categories at all, so the chain must degrade rather than give up.

A real device-to-element mapping table was deliberately rejected for this phase. It would be durable
storage of fiction — mapping invented device IDs to real GlobalIds, to be discarded the moment real
device IDs arrive. The binding source is the single thing phase 2 replaces; everything else in this
ticket survives that swap unchanged.

**Camera behaviour.** Resolve the bound element to the engine's model/local-id map shape and hand it
to the camera's fit-to-items call, which preserves the current view direction rather than snapping
to a canned angle. Staying oriented is the requirement — a coordinator who is teleported to an
arbitrary angle has to re-establish where they are, which defeats the point. Apply whatever padding
ticket 01 concluded is needed.

Note that the clash list's zoom is **not** the precedent here. It replays a stored BCF camera in
project coordinates — a different mechanism that does not apply, since devices have no authored
viewpoint, only an element.

**Space visibility, and why it needs care.** Space geometry is hidden in the viewport unless a tab
requires it; today only the Room tab forces it. If the binding chain falls through to spaces, the
IOT tab must force it too, or the camera flies to invisible geometry and the coordinator arrives at
an apparently empty void.

Force it **only when the chain actually fell through to spaces**. Forcing unconditionally was
rejected: when the chain binds to equipment, translucent space volumes would obscure the very
elements the camera is flying to.

This ticket carries a small prefactor first — make the change easy, then make the easy change. The
visibility hook's parameter is named for its single current caller; rename it to say what it means
now that a second caller exists. Behaviour must not change: the hook's documented "only ever hides,
never shows" asymmetry is load-bearing for Isolate and must not be touched.

**Blocked by:** 01 (the spike decides whether fitting needs a padded bounding box), 02 (needs a tab
and a device list to click).

**Status:** ready-for-agent

- [ ] Prefactor landed first: the visibility hook's parameter renamed, behaviour unchanged
- [ ] Clicking a device in the list moves the camera to its bound element
- [ ] The camera keeps its current viewing direction rather than snapping to a canned angle
- [ ] Padding applied per ticket 01's finding
- [ ] The selected device remains visibly selected in the list
- [ ] Binding uses the category chain, preferring equipment, then spaces, then any element
- [ ] The list is non-empty on a model with no MEP equipment
- [ ] The same device binds to the same element across reloads
- [ ] Space geometry is forced visible only when the chain fell through to spaces
- [ ] Binding to equipment leaves space geometry hidden as before
- [ ] The Room tab's space visibility behaviour is unchanged
- [ ] Isolate and Hide still work on the Room tab
- [ ] Nothing is written to Supabase; no table, migration or policy is added
- [ ] Selecting devices repeatedly raises no engine errors in the console
- [ ] `tsc` and the production build pass
