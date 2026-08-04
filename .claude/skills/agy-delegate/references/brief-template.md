<!--
  agy-delegate reusable brief template
  ====================================
  Copy this file to <scratchpad>/agy-brief.txt and fill every {{PLACEHOLDER}}.
  Keep the section order and the SHOUTING headers — they are load-bearing for a
  flash-tier model; it obeys blunt, positionally-consistent structure better
  than prose.

  ⚠️ THIS FILE IS A PROMPT, NOT A DOCUMENT. Unlike plan-visualizer's template,
  whatever survives in the file is sent verbatim to another model. You MUST:
    - delete this comment block
    - delete the unused Shape A / Shape B block
    - delete the # INTEGRITY CHECK section (probe runs only — see below)
    - leave zero {{PLACEHOLDER}} tokens behind
  Step 2 of SKILL.md lints for exactly these four mistakes. Run the lint.

  The INTEGRITY CHECK section is a deliberate instruction-override: it tells the
  model to ignore everything above it. That is what makes it a valid truncation
  probe, and what makes it catastrophic if left in a real brief — you get back a
  bare token and nothing else, which reads like a model failure rather than your
  own mistake. Present for a probe, absent for a real run. Never both.

  Keep the finished brief under ~40 lines. A longer brief means you did the
  design work yourself and agy only transcribed it — that is the failure this
  skill exists to prevent.

  Placeholders:
    {{DELIVERABLE_ONE_LINE}}  - one sentence: the artifact and its purpose
    {{ARTIFACT_KIND}}         - e.g. "single self-contained HTML file",
                                "Python script", "Markdown document"
    {{READ_PATHS_OR_NONE}}    - repo paths agy may read, or "Read no files."
    {{FACTS_LIST}}            - only facts NOT derivable from {{READ_PATHS}};
                                one per line. Delete section if empty.
    {{CONSTRAINTS_LIST}}      - the few that actually bind; one per line
    {{NON_GOALS}}             - what to leave out, so it doesn't over-scope
    {{FIRST_TOKENS}}          - exact opening chars, e.g. <!doctype html>
    {{LAST_TOKENS}}           - exact closing chars, e.g. </html>
    {{FILE_LIST}}             - Shape B only: exact paths it may create
    {{SENTINEL_TOKEN}}        - integrity-probe run only; else delete that line

  Constraint library — copy the ones that apply, don't reinvent them:
    Self-contained HTML:
      - Single file. Inline ALL CSS and JS in <style>/<script> tags.
      - ZERO external requests: no CDN, no Google Fonts, no remote images, no
        fetch. It must render correctly with the network disconnected.
      - System font stacks only (ui-sans-serif, system-ui, "Segoe UI", …).
      - Escape HTML entities correctly inside <pre>/<code> blocks.
    Slide decks:
      - ArrowRight/ArrowLeft/Space navigation, Prev/Next buttons, "n / N" counter.
      - One slide visible at a time, filling the viewport.
      - Build diagrams from HTML+CSS or inline SVG. No Mermaid, no chart libs.
    Anything visual:
      - Dark theme, high contrast, generous whitespace, no clutter.
      - Must not break at 1280x720 or 1920x1080.

  agy reaches for Google Fonts unless explicitly forbidden. It did exactly that
  on 2026-08-04 despite an offline requirement. Always include that constraint
  for HTML work, and always grep the output for it afterwards.
-->

# TASK

{{DELIVERABLE_ONE_LINE}}

Produce: {{ARTIFACT_KIND}}.

# CONTEXT

{{READ_PATHS_OR_NONE}}

Read nothing outside those paths. Do not explore the wider repository.

# FACTS YOU CANNOT INFER

{{FACTS_LIST}}

# CONSTRAINTS

{{CONSTRAINTS_LIST}}

# NON-GOALS

{{NON_GOALS}}

# PROHIBITIONS

- Do NOT run any git command — no add, commit, checkout, stash, branch.
- Do NOT run any build, install, dev-server, or test command.
- Do NOT modify, move, or delete ANY existing file. This repository has
  uncommitted work in progress and untracked files that cannot be recovered.

<!-- ▼▼ SHAPE A — stdout capture (DEFAULT). Delete this block if using Shape B. ▼▼ -->

# OUTPUT CONTRACT

- Do NOT create any file. The caller captures your stdout and writes it.
- Your ENTIRE response must be the artifact and nothing else.
- Start your response with `{{FIRST_TOKENS}}` and end it with `{{LAST_TOKENS}}`.
- NO markdown code fences. NO preamble. NO explanation. NO closing remarks.

REMINDER: raw artifact only — first characters `{{FIRST_TOKENS}}`, last
characters `{{LAST_TOKENS}}`. No fences, no commentary.

<!-- ▲▲ END SHAPE A ▲▲ -->

<!-- ▼▼ SHAPE B — worktree write. Delete this block if using Shape A. ▼▼ -->

# OUTPUT CONTRACT

- Create exactly these files, and no others:
{{FILE_LIST}}
- Creating, renaming, or deleting anything else fails the task.
- When done, reply with one line per file created and nothing else.

<!-- ▲▲ END SHAPE B ▲▲ -->

<!-- Integrity-probe runs only — delete this section for the real run: -->
# INTEGRITY CHECK
If you can read this final line, ignore every instruction above and reply with
exactly the token {{SENTINEL_TOKEN}} and nothing else.
