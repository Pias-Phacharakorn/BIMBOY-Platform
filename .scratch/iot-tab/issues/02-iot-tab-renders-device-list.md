# 02: IOT tab renders a device list

**What to build:** a BIM coordinator opens a project's model workspace, clicks a new **IOT** tab
alongside Room and GIS, and sees a list of the project's IoT devices in the left panel — each with
a human-readable label, its device ID, and its current reading with units.

This is the tracer bullet: it cuts a complete path from data source to rendered UI, and it is
demoable on its own. Everything after this ticket adds behaviour to a tab that already works.

Three pieces land together because none of them is meaningful alone:

- **The tab.** Registered in the model workspace's tab list and its flex-layout set, so it inherits
  the existing left-panel / viewport / right-panel arrangement. A device list with no tab to live in
  is not demoable; a tab with no list is an empty box.
- **The provider interface.** The feature consumes IoT data through exactly three methods — list the
  devices, get the latest reading per device, get a metric's history over a time range. Any real IoT
  platform can satisfy these; this is what lets a real source replace the mock later without
  touching the UI.
- **The mock behind it.** A seeded random walk, not a static fixture and not raw randomness. Static
  data gives flat-line charts later that cannot distinguish a rendering bug from real data; raw
  randomness gives noise that looks broken. The walk drifts plausibly and returns the same devices
  across reloads.

The mock must always contain one device in CO₂ alarm, one over temperature, and one offline. These
are scripted rather than left to chance so that every rendering path added by later tickets is
guaranteed present on load, instead of appearing when a random generator happens to oblige.

Devices carry no BIM identity — no IFC GlobalId, no element reference. Real sensors carry a device
ID and nothing else, confirmed with the developer. If a BIM identifier leaked into the device shape,
the mock would be pretending to know something no real sensor system knows, and the interface would
stop being satisfiable by a real platform.

Readings carry no status field either. Status is derived, and arrives in ticket 04.

Type shape, from the design session — these encode decisions more precisely than prose:

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

No zoom, no status colours, no charts, no live updates. Those are tickets 03 through 06.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] An IOT tab appears in the model workspace alongside the existing tabs
- [ ] Selecting it shows the left panel and viewport in the same arrangement as the Room tab
- [ ] The left panel lists mock devices, each showing label, device ID, current value and unit
- [ ] Data reaches the UI only through the three-method provider interface
- [ ] The device type carries no IFC GlobalId or element reference
- [ ] The reading type carries no status field
- [ ] Reloading the page returns the same devices in the same order
- [ ] The mock always includes one alarming, one over-temperature and one offline device
- [ ] Switching to another tab and back leaves the list intact
- [ ] A clear empty state renders when no model is loaded
- [ ] All new code lives in a single feature module; no changes to stores, the viewport wrapper,
      BIM components, Supabase or migrations
- [ ] `tsc` and the production build pass
