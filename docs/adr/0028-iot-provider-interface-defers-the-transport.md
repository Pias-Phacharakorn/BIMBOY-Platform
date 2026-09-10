# ADR-0028: The IoT provider interface defers the transport, and carries no BIM identity

**Status:** Accepted
**Date:** 2026-09-10
**Area:** [`docs/feature/iot.md`](../feature/iot.md)

## Context

The IOT tab was designed and built with **no real IoT source available** — no vendor chosen, no
payload seen, no idea whether readings would arrive by REST poll, MQTT, websocket or a Supabase
table somebody else writes.

The obvious move is to model the data after whatever platform seems likeliest and adapt later. That
is how this kind of feature usually dies: the schema encodes one vendor's payload, the real vendor
turns out to differ, and the "adapter" becomes a rewrite of everything downstream of it.

There was a second pull in the same direction. Devices here are bound to IFC elements, so it is
tempting to put `ifcGuid` on the device type the telemetry layer hands back — it is right there, and
it would save a join.

## Decision

Telemetry is reached through a **narrow interface that answers only telemetry questions** — and
**nothing on the telemetry side knows about BIM**. `IotProvider` (`iotTypes.ts`) is the contract:
`getLatest` and `getHistory` for values, `isOnline` and `lastSeen` for whether the device is
reporting at all. Offline is a device fact, not a value — which is why it is asked separately
rather than inferred from an absent reading.

`Reading` carries `deviceId`, `metric`, `value`, `unit`, `ts`. That is all. BIM identity lives on
the authored `iot_devices` row, which is project data the app owns; the provider is handed a device
id and answers what it is reading.

Phase 1 also had `listDevices`, because the provider owned the roster. Phase 2 **removed it**: once
devices are authored rows in Supabase, asking a telemetry source which devices exist is asking the
wrong system. What remains is exactly what a real platform genuinely answers.

## Alternatives rejected

- **Design the schema around a real payload first.** No payload existed to design around. Waiting
  for one meant not building the feature; guessing one meant encoding a guess into the database.
- **Put `ifcGuid` on the telemetry `Device` type.** It makes the mock pretend it knows about BIM,
  and the interface stops being satisfiable by a real platform — real sensors carry a device id and
  nothing else. Confirmed with the developer rather than assumed.
- **A `iot_device_bindings` table in phase 1.** Durable storage of *fiction*: it would map invented
  device ids to real GUIDs, then be thrown away when real ids arrived. Phase 1 kept devices stable
  across reloads by deterministic seeding instead of by storage, and the real table arrived in phase
  2 only once the things being stored were real user decisions.

## Consequences

- The transport decision stays open. Connecting a real platform is a new `IotProvider`
  implementation plus a way to map `device_code` to that platform's id — not a schema migration
  through the UI.
- `device_code` exists on `iot_devices` as a **nullable** column waiting for that real id. Nullable
  and not required: forcing users to fill it today produces junk that has to be cleaned later, while
  having no column at all means a migration plus a backfill on the day of connection.
- The mock has to answer questions a real platform would answer, which is a constraint on the mock,
  not a convenience. That is deliberate — see [ADR-0031](0031-iot-tick-never-touches-the-obc-world.md)
  for the matching restraint on the tick.
- A device and its readings must be joined in the app rather than arriving together. Accepted; it is
  one lookup, and it is what keeps the two sides independently replaceable.
