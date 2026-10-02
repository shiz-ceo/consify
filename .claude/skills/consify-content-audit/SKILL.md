---
name: consify-content-audit
description: Check whether existing documentation has fallen out of date against the code it describes — a mentioned function/option that no longer exists, or a source file that changed more recently than the page documenting it. Use only when explicitly asked ("check if the docs are stale", "audit the docs"), never on its own as part of an unrelated task.
---

# consify-content-audit

This is a heuristic assistant, not a certainty machine: it surfaces **candidates** worth a human
look, using signals from the code and git history. It never rewrites a page on its own — every
finding goes in a report for the user or the writing skill to act on.

Run only when asked. Do not fold this into "write docs for X" or any other task uninvited — an audit
touches the whole site and can be slow on a large one; let the user choose when to pay that cost.

## What it checks

### 1. Mentioned identifiers that no longer exist

- Scan the pages in scope (the whole site, or a folder/section the user named) for identifiers in
  backticks or code blocks that look like an API surface: `functionName()`, `ClassName`,
  `optionName`, a config key path like `theme.preset`.
- For each one that looks like it belongs to the project's own code (not a generic word, not a
  third-party name), check it still exists: grep the source, or check the config schema
  (`node_modules/@consify/core`, `config/schema`) for a config option, and the options of the
  feature factories (`docs()`, `blog()`, `apiReference()`) for theirs.
- A page whose title or immediate context makes it clearly about that exact function/option and the
  identifier is gone is a strong candidate. A passing mention (a comparison, an aside) is weaker —
  say so in the report rather than treating both the same.

### 2. Pages older than the code they describe

- Find each page's last edit: `git log -1 --format=%ai -- <page path>`.
- Figure out which source file(s) the page is actually about — from an explicit source link on the
  page (a "source" or "Edit on GitHub" reference), from the identifiers found in step 1, or from the
  page's own path convention (a reference page named after a module usually documents that module —
  confirm, do not assume).
- For each source file found, check whether it changed after the page's last edit:
  `git log --since=<page's last edit date> --oneline -- <source file>`.
- A source file with commits since the page's last edit is a candidate for "the docs might be behind
  the code" — not proof. Look at what actually changed (`git log -p` on the relevant commits) before
  claiming the page is wrong; a formatting-only or comment-only change to the source is not a reason
  to flag the page.

### 3. Broken structure (cheap, always worth including)

Run the existing check for free, it catches a different (but related) class of problem:

```bash
bunx consify check
```

When the docs use `anchors`, it also tells a heading with no English id, an id that is not in
`anchors.json`, a registry id that no page has any more (a heading was removed or renamed: links to it
are lost, worth a human look) and a link to an id that does not exist. `consify anchors check` is that
part alone. When the docs use `snippets`, it also tells a `<Snippet>` with no file and a snippet file
no page uses.

### 4. The same code in several places

A code block copied onto several pages (or into every translation) falls out of date one copy at a
time. List them:

```bash
bunx consify snippets find            # --min-lines 5 for the longer ones
```

Report the repeated blocks with their places, and suggest making each one a snippet (the command
prints the file and the `<Snippet>` tag); if the docs do not have `snippets` on, say that it is one
option in `docs()`. Do not move anything yourself: the audit only reports.

## Report

One list, ranked by confidence, not by anything else:

- **File, and what's suspect** (an identifier, or "possibly stale relative to `<source file>`").
- **Why** — the specific grep result or git log line that triggered it, not just "seems off".
- **Confidence**: high (the identifier is definitely gone / the source change is clearly behavioral)
  or low (a plausible but unconfirmed signal — worth a look, not a guarantee).

Do not edit any page as part of this skill. If the user wants fixes made, that is
**consify-docs-authoring**'s (or the relevant section skill's) job, working from this report.
