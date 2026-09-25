# Content structure

The skill proposes the structure; the user approves it before any page is written.

## A structure that works for most products

```
content/docs/<version>/
├─ meta.json                 "root": "version", the order of the pages
├─ index.mdx                 introduction: what it is, who it is for
├─ quickstart.mdx            from zero to a working result
├─ concepts/                 ideas and how it works (explanation)
├─ guides/                   how to do X (by task)
├─ reference/                exact facts: API, CLI, configuration
├─ migration.mdx             moving between versions
└─ troubleshooting.mdx       common problems
```

Take only the parts the product needs. One section answers one kind of question; do not mix an
explanation into a reference or a table of options into a concept page.

Without versions, put the pages directly in `content/docs` and skip the version folder.

## Files and names

- A page is `<name>.mdx`; a folder is a section and has an `index.mdx`.
- Names are lowercase words joined with hyphens, short, without the version in them.
- Keep nesting to two levels below the version.
- A translation sits next to the original: `<name>.<language>.mdx`.

## `meta.json`

```json
{
  "title": "Guides",
  "icon": "Compass",
  "pages": ["index", "first-steps", "---Advanced---", "caching", "..."]
}
```

- `pages` sets the order. `"---Text---"` draws a separator. `"..."` stands for all other pages.
- A new page is added to the `pages` of its folder's `meta.json` **and** to every
  `meta.<language>.json`.
- `icon` is the name of a [Lucide](https://lucide.dev/icons) icon. Put icons on top-level pages and
  folders, not on every page.
- `"root": "version"` belongs only to the top folder of a version.

## Page front matter

```yaml
---
title: Caching              # required
description: "Keep answers for a while: how long and where"   # required; quote it if it has ": " or " #"
icon: Database              # optional
full: false                 # optional, use the full width
---
```

## Languages

- The main language is `i18n.defaultLanguage`. Every other language is a sibling file.
- To add a language: add it to `i18n.languages`, name it in `i18n.labels`, create the translated files
  and `meta.<language>.json` files (gradually if the user agreed), and override interface strings in
  `i18n.messages` if the built-in ones are missing for that language.
- Details of translating: [translation.md](translation.md).

## Versions

**When to create a version.** Only when a version of the product with breaking changes must be
documented in parallel. Minor releases edit the current version.

**How to create one:**

1. Copy the folder of the latest version: `cp -r content/docs/v1 content/docs/v2`.
2. In `content/docs/v2/meta.json` set the new `title` and keep `"root": "version"`.
3. Add it to `versions.list` with `status: "latest"` and change the previous one to `stable` or
   `deprecated`. Set `default` if the version that `/docs` opens should differ from the latest.
4. Put the new version first in `content/docs/meta.json`: `{ "pages": ["v2", "v1"] }`.
5. Update the pages that changed since the previous version (from the code), the migration page and
   the overview.
6. Copy the translation files as well; they live in the same folders.

**Living with versions:**

- Old versions get fixes only. A `deprecated` version shows a banner that points to the latest one.
- Versions and languages combine: `v1/guide.ru.mdx` is the Russian page of version 1.
- The switcher keeps the reader on the same page when it exists in both versions.
- Links between pages of one version are relative (`./other.mdx`) or `/docs/<version>/...`.
- **The user decides** version names, which one is latest and which are deprecated. Ask.
