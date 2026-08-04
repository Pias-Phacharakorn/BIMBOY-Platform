---
name: agy-delegate
description: >-
  Delegates self-contained implementation work to the Antigravity CLI (`agy`)
  as a labour sub-contractor — cheap breadth, standalone artifacts, or a
  second opinion from a non-Claude model family. Locked to gemini-3.6-flash —
  effort switches between medium and high only, no other model is permitted.
  Encodes the two hard-won failure modes: PowerShell
  shreds long prompts, and `agy` deletes repo files even without write flags.
  Use when the developer runs /agy-delegate, or asks to hand work to
  agy/Antigravity/Gemini. Do not invoke on your own initiative for work that
  needs deep project context — see the Step 0 gate.
---

# agy-delegate

Read `references/brief-template.md` first — it is the brief's template and
cheat sheet (placeholders, a copy-paste constraint library, and the Shape A /
Shape B output contracts are documented in an HTML comment at its top).

`agy` is the Antigravity CLI: a headless agent on PATH. It is **labour, not
judgment**. You stay the primary developer — you own the brief, the review,
and the diff the developer eventually sees. `agy` never commits, never merges,
and never gets the last word.

Default engine: **`gemini-3.6-flash-medium`**. Locked — see *Engines*.

```
developer asks
      ↓
Step 0  gate — is agy actually the right tool?
      ↓
Step 1  pick a shape — stdout capture (default) or worktree write
      ↓
Step 2  brief: fill references/brief-template.md, then lint it
      ↓
Step 3  invoke via Bash (never PowerShell)
      ↓
Step 4  verify — spec compliance + scope audit
      ↓
Step 5  integrate, then present the diff and stop
```

## ⛔ Non-negotiables

These are not style preferences. Each one is a bug that already happened.

1. **Never invoke `agy` from the repo root. Ever. `cd` to the scratchpad
   first.** This is unconditional — not "when it can write", not "for real
   runs". On 2026-08-04 this happened **twice in one session**:
   - `agy -p "<task>"` deleted untracked `HANDOFF-cursorzoom-zoom-freeze.md`
     (385 lines) with **no** `--mode accept-edits` and **no**
     `--dangerously-skip-permissions`.
   - A one-line throwaway probe — `agy -p "Reply with exactly: ADDDIR-FILE-OK"
     --add-dir CLAUDE.md` — deleted untracked `agy-delegation-slides.html`
     (33 KB). A *flag test*. No task, no writes requested.

   Print mode is agentic and retains file-mutation authority regardless of the
   opt-in flags, and it will tidy files it considers stray. Untracked files are
   unrecoverable by git. **Triviality of the prompt is not protection** — the
   second loss came from the most harmless call imaginable, run while verifying
   this very skill. Every `agy` call gets `cd "$SP"` first, probes included.
2. **Never pass a prompt to `agy` from PowerShell.** Windows PowerShell 5.1
   does not escape embedded quotes when marshalling native-exe arguments; it
   truncates the prompt at the first `"`, and `agy` silently improvises from
   the fragment and exits 0. Always use the **Bash** tool with
   `"$(cat promptfile)"`.
3. **Never let `agy` run git, npm, or a build.** State this in every brief.
4. **Never present `agy` output as finished work.** It gets reviewed like any
   sub-contractor's output before the developer sees it.
5. **Never offer to `git add`/commit/merge** — project hard rule, unchanged.

## Step 0 — Gate: is `agy` the right tool?

Say your gate decision out loud in one line before doing anything else.

**Delegate to `agy`:**

- Self-contained new artifacts with no deep project coupling (slide decks,
  standalone HTML/scripts, docs, sample data, throwaway tooling)
