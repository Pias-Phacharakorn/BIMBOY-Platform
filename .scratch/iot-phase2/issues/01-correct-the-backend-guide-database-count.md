# 01: Correct the backend guide's claim of a single database

**What to build:** a developer reading the backend guide learns how many Supabase projects this
installation actually has, and which one the app is pointing at — instead of being told there is one
and being given the name of the inactive one.

The guide currently states that development and production share a single Supabase project and names
it. That was true once. There are now two, the local environment file is explicitly built to switch
the app between them with commented instructions, and the project the guide names is the one that is
currently commented out.

This matters beyond tidiness: the whole IoT phase 2 migration plan turns on there being two
databases that must be kept in step. A developer who trusts the guide will apply a migration to one
database, see the app fail against the other, and have nothing connecting the failure to the cause.

This is a correction of a stale fact, not documentation of new work, so it does not wait for the
post-testing documentation step — the project's own rule is that when a guide and the code disagree,
the guide is wrong.

Keep the existing warning that there is no staging environment. It is still true, and it now applies
twice over.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The guide states that there are two Supabase projects, not one
- [ ] Both are named, and it is clear which the app currently points at
- [ ] The guide explains that the local environment file switches between them
- [ ] The existing "no staging database" warning is retained
- [ ] The guide notes that a schema change must be applied to both
- [ ] No other section of the guide is rewritten
