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
- **Clause-level change is a real case — name it rather than rounding it to "superseded".** When a new
  ADR replaces or refines *one* decision inside an older record and leaves the rest in force, do not
  mark the whole file superseded: that tells the next reader the design was replaced when most of it
  still holds. Instead qualify the status (`Accepted — <clause> amended by ADR-NNNN`, or
  `superseded by` where the clause is genuinely reversed), add a note under it saying what still
  stands, and put a pointer on the affected passage itself so nobody can read that clause without
  finding the successor. Adding a forward pointer is annotation, not rewriting — never delete or edit
  the original reasoning, and say so explicitly when a later ADR *upheld* a bullet after testing it.
  First case: ADR-0002 § outline colour, amended by
  [ADR-0009](0009-section-plane-gizmo-local-frame.md).
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
