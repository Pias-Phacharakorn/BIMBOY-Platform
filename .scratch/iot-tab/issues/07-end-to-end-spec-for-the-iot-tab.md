# 07: End-to-end spec for the IOT tab

**What to build:** one end-to-end test that protects the parts of this feature that survive into
phase 2 — the tab, the device list, status, selection and the camera flight. It drives the real
application against a real loaded model, because that is the only place those parts mean anything.

**One seam, and it is the highest available one.** The test asserts what a BIM coordinator can
observe: a device appears, a status reads as alarming, a click changes what the right panel
describes. It must never reference the seeded generator's internals, the binding chain's category
order, or the shape of the map handed to the camera. All three are expected to change when a real
IoT source arrives, and a test coupled to them would fail on a refactor that broke nothing.

**No unit test runner is introduced.** The repository has none today — the entire suite is
end-to-end — and this feature is the wrong place to set that precedent. The argument is what
survives: the mock provider exists to be deleted, and unit-testing the determinism of a seeded
random walk is investment in code with a known expiry date. The threshold and offline edge cases
that would otherwise justify unit tests are observable at this seam anyway, because the mock's
scripted alarming, over-temperature and offline devices are guaranteed present on every load.

**Prior art to follow.** The existing model-teardown spec is the closest template: it logs in
through the shared test-user helper, discovers a project from the rendered project list, navigates
to the model route, and waits a fixed interval for engine setup because there is no ready signal. It
also demonstrates collecting console and page errors filtered to specific signatures, which this
spec should reuse for the assertion that selecting devices does not crash the engine.

The shared helper skips its test when test-account credentials are absent. This spec must do the
same, and additionally skip when the test account has no project with a loaded model — a test that
fails because of an empty fixture teaches nobody anything.

Deliberately not covered: seeded-walk determinism across reloads, exact threshold boundary values,
the category fallback chain's ordering, and chart pixel output. Each is either throwaway code or
implementation detail.

**Blocked by:** 03 (selection and camera), 04 (status and sorting), 06 (the right panel it asserts
against).

**Status:** ready-for-agent

- [ ] The spec skips cleanly when test credentials are absent
- [ ] The spec skips cleanly when no project with a loaded model is available
- [ ] The IOT tab is reachable from the model workspace
- [ ] The device list populates against a real project model
- [ ] A device in alarm is present and appears above healthy devices
- [ ] The offline device renders a no-value indicator and not `0`
- [ ] Selecting a device updates the right panel to describe that device
- [ ] Selecting devices raises no engine page errors or console errors
- [ ] Leaving the IOT tab and returning does not crash or leak
- [ ] No assertion references generator internals, binding order, or camera argument shape
- [ ] No unit test runner is added to the project's dependencies
- [ ] The spec passes locally against a real project
