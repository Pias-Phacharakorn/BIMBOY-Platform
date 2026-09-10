# Domain Docs

How the engineering skills should consume this repo's domain documentation.

Single-context repo: one glossary, one ADR folder, no `CONTEXT-MAP.md`.

## ⚠️ This repo splits the glossary out of `CONTEXT.md`

The `domain-modeling` skill states that `CONTEXT.md` "is a glossary and nothing else."
**In this repo it is not.** `CONTEXT.md` was already a *staging buffer* for in-flight decisions
before these skills arrived, with a promotion flow into `docs/feature/` and `docs/adr/` that
`docs/adr/README.md` documents and 27 ADRs already went through. Emptying it to make room for a
glossary would throw that away.

So the glossary lives at **`docs/glossary.md`**, and everything `domain-modeling` says about
`CONTEXT.md` applies to that file instead:

| File | Role | Lifetime |
|---|---|---|
| `docs/glossary.md` | The domain glossary. Terms only, no implementation detail. Format per the skill's `CONTEXT-FORMAT.md` | permanent, grows |
| `CONTEXT.md` | Staging buffer for in-flight decisions. Cleared on promotion | temporary by design |
| `docs/adr/` | Why a decision was made, and what was rejected | permanent |
| `docs/feature/` | How each area is wired today — 9 guides, navigational | permanent, rewritten as code changes |

`docs/glossary.md` does not exist yet. Create it **lazily**, when `/domain-modeling` resolves the
first term — not upfront, and not by bulk-harvesting terms out of the guides.

## Before exploring, read these

- **`docs/glossary.md`** (when it exists) for vocabulary
- **`docs/adr/`**: read ADRs that touch the area you're about to work in
- **`docs/feature/<area>.md`**: the guide for the area you're touching — the map of what exists and what will bite you. `CLAUDE.md` § Domain Guides has the routing table
- **`CONTEXT.md`**: only to see what is currently in flight

If a file doesn't exist, **proceed silently**. Don't flag its absence; don't suggest creating it
upfront.

## File structure

```
/
├── CONTEXT.md          ← staging buffer, not a glossary
├── docs/
│   ├── glossary.md     ← the glossary (created lazily)
│   ├── adr/            ← 0001-…, 0002-… sequential
│   ├── feature/        ← 9 area guides
│   └── agents/         ← this file + issue-tracker.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a spec, a hypothesis, a test name), use
the term as `docs/glossary.md` defines it. Don't drift to synonyms it lists under `_Avoid_`.

If the concept isn't in the glossary yet, that's a signal: either you're inventing language the
project doesn't use (reconsider), or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently
overriding:

> _Contradicts ADR-0007 (clip-aware raycaster), but worth reopening because…_

## Writing rules that survive from the old workflow

These are not `domain-modeling` defaults; they are this repo's, and they still hold:

1. **Cite symbols, not line numbers.** `_syncVisibility`, never `index.ts:220`. Exception: pinned vendor bundles, whose offsets are stable.
2. **Don't restate what the code says plainly** — that adds drift surface, not knowledge.
3. **The code is the source of truth.** When a guide and the code disagree, fix the guide.
