# ADR-0023: Camera response ported from crais, but not `infinityDolly`

**Status:** Accepted
**Date:** 2026-08-24
**Area:** [`docs/feature/bim-viewer.md`](../feature/bim-viewer.md) § Camera navigation

## Context

The developer's reference for "how a viewer should feel" is <https://viewer.crais.io>. Its camera
layer is directly comparable: three r184 plus `camera-controls`, with no `@thatopen` anywhere in its
bundle (no `OrthoPerspectiveCamera`, no postproduction). That is the *same library* OBC wraps, so
its configuration is portable rather than merely inspirational.

Read out of its minified bundle: a shared base of `smoothTime: 0.15`, `draggingSmoothTime: 0.05`,
`restThreshold: 0.0025`, `dollyToCursor: true`, `dollyDragInverted: false`, `boundaryFriction: 0`;
and four per-mode presets (`orbit` / `fly` / `screenpan` / `pan`) each carrying its own
`minDistance`, `maxDistance`, `dollySpeed`, `truckSpeed` and rotate speeds. Two of those presets set
`minDistance === maxDistance` — the `camera-controls` idiom for look-around modes, where the pivot
is pinned a fixed distance ahead so rotate becomes "look" and truck becomes "walk". Empirically ten
wheel ticks barely moved their camera, matching the orbit preset's `dollySpeed: 0.5`.

## Decision

Port the three values that are **pure response**, in `setup/src/camera-response.ts`:

| | OBC default | Now |
|---|---|---|
| `smoothTime` | `0.2` | `0.15` |
| `draggingSmoothTime` | `0.125` | `0.05` |
| `dollySpeed` | `1` | `0.5` |

`draggingSmoothTime` is the one that matters most — it is the library default OBC never changes, and
it is what makes an orbit *follow* the cursor instead of catching up with it.

Applied per camera and re-applied on `world.onCameraChanged`, for exactly the reason
`applyCameraDepthRange` already documents: every `OBC.View` builds its own `OrthoPerspectiveCamera`,
and therefore its own `CameraControls`. `dollyToCursor` needed nothing — it is already `true` via the
OBC default.

## Alternatives rejected

- **`infinityDolly: true` with `minDistance: 1`.** This is how crais's camera dollies forever, by
  pushing the target ahead of itself, and it is a large part of what "feels different". It is also
  the exact flag `CursorZoom` turns *off* on purpose: with it on, `minDistance` is dead config and
  cursor-bounded navigation cannot exist at all
  ([ADR-0004](0004-cursor-bounded-navigation.md), with the five-attempt bug history in
  [ADR-0006](0006-zoom-pivot-reanchor.md)). Copying that half of the feel is a decision to reverse
  two ADRs and accept fly-through, not a value to change.
- **The navigation-mode system — deferred, not rejected.** A mode switcher with per-mode presets,
  per-mode mouse-button mappings, and locked-distance walk/look modes. This is where most of "it
  feels like a different app" actually lives. It is a feature, not a tuning pass.

## Consequences

- **`CursorZoom`'s `DOLLY_SETTLE_MS` became `DOLLY_SETTLE_FACTOR`.** It was a flat `300 ms`,
  hand-derived from `smoothTime = 0.2` plus slack, and its doc comment said so. With `smoothTime`
  now `0.15` that constant would hold the pivot re-anchor back for a dolly that finished 75 ms
  earlier, so it now reads `controls.smoothTime * 1000 * 1.5` off the live controls. This is not
  cosmetic: the gate exists because a re-anchor landing mid-dolly sends `dollyToCursor`'s
  `lerpRatio` to ~9 and lurches the camera ([ADR-0006](0006-zoom-pivot-reanchor.md)).
- **Any future change to `smoothTime` now propagates to the settle gate automatically.** That is the
  point of the factor — the two were silently coupled before and nothing said so.
- **Not established:** which of crais's four presets is its default mode, and its mouse-button
  mapping. That part of its bundle is string-table obfuscated, so the port stops at response values.
