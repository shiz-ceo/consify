# Content: core reads it, the feature draws it

Only for a feature with MDX files of its own, the way the docs and the blog have them. A feature fed
by something else (the API reference reads an OpenAPI file with `readFile`) skips this.

## Where the files are

`content/<language>/<folder>/` (`folder` defaults to the feature's `id`). A file without a
translation is the default language's: `entry.fallback` is `true` and the page says so; with
`i18n.fallback: "hide"` it does not exist in that language.

## `content`

```ts
import { z } from "zod";

content: {
  schema: z.object({ title: z.string(), date: z.coerce.date(), draft: z.boolean().default(false) }),
  filter: (entry) => !entry.data.draft,
  sort: (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  tree: false,  // a sidebar from folders and meta.json: entry.tree, for Fumadocs' useFumadocsLoader
  search: true, // default: the site's search dialog searches the entries (/{lang}/<id>/search.json)
  llms: false,  // /{lang}/<id>/llms.txt and llms-full.txt, and the link `<id>:llms`
  og: false,    // a social image per entry: /{lang}/<id>/og/<slug>.png
},
```

- `schema` checks every front matter; a wrong one stops the build and `consify check` with the file
  named. Anything with `safeParse` works; a zod schema is the usual choice. Build it from the options
  when it depends on them (the blog's `postSchema(categories, authors)` refuses unknown ids).
- `filter` leaves entries out everywhere: pages, lists, search, feeds, sitemap. The blog hides
  drafts and future posts here.
- `sort` orders `content.entries()`. Default: by path.

## Entry pages: a page per file

```tsx
pages: {
  "/": page({ load: ({ content }) => content.entries(), component: List }),
  "/*": { entry: true, component: ({ data }) => <Mdx code={data.code} /> },
}
```

With `entry: true` the address names the entry (`"/*"` for nested paths, `"/:slug"` for flat ones).
Core lists the addresses (no `paths` needed), answers 404 for an unknown slug, and fills `<head>`:
title, description, alternates, the canonical address of an untranslated copy, the social image.

`data` is the `EntryPage`: `slug`, `url`, `path`, `lang`, `fallback`, `data` (the front matter),
`readingTime`, `code` (for `<Mdx code />` from `@consify/core`), `toc`, `alternates`, `original`,
and `tree` with `tree: true`.

When the page needs more than the entry, add `load`: it gets the entry as `context.entry` and
returns what the component gets.

```ts
"/:slug": page({
  entry: true,
  load: async ({ entry, content }) => ({ ...entry, related: pick(entry, await content.entries()) }),
  meta: ({ data }) => ({ head: [{ property: "og:type", content: "article" }] }),
  component: PostPage,
}),
```

## Reading content in `load`

`context.content`, in the language of the page, with the same fallback:

| Call | Returns |
| --- | --- |
| `entries()` | Every entry, checked, filtered, sorted: `{ slug, url, path, lang, fallback, data, readingTime }[]` |
| `entry(slug)` | One `EntryPage`, or `undefined` |
| `list(dir?)` | Every file under `dir`: `{ path, slug, lang, fallback }[]` |
| `read(path)`, `json(path)` | Text / parsed JSON of a file |
| `frontmatter(path)` | Front matter without compiling |
| `mdx(path)` | A compiled file: `frontmatter`, `code`, `toc`, `text`, `languages` |
| `in(lang)` | The same content in another language |

Paths are relative to the feature's folder. `root` is its absolute path.

## Checklist

- [ ] `schema` covers every front matter field a page reads.
- [ ] Everything that must not be published is removed by `filter`, not hidden in the UI.
- [ ] Entry pages use `entry: true`; no hand-written `paths` or 404 for them.
- [ ] The list page reads `content.entries()`, never the file system.
- [ ] Tests write fixture files to a temp folder (`content/en/<id>/…`) and check `siteAddresses`,
      a `load` via `createLoadContext`, and that a second instance reads its own folder.
