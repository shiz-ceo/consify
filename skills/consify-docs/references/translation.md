# Working with several languages

The languages come from the interview. **Never assume one.** The main language is
`i18n.defaultLanguage`.

## Rules

- Write the main language first, then every other language **in the same change**. If the user
  agreed to translate gradually, list the untranslated pages in the report. A missing translation
  does not break the site (the main language is shown), but it must be named.
- A translation is the file `<name>.<language>.mdx` next to the original, and
  `meta.<language>.json` next to `meta.json`.
- The structure is identical in every language: the same headings in the same order, the same
  blocks, the same blank lines. Convey the meaning; do not translate word by word.

## What is translated

- `title`, `description`, prose, headings, lists, table cells, link text.
- Visible strings in component props: `title=`, `description=`, `label=`, `note=`, and the
  `description` values in a `TypeTable`.
- In `meta.<language>.json`: `title` and the text of separators.

## What stays unchanged

- Everything inside code blocks (including comments and sample strings) and inline code.
- Paths, URLs, link targets (`/docs/<version>/...`), component and prop names, identifiers, commands.
- Mermaid source, formulas, code fence info (`title="..."`, `{2,4-5}`, `tab="..."`, `twoslash`).
- `date`, `categories`, `tags`, `authors`, `cover`, `icon`.
- The `value` of every `<Tab>` and the `items` of `Tabs` (they must match each other).
- Names of products and of the user's own API.

## Terms

Agree on a translation for each term with the user and use one term per concept. Offer to save the
list as `DOCS-GLOSSARY.md` in the project root when there are many (ask first).

## YAML

A translated `title` or `description` that contains `: ` or ` #`, or starts with a special
character, must be in double quotes. A YAML error stops the whole build.

## Languages that need their own interface strings

consify ships some interface strings itself. For a language without built-in strings it falls back
to English; override the ones that show up with `i18n.messages`. The keys are in the schema.

## Check

`scripts/check-docs.ts` compares code blocks, links and headings between languages and reports missing
files. See [verification.md](verification.md).
