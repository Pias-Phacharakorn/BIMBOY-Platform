---
name: chrome-diagnose
description: Reproduce and diagnose a bug the developer hit in the running app, by attaching Claude in Chrome to the localhost tab they are already testing in. Diagnosis on demand only — never a pre-flight, never a substitute for the developer's own testing. Use when the developer reports something broken in the browser, asks you to look at it live, or runs /chrome-diagnose.
license: MIT
category: testing
---

# Chrome Diagnose

The developer tests; you diagnose. This skill is the bridge between the terminal (where you write
code) and their browser (where the bug actually happens).

**It does not change who tests.** CLAUDE.md § Workflow keeps the developer as tester and final
approver. You do not open Chrome to pre-verify your own work, and you never report "it works"
because a screenshot looked right. You open Chrome when they tell you something is broken.

## Step 0 — Gate

Diagnose in Chrome only when the bug needs a **live, stateful browser**: a runtime throw, a
render that goes wrong after a specific sequence, a leak, a click that does nothing, something
that only appears with N models loaded or after a projection switch.

Do **not** reach for Chrome when:

- `tsc`, `eslint`, `npm run build`, or `npm run check:gizmo` would find it — run those first, they
  are faster and they do not need the developer's browser.
- The report is about *feel* or *taste* (damping, edge weight, whether AO reads right). You cannot
  judge those from a screenshot. Ask for the numbers they want instead.
- An existing `e2e/*.spec.ts` already covers the flow — run `npm run test:e2e` and read the failure.

## Step 1 — Load the tools in ONE call

```
ToolSearch "select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__read_console_messages,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_network_requests,mcp__claude-in-chrome__navigate"
```

Never one ToolSearch per tool. Add `find` / `form_input` to the same call if the repro needs them.

## Step 2 — Attach to their tab, do not build your own

Call `tabs_context_mcp` first. It lists only tabs **inside the Claude group**, and the developer's
localhost tab is expected to be one of them — they drag it in.

- **The tab's URL is the source of truth for the port.** `vite.config.ts` sets no `server.port`, so
  Vite takes 5173 and silently increments; a dev server can be on 5174, 5175, anything. Read the
  port off the tab. Never assume 5173.
- **If their tab is not in the group, ask them to drag it in.** Do not open your own tab and try to
  rebuild the state — the state *is* the bug report. Models loaded, camera parked, app tab active:
  that is what you were called in to look at.
- **You are sharing their tab.** Your clicks move their view and your screenshots are their screen.
  Say what you are about to do before doing anything that loses their state (navigate, reload,
  close a panel). Their parked camera may be the only way back to the bug.

## Step 3 — Observe before you touch

In order, cheapest first:

1. `computer` → `screenshot`. Confirm you are looking at what they described.
2. `read_console_messages` **with a `pattern`** — unfiltered output on this app is enormous. Start
   with `pattern: "error|warn|dispose|Cannot|undefined"` and narrow.
3. `read_network_requests` when the symptom smells like data — a model that never appears, an empty
   list, a stuck loader.

Only then interact.

## Step 4 — Instrument with `javascript_tool`

This is the tool the other layers do not have: live reads off the running engine.

```js
// The world and its parts. `bimStore` is not on window — reach the engine through what is.
const canvas = document.querySelector('canvas');
```

Known traps in this app, all confirmed against the pinned vendor:

- **`renderer.postproduction` throws** ("Renderer not initialized yet with a world!") rather than
  returning undefined, and every pass getter throws until `initialize()` has run. Wrap engine reads
  in `try/catch` or a probe will look like a bug of its own.
- **Read `controls` state, do not set it.** `camera-controls` values (`smoothTime`,
  `draggingSmoothTime`, `dollySpeed`, `infinityDolly`, `minDistance`) are set from
  `setup/src/camera-response.ts` and `CursorZoom`; poking them live desynchronises those owners and
  invalidates the very behaviour you are diagnosing.
- **Never trigger `alert`/`confirm`/`prompt`.** A modal dialog blocks every subsequent browser tool
  call and the session goes dead. Use `console.log` plus `read_console_messages`.

## Step 5 — Mind the database

Dev and production share **one** Supabase project (`tbrnwnghjfkwnzsldfit` in both `.env.local` and
the Cloudflare build variables). There is no staging. Anything you click that writes — loading a
cloud model, a BCF comment, a project or member setting — lands in production data.

- Prefer read-only interaction. Screenshots, console, network, JS probes.
- Never enter credentials. You are attaching to a session the developer already opened.
- When a **clean** reproduction is needed, `/demo` is the safe surface: guest mode, no Supabase
  session at all, eight static `.frag` files from `public/resources/demo/`. It reproduces anything
  about the viewer, viewport tools, render passes or camera. It will not reproduce data-shaped bugs.

## Step 6 — Fix, then decide about a spec

Fix the cause, not the symptom. Then:

- **Headless-reproducible → write the spec.** If the bug throws, logs, or changes the DOM
  deterministically, add an `e2e/*.spec.ts` so it cannot come back silently. Model it on
  `e2e/model-teardown.spec.ts`: drive the flow, collect `pageerror` and `console` errors, and match
  **specific** signatures rather than asserting a clean console — this app logs unrelated warnings
  and a blanket assertion would be permanently red. Reuse `loginAsTestUser` from `e2e/helpers.ts`,
  which skips itself when `.env.local` has no credentials.
- **Visual, timing-dependent, or feel-based → write no spec, and say so.** An assertion that cannot
  actually fail when the bug returns is worse than no assertion: it reports safety that is not
  there. State plainly that the regression is uncovered and why.

`npm run test:e2e` runs on its **own dedicated port**, not the dev server's, so it always tests the
code in the working tree and can never attach to a stale server the developer left running.

## Step 7 — Report

Four things, briefly:

1. **What you reproduced** — and if you could not reproduce it, say that first and stop guessing.
2. **Root cause**, at the level of the actual mechanism (which owner, which vendor behaviour).
3. **The fix**, and what you verified about it — including that Chrome verification is not the
   developer's verification.
4. **The spec**, or the explicit reason there is none.

Then hand back. The developer still confirms it in the real app; that is unchanged.