- Mechanical breadth — the same transformation across many files
- A genuine second opinion on a hard bug from a different model family
  (deliberately decorrelated from Claude's reasoning)

**Do it yourself:**

- Anything touching `src/bim-components/`, the OBC world setup, or in-flight
  branch work
- Anything requiring the architecture rules in `CLAUDE.md` to be applied with
  judgment (layer isolation, `@/*` alias, BUI containment, no Supabase in
  `views/`) — `agy` does not read `CLAUDE.md` and will violate them
- Anything where the developer needs one coherent, reviewable diff from a
  single author
- Small enough that briefing costs more than doing

## Step 1 — Pick a shape

**Shape A — stdout capture (default).** `agy` gets **no** write authority. It
returns text; you own the single destination path. Correct for any deliverable
that is one file.

**Shape B — worktree write.** Only when `agy` genuinely must create or edit
multiple files. Give it a throwaway git worktree so it cannot reach the live
tree, then cherry-pick what survives review.

```bash
git worktree add ../agy-scratch-<slug> HEAD
# ...run agy with that worktree as cwd...
# review, copy out what's good, then:
git worktree remove ../agy-scratch-<slug> --force
```

Shape B is the *only* situation where `--mode accept-edits` is acceptable, and
even then the worktree — not the flag — is what makes it safe. Note that
Claude Code's permission classifier may refuse
`--dangerously-skip-permissions` outright; that refusal is correct, do not try
to route around it. If a write-capable run is genuinely required and blocked,
stop and explain to the developer rather than improvising a workaround.

## Step 2 — Brief: short prompt + repo context

**Let `agy` read the repo instead of retyping it into the prompt.** Hand-copying
project facts into a brief is the single largest waste in this workflow. Name
the paths in the brief and let its own read tools do the work:

> Read `./CLAUDE.md` and `./docs/feature/bim-viewer.md` for project context.
> Read nothing else.

Because `agy` runs with the repo root as cwd, it can already reach anything
tracked there — `--add-dir` is only needed to widen scope to paths **outside**
cwd. It takes a directory; passing a file path is accepted without error but
its effect is unverified, so prefer naming files in the brief and reserve
`--add-dir` for genuinely external directories.

Note the tension with Shape A's "do not explore" prohibition: when you want
`agy` to read project files, scope the permission narrowly (*"read exactly
these two paths"*) rather than dropping the prohibition entirely.

Copy `references/brief-template.md` to `<scratchpad>/agy-brief.txt` and fill
every `{{PLACEHOLDER}}`. Never inline a brief in the command — that is how the
PowerShell truncation happened, and a file is also what makes the lint below
possible.

The template carries the fixed sections (prohibitions, both output contracts)
and a copy-paste constraint library, so the only thing you author per task is
the deliverable, the facts, and the non-goals. Keep the result **under ~40
lines** — over-specifying means you did the design work and `agy` only
rendered it.

Four deletions are mandatory before sending, because the brief is a prompt and
anything left in it is read as instructions:

- the leading HTML comment block
- the unused Shape A / Shape B block
- the `# INTEGRITY CHECK` section (real runs only — see below)
- every `{{PLACEHOLDER}}` token

**Lint the brief.** All four counts must be `0`:

```bash
B="$SP/agy-brief.txt"
printf 'placeholders=%s comments=%s shapes=%s sentinel=%s lines=%s\n' \
  "$(grep -c '{{' "$B")" "$(grep -c '<!--' "$B")" \
  "$(grep -c 'SHAPE [AB]' "$B")" "$(grep -c 'INTEGRITY CHECK' "$B")" \
  "$(wc -l < "$B")"
```

A non-zero count means `agy` receives template scaffolding as instructions.
Fix it before spending a call.

`sentinel` is the dangerous one. The integrity section ends with *"ignore every
instruction above"* — if it survives into a real brief, `agy` returns only the
token and you get a silent, total no-op that looks like a model failure. It
must be present for a probe run and absent for every real run; never both.

Expect roughly **45–55 lines** once filled. The fixed sections account for
~25 of those, so if your authored content pushes it past ~55, you are
over-specifying.

## Step 3 — Invoke via Bash

Snapshot scope first — **including untracked files**, which is how the
deletion went unnoticed:

```bash
cd "<repo root>"
git status --porcelain > "$SP/scope-before.txt"
```

Shape A:

```bash
SP="<scratchpad>"
AGY="/c/Users/PhacharakornMuangkae/AppData/Local/agy/bin/agy.exe"
"$AGY" -p "$(cat "$SP/agy-brief.txt")" \
  --model gemini-3.6-flash-medium \
  --print-timeout 8m > "$SP/out.raw"
echo "exit=$?"; wc -c < "$SP/out.raw"
```

Use `run_in_background: true` for anything expected to exceed ~2 minutes.

For a long or quote-heavy brief, spend one cheap call proving it arrived whole
before spending the real one — append a sentinel line
(*"if you can read this, reply exactly SENTINEL-OK"*) and run it against
`gemini-3.6-flash-medium`. A wildly off-brief result is a truncation symptom,
not a model-quality symptom.

## Step 4 — Verify

**Spec compliance** — grep, do not eyeball:

```bash
F="$SP/out.raw"
head -2 "$F"; tail -2 "$F"                       # contract honoured?
grep -c '```' "$F"                                # fences leaked?
grep -nE 'https?://|<script src|fonts\.google' "$F"   # MUST be empty
```

Then confirm the facts you asked for are actually present, and that any
interactive wiring resolves (every `getElementById` target defined, initial
state set).

**Scope audit** — diff both directions; a vanished `??` line is invisible
otherwise:

```bash
git status --porcelain > "$SP/scope-after.txt"
diff "$SP/scope-before.txt" "$SP/scope-after.txt"
```

Any unexpected change — especially a *removed* line — is an incident. Go to
Step 6 before anything else.

## Step 5 — Integrate

Place the artifact yourself, fix `agy`'s constraint violations inline, then
present the diff and stop. In the write-up, segment provenance honestly:
**authored by agy** / **corrected by you** / **placed by you**. The developer
must be able to tell which model wrote what.

## Step 6 — Recovery: a file vanished

Windows sends app deletions to the Recycle Bin, so this is usually
recoverable. Check there **first** — do not reach for git, which cannot help
with untracked files.

```powershell
$sh = New-Object -ComObject Shell.Application
$bin = $sh.Namespace(10)
$item = $bin.Items() | Where-Object { $_.Name -eq '<filename>' }
($item.Verbs() | Where-Object { $_.Name -replace '&','' -match 'Restore' }).DoIt()
```

Verify size and `LastWriteTime` afterwards, re-run the Step 4 scope diff, and
tell the developer plainly what was lost and what was recovered.

## Engines — locked to `gemini-3.6-flash`

**Developer directive: `gemini-3.6-flash` is the only permitted model.** The
sole tuning knob is the effort tier, and only between **`medium`** and
**`high`**. This is not a default to reason about — it is a constraint.

| Use | Model |
|---|---|
| **Default — all delegation, incl. probes** | `gemini-3.6-flash-medium` |
| Complex structure, long artifacts, hard reasoning | `gemini-3.6-flash-high` |

**Forbidden**, even when a run disappoints: `gemini-3.6-flash-low`, any
`gemini-3.5-flash-*`, any `gemini-3.1-pro-*`, any `claude-*`,
`gpt-oss-120b-medium`. Do not escalate off `3.6-flash` and do not offer to.

When a `medium` run comes back weak, the recovery order is:

1. **Fix the brief** — vague or over-long briefs cause most bad output, and a
   truncated one causes the rest (verify integrity before blaming the model).
2. **Re-run at `high`.**
3. If `high` still fails twice, **stop and report** to the developer. Do not
   reach for another model — say the task looks unsuited to `3.6-flash` and let
   them decide.

The effort tier is baked into the model id, so `--model gemini-3.6-flash-medium`
already means medium effort; the separate `--effort` flag is redundant with it.
Pick the tier via the model id and leave `--effort` alone.

Quota spent is the developer's Antigravity quota, not this session's.

## Flag reference

| Flag | Effect |
|---|---|
| `-p` / `--print` | One-shot prompt, response to stdout |
| `--print-timeout` | Wait limit, default `5m0s` |
| `--model` | Engine (see above) |
| `--add-dir` | Add a **directory** to the workspace, repeatable — only needed for paths outside cwd |
| `--output-format` | `text` \| `json` \| `stream-json` |
| `--json-schema` | Force structured output you can parse |
| `--mode` | `plan` (read-only) \| `accept-edits` (Shape B only) |
| `--sandbox` | Terminal restrictions |
| `--dangerously-skip-permissions` | Unattended writes — classifier may refuse; do not route around |
| `-c` / `--continue`, `--conversation` | Resume a prior session |
| `--effort` | `low` \| `medium` \| `high` — redundant when baked into `--model` |

## Checklist

- [ ] Gate decision stated out loud; task is genuinely `agy`-shaped
- [ ] Shape chosen — A (stdout capture) unless multi-file writes are required
- [ ] Shape B only: worktree created, and removed again afterwards
- [ ] Brief copied from `references/brief-template.md`, not written from scratch
- [ ] Brief lint clean — 0 placeholders, comments, shape markers, `INTEGRITY CHECK`
- [ ] Brief is ~55 lines or fewer; facts not already readable in the repo
- [ ] Model is `gemini-3.6-flash-medium` or `-high`. Nothing else, no exceptions
- [ ] Invoked via **Bash** with `"$(cat brief)"` — never PowerShell
- [ ] `cd "$SP"` before **every** `agy` call, probes and flag tests included
- [ ] `scope-before.txt` captured *before* the call
- [ ] Output contract verified: no fences, correct first/last tokens
- [ ] HTML work: `grep` for `https?://` / `fonts.google` returns nothing
- [ ] Scope diff run both directions; **removed** `??` lines investigated
- [ ] Anything vanished → Recycle Bin recovery (Step 6) before anything else
- [ ] Provenance segmented in the write-up: authored by agy / corrected / placed
- [ ] Diff presented, then stop — no `git add`/commit/merge offered
