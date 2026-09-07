# 02: The iot_devices schema is live on both Supabase projects

**What to build:** the database can hold IoT device bindings, on both Supabase projects, with the
same access rules as every other feature table — and the application's generated types know about it.

Nothing user-facing ships in this ticket. It is the foundation every other ticket stands on, and it
is the one piece of the work that touches production directly.

The migration is already written and reviewed as part of the design; this ticket applies it. It
creates a metric enum (temperature, humidity, CO₂, power, occupancy, PM2.5), the device table
anchored on the IFC GlobalId with the model reference as a non-authoritative hint, a uniqueness rule
of one device per element per project, an updated-at trigger with a pinned search path, and four
policies: members read, project admins write.

**Apply it to both projects.** This installation has two and the app switches between them. A schema
present in only one is a time bomb for whoever switches back, and nothing about the resulting failure
would point at the migration. Both projects were verified to carry the same membership helper
functions, so one migration script runs unmodified on both.

Afterwards, run the security and performance advisors on both. This project has a history here — an
existing migration exists solely because the advisor flagged mutable function search paths — so a
new table and a new trigger function are worth re-checking rather than assuming.

Then regenerate the shared TypeScript types. They are generated output and must never be hand-edited;
every later ticket depends on them describing the real schema.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The migration is applied to the PIAS project
- [ ] The migration is applied to the RITTA project
- [ ] Both projects report the same table, enum, trigger and four policies
- [ ] Row-level security is enabled on the new table on both
- [ ] The security advisor is run on both and any new finding is reported
- [ ] The performance advisor is run on both and any new finding is reported
- [ ] The shared TypeScript types are regenerated from the live schema, not hand-written
- [ ] The regenerated types include the metric enum with all six values
- [ ] The typecheck and the production build pass with the regenerated types
- [ ] The migration file in the repository matches exactly what was applied
