# Architecture Decision Records

This folder is where **decisions land** — the ones staged in `CONTEXT.md`, and the ones
worked out during a `/grill-with-docs` session with the developer.

A domain guide in `docs/feature/` records **how** the code works today. An ADR records
**why** it works that way: the constraint that forced it, and the alternatives that were
considered and rejected. The guide answers "what does this do?"; the ADR answers "why not
the obvious other thing?" — the question that otherwise gets re-litigated every six months.

## The promotion flow

```
/grill-with-docs discussion
        │
        ▼
   CONTEXT.md ............ staging buffer, in-flight only. Never the permanent record.
        │
        │  decision implemented + merged
        ▼
   ┌────┴─────────────────────────────┐
   ▼                                  ▼
docs/feature/<area>.md            docs/adr/NNNN-<slug>.md
how it works now                  why — with rejected alternatives
(always)                          (when the "why" has lasting value)
        │
        ▼
   clear the entry from CONTEXT.md
```

## Write an ADR when

- A rejected alternative was genuinely tempting, and the reason it lost is non-obvious
- A platform or vendor constraint forced the design (e.g. "the OS composites AR camera
  passthrough, so our renderer cannot dim the real world")
- The decision cuts across layers, or pins a dependency version
- Reversing it later would be expensive

**Skip the ADR** when the guide alone is enough: naming, file placement, styling, or
anything already covered by a hard constraint in `CLAUDE.md`. Not every decision earns a
file — a bad ADR is one nobody needed to read.

## Convention

- Filename `NNNN-kebab-case-title.md`, zero-padded and sequential (`0001-…`, `0002-…`)
- Numbers are **never reused or renumbered** — they are permanent references
- Never rewrite history: to reverse a decision, add a new ADR and mark the old one
  `Superseded by ADR-NNNN`
- Keep it to one page. Longer than that means it's really a domain guide

## Template

```markdown
# ADR-NNNN: <decision in one line>

**Status:** Accepted | Superseded by ADR-NNNN
**Date:** YYYY-MM-DD
**Area:** <matching docs/feature/ guide, if any>

## Context
The constraint or problem. What was true that made this a decision rather than a default.

## Decision
What we do. Present tense, specific.

## Alternatives rejected
- **<option>** — why it lost.

## Consequences
What this costs us, what it forecloses, and what to watch for.
```
