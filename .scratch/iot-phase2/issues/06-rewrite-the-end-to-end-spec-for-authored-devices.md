# 06: Rewrite the end-to-end spec for authored devices

**What to build:** one end-to-end test that protects the phase 2 lifecycle — bind an element, see the
device, select it, then remove it — driven through the real application.

The existing spec asserts against the hardcoded roster: that a device called `ENV-3F-03` is in alarm,
that a specific device is offline. Every one of those assertions becomes false the moment devices are
authored rather than invented, so this is a rewrite, not an extension.

**The constraint that did not exist in phase 1: this test writes to a live database.** There is no
staging environment — both Supabase projects are production — so a test that binds a device creates a
real row that real users will see.

The approach is **create, assert, then clean up in the same test**: bind a device, assert against it,
delete it through the same interface, and assert it is gone. This covers the full lifecycle including
deletion, and leaves nothing behind. Two alternatives were weighed and rejected: a read-only test
assuming a device already exists cannot cover binding, which is the feature's entire point; a
dedicated seeded test project would be cleaner but means provisioning and maintaining fixture data
across two databases.

Because the test writes, it must fail safe. Skip when credentials are absent, when no project is
available, when no model is loaded, and when the account is not a project admin on the project it
found. A test that cannot clean up after itself should fail loudly rather than leave a stray device
behind — an assertion that the device is gone is part of the test, not an afterthought.

Follow the existing prior art for the mechanics: the shared login helper, discovering a project from
the rendered list, the fixed wait for engine setup because there is no ready signal, and the filtered
console and page-error collection for asserting the engine did not crash. Keep phase 1's generous
per-test timeout — the budget is global and this test does strictly more than its predecessor.

Assert only what a user can observe. No assertion may reference the value generator's internals, the
resolution fallback order, or the shape of the argument handed to the camera. All three are expected
to change when real telemetry arrives.

**Blocked by:** 03, 04, 05 (the test asserts the full lifecycle across all three).

**Status:** ready-for-agent

- [ ] The spec skips when credentials, a project, a loaded model, or admin rights are missing
- [ ] Binding an element creates a device that appears in the list
- [ ] Selecting the device updates the right panel to describe it
- [ ] Selecting it raises no engine page errors or console errors
- [ ] Deleting the device removes it from the list
- [ ] The test asserts the device is gone, so a failed cleanup fails the test
- [ ] No device created by the test survives a passing run
- [ ] Assertions on the old hardcoded roster are removed, not adapted
- [ ] No assertion references generator internals, resolution order, or camera argument shape
- [ ] No unit test runner is added
- [ ] The full Playwright suite passes, including the pre-existing specs
