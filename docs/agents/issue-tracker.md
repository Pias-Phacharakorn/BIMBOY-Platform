# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

**Why not GitHub Issues.** The remote is GitHub (`Pias-Phacharakorn/BIMBOY-Platform`), but the
`gh` CLI is not installed on the developer's machine, so the skills have no way to reach it.
`.scratch/` was already in use before this file existed (`iot-tab`, `iot-phase2`, `iot-phase3`),
so local markdown is what the repo actually does. Switch by installing `gh` and rewriting this
file — nothing else depends on the choice.

`.scratch/` is **gitignored**. Tickets are working state for one effort, not repo history; what
survives an effort is the code, the `docs/feature/` guide, and the ADR.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Blocking edges are a `Blocked by: NN, NN` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

Triage state is **not** recorded: the `triage` skill is not installed, so there is no label
vocabulary and `docs/agents/triage-labels.md` does not exist. Every ticket `/to-tickets`
produces is agent-ready by construction.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The developer will normally pass the path or the issue
number directly.

## Wayfinding operations

Used by `/wayfinder`, which reads this section to learn where a map and its child tickets physically live in this repo.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
