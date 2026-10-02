---
name: consify-docs-authoring
description: Write and maintain the documentation pages of a project that uses consify's docs() feature — page structure, meta.json, versions, front matter, reference pages from TSDoc. Use when asked to document a project or a part of it, add or restructure docs pages, add a version, or fix docs structure problems. For the interview, translation and verification steps this defers to the consify skill; use that one alongside this one, not instead of it.
---

# consify-docs-authoring

Writes MDX pages under `content/<language>/docs/<version>/` (another section,
`docs({ id: "guides" })`, lives in `content/<language>/guides/`; everything below applies to it). For the parts that are not specific to
docs pages — the interview, translation rules, extending the site, final verification — use the
**consify** skill; this one only covers what is specific to a docs page: structure, `meta.json`,
versions, and which template fits which kind of page.

## Two ways this gets used

**From scratch (bootstrap):** no content yet, or a full rewrite. Run the interview (via **consify**)
first, then propose the whole structure ([references/content-structure.md](references/content-structure.md)) before writing a single page.

**One thing at a time (incremental):** "document the payments module", "add a guide for X". Read the
relevant code and its TSDoc, sketch a short plan — the pages this needs plus one line each — show it
and wait for a "yes" before writing. If the topic would be better served by a capability the project
does not have (a new version, a section that does not exist, a component), say so and ask before
either adding it or working around its absence.

## Workflow

1. Know the scope (bootstrap or incremental) and the audience — from the interview, or ask if this is
   a narrow request with no prior context.
2. Read the code and TSDoc for the facts. Do not invent an API surface, a default, or behavior you
   have not confirmed in the source or a test.
3. Propose the page tree and `meta.json` changes ([content-structure.md](references/content-structure.md)); get approval before writing.
4. Write each page with the template that fits it ([page-templates.md](references/page-templates.md)).
5. Update every language folder's `meta.json` for the new pages (see the **consify** skill's
   translation reference for the actual translation).
6. Hand back to **consify** for verification (`bun run build`, `typecheck`, `bunx consify check`, a look with `bun run dev`) and the final report.

## Heading ids

If the project has `anchors` on in `docs()` (look in `docs.config.ts` for `anchors`, or for an
`anchors.json` in the folder of a version), the address of a heading is an id that is written:

- Every heading gets `[#english-id]` at the end of its line: `## Quick path [#quick-start]` (not
  `{#…}`: MDX reads that as an expression). The id is short, lowercase English words and digits joined
  by `-` or `.` (`quick-start`, `model.find`). It is made from the **English** title, in every language.
- A heading whose own id is already such a word (`## Requirements` → `requirements`, or a heading
  in code, `` ## `client.start` `` → `clientstart`) needs no mark.
- An id is a public address: **never change an id that exists**. Rewording a heading keeps its id;
  removing a heading loses the links to it (the check warns).
- The ids are listed in `anchors.json` in the folder of the version, of the original language. After
  you add a heading, run `consify anchors sync`; a new id in the diff of that file is intended. Link to
  a heading as `[text](./page.mdx#id)` or `[text](#id)`: the check refuses a link to an id that is
  not in the file.
- `consify anchors add` writes the ids a page lacks (and fixes the links to them), `--dry-run` shows
  first. Look at the ids it made and improve them. `consify check` and `bun run build` stop on a
  heading with no id, an unknown id and a broken link to a heading.

## Snippets

If the project has `snippets` on in `docs()` (look in `docs.config.ts`, or for a `snippets/` folder
next to `content/`), code or text that is the same on several pages, or in every language, lives in
one file and the pages put it in place:

- The file is `snippets/<version>/<id>.<ext>` (`snippets/WITHOUT_VERSION/` for a page with no
  version); the id is its path inside the folder of the version without the extension, never with the
  version or the language: `<Snippet id="db/connect" />`. It is a block on a line of its own.
- A code file (`.ts`, `.sh`, `.json`…) is a code block. Its props are the meta of a fenced block:
  `title="db.ts"`, `highlight="2,4-5"`, `lineNumbers`, `twoslash`, `noCopy`, `lang="…"`,
  `meta="…"`; `id="db/connect#open"` shows the lines between `// #region open` and `// #endregion`.
  The notations in its comments (`// [!code highlight]`, `// [!code ++]`, `// ---cut---`) work.
- An `.mdx` file is text with components; it has **no headings** (write the heading on the page and
  put the snippet under it), no front matter, no `export`. Its `import` lines go to the page.
- A variant for a language is `snippets/<version>/<lang>/<id>.<ext>`: for a code snippet only its
  comments differ. A page reads its language's variant, then the common file, then the variant of the
  default language; `version="v1"` reads another version.
- Before you copy a code block to a second page, make it a snippet. `consify snippets find` lists the
  blocks that are already repeated (with a file and a tag for each). `consify check` and the build stop
  on a snippet that is not there, a missing region, a loop or a heading in a snippet.

## Terms

Pick one word for each concept and use it everywhere. Collect the terms from the code and the
interview; keep the list consistent across pages and languages. Offer to save it as
`DOCS-GLOSSARY.md` in the project root when the list is long (ask first).
