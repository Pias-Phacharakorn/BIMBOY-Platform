---
name: fable-advisor
description: >-
  Gates and brokers access to Fable 5 as a planning consultant, so its quota
  is spent only on decisions that actually need a second opinion (new
  architecture, cross-cutting refactors, tricky bugs, multiple viable
  approaches) — never on mechanical or already-obvious work. Only invoke this
  skill when the developer explicitly runs /fable-advisor. If a task looks
  like it clears the "worth consulting Fable" bar, say so and suggest running
  /fable-advisor — do not invoke this skill on your own initiative.
---

# Fable Advisor

Fable 5 is a scarce, half-of-plan-quota resource. This skill exists so it only
gets spent on decisions where a second opinion genuinely changes the outcome —
and so every call to Fable carries a small, distilled brief instead of a raw
context dump.

Pipeline this skill sits in:

```
grill-with-docs (interview the developer)
        ↓
fable-advisor  ← you are here (gate → brief → Fable plans)
        ↓
plan-visualizer (formats whichever plan resulted, Fable's or your own)
        ↓
developer approval
        ↓
implementation (Sonnet 5 sub-agent)
```

## Step 1 — Gate: does this actually need Fable?

Decide before doing anything else. Skip Fable and plan the task yourself
(then hand straight to `plan-visualizer`) when the task is:

- A mechanical, single-file change (typo, rename, import fix, small UI tweak)
- Solvable by copying a pattern that already exists elsewhere in this codebase
- Already fully dictated by `AGENTS.md` (layer placement, naming, etc. — no
  judgment call left to make)
- A "read and explain" question with no design decision involved
- A config/dependency bump with no architectural implication

Send it to Fable when the task involves:

- New architecture or feature design with real tradeoffs
- A cross-cutting refactor touching multiple layers/stores
- A tricky bug where root cause isn't obvious
- Multiple viable approaches where a second opinion is worth the quota

State your gate decision and reasoning out loud before proceeding, e.g.
"Gate: send to Fable — this touches clashStore, ClashTable, and the bulk-edit
modal at once, and there are at least two reasonable data-flow designs."

If the gate says skip, stop here — plan it yourself and move on to
`plan-visualizer`. Don't build a brief or spawn Fable.

## Step 2 — Build the brief

The entire economy of this workflow depends on the brief being *distilled*,
not forwarded. Never paste raw conversation history into it. Assemble exactly
these sections:

1. **Goal** — 1-2 sentences: what problem or decision this is about.
2. **Relevant files** — paths plus the specific excerpts that matter. Not
   full files, not unrelated ones.
3. **Constraints** — only the `AGENTS.md` rules that actually bind this
   change (relevant layer-placement rule, naming convention, hard
   constraint) — not the whole document.
4. **The ask** — one concrete question: "what's the best approach for X",
   "tradeoffs between A and B", "likely root cause of Y", etc.
5. **Non-goals** — what's explicitly out of scope, so Fable doesn't
   over-scope the plan.

Include a `git diff` / recent-commit excerpt only when the task is about an
in-progress change or a regression ("this broke after commit X"). Otherwise
leave it out — it's noise that inflates the brief without helping Fable.

Close every brief with an explicit instruction to Fable: *be terse, output a
plan plus tradeoffs, do not write code.*

## Step 3 — Approval gate: show the brief, wait

Every Fable call spends quota, so show the assembled brief to the developer
and wait for an explicit go-ahead before spawning Fable. This is the checkpoint
that catches a bloated or off-target brief before it costs a call, not after.

## Step 4 — Spawn Fable

Once approved, call the Agent tool with:

```
Agent({
  subagent_type: "Plan",
  model: "fable",
  prompt: <the approved brief>,
  run_in_background: false
})
```

`Plan` already restricts tools to read-only/no-edit, which matches what
Fable's role is here: think and advise, never touch files. Run it in the
foreground — the next step needs its result before anything else can happen.

## Step 5 — Hand off to plan-visualizer

Whatever plan resulted — Fable's, or your own from a Step-1 skip — feed it to
the `plan-visualizer` skill so it comes back in the standard Mermaid-diagram
format with pros/cons and a files-changed list, then goes through the normal
developer approval gate. Don't skip this even when Fable already produced a
clear plan — the visualized format and the approval gate are the same either
way.

## Step 6 — Execute with Sonnet 5

After the developer approves the visualized plan, implement it via a
sub-agent, not inline in the main conversation — this is what keeps the main
agent's context and cost low:

```
Agent({
  subagent_type: "general-purpose",
  model: "sonnet",
  prompt: <the approved plan>,
  run_in_background: false
})
```

Sonnet 5 handles execution by default — a good plan makes implementation
mostly mechanical, and Opus-tier reasoning isn't needed just to follow one.

Per the project's hard rule: after implementation, present the result and
stop. Never prompt or offer to `git add`/commit/merge.

## Step 7 — Stuck recovery

If the Sonnet execution sub-agent reports it's genuinely blocked (not just
"hit the first error" — an actual stall or repeated failed attempt), recover
without restarting the whole pipeline:

1. Build a **minimal fix-brief**: what was attempted, the actual
   error/failure, and the narrow question ("why is this failing / what's the
   right fix"). Not the original brief again.
2. Spawn Fable the same way as Step 4 (`Plan` + `model: "fable"`) with just
   that fix-brief. **Skip the approval gate this time** — the developer
   already approved using Fable for this task; re-approving a one-line fix is
   friction without benefit.
3. Hand Fable's answer back to a Sonnet 5 sub-agent to continue.
