---
name: consify-translate
description: Translate a page, a post, or a whole consify site into another language, with a glossary that persists across separate requests. Use when asked to translate something, add a language, or check what is left to translate. Applies to any content — docs pages, blog posts, the front page (home.mdx), any feature's content folder — regardless of which skill wrote it originally.
---

# consify-translate

Translation is its own job, separate from writing the original: same structure, different meaning,
a fixed glossary. This skill owns the glossary file across requests, so the second time someone
asks to translate something you are not starting from zero.

## First, always

1. **Load the glossary**, if the project has one: `DOCS-GLOSSARY.md` at the project root (or wherever
   the project's own docs say it lives — check `CONTRIBUTING.md`/`README.md` if unsure). Use its
   terms as-is; do not re-ask about a term it already answers.
2. **Know the languages.** `i18n.defaultLanguage` and `i18n.languages` in `docs.config.ts` are the
   source of truth — never assume. For a language not yet in `i18n.languages`:
   ```bash
   consify lang add <language> [--copy]   # --copy seeds it from the main language's pages
   ```
   then add the code to `i18n.languages` (and `i18n.labels`) in `docs.config.ts`.
3. **Know what is missing**, for "translate what's left" requests:
   ```bash
   consify lang status                       # a table, per language and section
   consify lang status <language> --missing  # the exact files
   ```

## Rules

- A translation is a file with the same path in the folder of its language:
  `content/en/docs/v1/guide.mdx` becomes `content/ru/docs/v1/guide.mdx`. Slugs are not translated.
  The `meta.json` of a language folder translates titles and the text of separators, nothing else.
- The structure is identical in every language: the same headings in the same order, the same
  blocks, the same blank lines. Convey the meaning; do not translate word by word.
- A missing translation does not break the site (the main language is shown as a fallback via
  `i18n.fallback`), but it must be named in the report — never leave it unsaid.

## What is translated

- `title`, `description`, prose, headings, lists, table cells, link text.
- Visible strings in component props: `title=`, `description=`, `label=`, `note=`, and the
  `description` values in a `TypeTable`.
- In the `meta.json` of a language folder: `title` and the text of separators.

## What stays unchanged

- Everything inside code blocks (including comments and sample strings) and inline code —
  `consify check` compares code blocks between languages **byte for byte** and fails if they
  differ. Do not translate a shell comment inside a fence even if it reads oddly in
  the target language.
- Paths, URLs, link targets (`/docs/<version>/...`), component and prop names, identifiers, commands.
- Mermaid source, formulas, code fence info (`title="..."`, `{2,4-5}`, `tab="..."`, `twoslash`).
- `date`, `categories`, `tags`, `authors`, `cover`, `icon`.
- The `value` of every `<Tab>` and the `items` of `Tabs` (they must match each other).
- Names of products and of the user's own API.

## The glossary

- **First request in a project with no glossary yet:** propose one once you have 3+ terms worth
  fixing, show the list, ask before creating `DOCS-GLOSSARY.md`.
- **Every request after that:** read the file first, before translating anything. Add a new term to
  it as you settle on a translation for it — do not wait until the end, and do not ask again for a
  term already in the file.
- One term, one translation, used everywhere. If the user's answer for a term this time
  contradicts what is already in the glossary, point out the conflict and ask which one is right —
  do not silently pick one.
- Format: a Markdown table, one row per term — `| Term | <language> | Notes |` — so it stays a plain
  diffable file, not a database.

## YAML

A translated `title` or `description` that contains `: ` or ` #`, or starts with a special
character, must be in double quotes. A YAML error stops the whole build.

## Interface strings

consify and every feature ship interface strings (English and Russian are built in). For a language
without them each missing key falls back to English; `consify locale <language>` writes a full pack
(`custom/locales/<language>.ts`, core and feature strings) to fill in, or override single strings
with `i18n.messages`. Localized options in `docs.config.ts` (`title: { en, ru }` of a feature,
`banner.text`, footer titles) are translated there.

## Verify and report

```bash
bunx consify check --strict
consify lang status
```

Report which pages were translated, which are still missing (by design or by omission — say which),
and any term you added to the glossary or a conflict you flagged.
