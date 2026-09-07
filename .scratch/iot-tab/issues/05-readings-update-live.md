# 05: Readings update live

**What to build:** the tab reads as live monitoring rather than a stale snapshot. A BIM coordinator
leaves the IOT tab open and watches values move — a room filling up, CO₂ climbing — without
refreshing anything. A dashboard whose numbers never change reads as broken even when it is working.

Readings refresh every five seconds. Five, not sub-second: slow enough that re-rendering two panels
costs nothing, fast enough that the panel visibly lives. Sub-second polling buys nothing when the
underlying data is a random walk, and it would make the charts in ticket 06 unreadable.

**The tick updates React state only and must never touch the 3D engine.** This phase zooms to
geometry but never colours it, so the tick has no legitimate reason to reach the world at all. That
boundary is written down here deliberately, because it is exactly the kind of thing a later change
erodes — a pulsing highlight on the alarming element would feel like a natural addition and would
quietly undo the one-render-per-frame contract that ADR-0020 exists to protect. Keeping the
boundary explicit now costs nothing; recovering it after a regression costs a debugging session.

**Gate the tick on the tab being active, not on the component being mounted.** The model workspace
keeps inactive tabs mounted-but-hidden, so an interval scoped to mount would keep running forever
behind every other tab in the workspace — burning work while the coordinator is in Drawing Editor,
and never stopping. Leaving the tab must stop the tick; returning must resume it.

History is a bounded ring buffer of roughly two hundred points per device and metric. Unbounded
arrays over a long session are a slow leak, and two hundred points is already more than the charts
in ticket 06 can resolve.

Accepted consequence: history is generated backwards from the current moment, so re-entering the
tab produces a slightly different past. Reproducible history is real work for a benefit nobody
looking at mock data will notice.

**Blocked by:** 02 (needs devices whose readings can update).

**Status:** ready-for-agent

- [ ] Values visibly change while the IOT tab is left open
- [ ] Updates arrive on a roughly five-second cadence
- [ ] Values drift plausibly between updates rather than jumping unrecognisably
- [ ] The tick stops when the coordinator switches to another tab
- [ ] The tick resumes on returning to the IOT tab
- [ ] No interval survives leaving the model workspace entirely
- [ ] The tick performs no engine, world, renderer or camera call
- [ ] Orbiting the model while the tab is open shows no stutter or camera reset
- [ ] History is bounded per device and metric; memory does not grow over a long session
- [ ] Status indicators from ticket 04 update as values cross thresholds
- [ ] The offline device's value never begins reading as a number
- [ ] `tsc` and the production build pass
