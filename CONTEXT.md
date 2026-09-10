# CONTEXT

> ⚠️ **This is not the glossary.** Skills that say "read `CONTEXT.md` for the project's
> vocabulary" (`domain-modeling`, `tdd`, `diagnosing-bugs`, `to-spec`) want **`docs/glossary.md`**
> in this repo. See `docs/agents/domain.md`.

_Staging buffer for in-flight design decisions (grill-with-docs). Once a
decision is implemented, promote it into its domain guide under `docs/feature/`
(the single source of truth for **how** the thing works) and — when the
alternatives rejected are worth preserving — into an ADR under `docs/adr/`
(the record of **why**). Then clear it from here; this file is never the
permanent record. See `docs/adr/README.md` for the promotion flow._

---

**Empty as of 2026-09-10.** Nothing is in flight. Everything staged from PRs #21/22 through #44 has
been promoted, and the receipt tables went with it — the guides and ADRs are the record now.

Last promoted: ADR-0032…0037 (section-plane `requireNormal`, FX suppression, IFCSpace visibility,
Realistic gloss/AO, viewport fullscreen, IoT chips), plus the two open viewer defects **VW-04** and
**VW-02**, which had no decision to record and now live as gotchas in
[`docs/feature/bim-viewer.md`](docs/feature/bim-viewer.md).

⚠️ **Lesson from that pass, worth keeping at the top of an empty file.** Five entries sat here for
months still saying "untested" or "nothing implemented yet" long after the code had merged. Re-read
against the shipped code, one of them had grown a second failure mode nobody had written down.
**Promote on merge, not eventually** — a staging buffer that accumulates is just a worse changelog.

The next `/grill-with-docs` session starts writing below this line.
