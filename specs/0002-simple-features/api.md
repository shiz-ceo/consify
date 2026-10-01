# The API after 0002 (reference for docs and skills)

## `docs.config.ts`

```ts
import { apiReference } from "@consify/api-reference";
import { blog } from "@consify/blog";
import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";
import { status } from "./custom/features/status.tsx";

export default defineConfig({
  site: { name, description, url, logo, favicon, github: { repo, branch } },
  i18n: { defaultLanguage, languages, fallback: "notice" | "show" | "hide", labels, messages },
  theme: { preset, brand, colors, radius, fonts },
  head, banner, header: { links }, footer, deploy: { mode, basePath },
  slots: { header, headerEnd, footer },          // React components (also custom/header.tsx, custom/footer.tsx)
  features: [docs(), blog(), apiReference({ input: "./openapi.json" }), status],
  mdx: {
    math: true,                                   // KaTeX
    twoslash: true | false | { compilerOptions, cache },
    components: { Name: Component },              // MDX components by name (custom/components/*.tsx too)
    plugins: [definePlugin({ name, remark, rehype, shiki, components, messages })],
  },
});
```

Gone: `extensions` (now `features`), top-level `plugins`, `components`, `twoslash`, the
`features: { search, math, twoslash }` switches (now `mdx`; search is on for every feature with
content), the `home` object, `slots.home`, `custom/home.tsx`, deprecations.

## The front page

`content/<language>/home.mdx` (MDX with `<Hero title description actions />` and
`<Features items />`), else `/{lang}` redirects to the first feature with a title. A feature with
`path: ""` replaces it (a React front page).

## `defineFeature`: one function, one file

```tsx
import { defineFeature, page } from "@consify/core";

export const status = defineFeature({
  id: "status",                                  // address /{lang}/status, link id, content folder
  path: "status",                                // optional: another address, "" = the front page
  folder: "status",                              // optional: another content folder
  title: { en: "Status", ru: "Статус" },         // header link + page titles; or ({ lang, t }) => t("key")
  description: { en: "…", ru: "…" },             // drop-down menus
  messages: { en: { up: "Up" }, ru: { up: "Работает" } },   // t("up")
  pages: {
    "/": ({ lang, t, params }) => <main>…</main>,          // a component is a page
    "/:service": page({                                     // page() types `data` from `load`
      paths: () => [{ service: "api" }],                    // parameters to pre-render (static sites need it)
      load: ({ params, lang, t, content, readFile, config, request, url, notFound, redirect }) => data,
      title: ({ data }) => data.name,                       // or meta: ({ data }) => ({ title, description, image, alternates, canonical, head })
      layout: "site" | "sidebar" | "none",                  // header+footer (default) / + panel button / nothing
      component: ({ data, lang, t, params }) => <h1>{data.name}</h1>,
    }),
    "/old": { redirect: ({ lang }) => `/${lang}/status` },
  },
  files: {
    "/status.json": () => ({ services }),        // JSON, text, bytes or a Response; type from the extension
  },
  links: ({ lang, t }) => [{ id: "status:json", title: "JSON", url: `/${lang}/status/status.json` }],
  components: { Badge },                         // MDX components for every .mdx
  search: { useSearch, open },                   // only for a search of its own
  content: { … },                                // see below
});
```

- `load` runs on the server; the component gets its result as `data`.
- `t(key, { name })` fills `{name}`; strings: English is the reference, `custom/locales/<lang>.ts`
  and `i18n.messages` override.
- `<Mdx code={…} />` (from `@consify/core`) shows compiled MDX.
- Test a load function with `createLoadContext({ config, feature, lang, params, cwd })` from
  `@consify/core/node`.

## Content: core reads it, the feature only draws it

```ts
content: {
  schema: z.object({ title: z.string(), date: z.coerce.date() }),   // checks every front matter, names the file
  filter: (entry) => !entry.data.draft,
  sort: (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  tree: true,     // a sidebar from folders and meta.json (entry.tree, for Fumadocs useFumadocsLoader)
  search: true,   // default: the search dialog searches the entries (/{lang}/<id>/search.json)
  llms: true,     // /{lang}/<id>/llms.txt and llms-full.txt, and the link `<id>:llms`
  og: true,       // a social image per entry: /{lang}/<id>/og/<slug>.png
}
pages: {
  "/": page({ load: ({ content }) => content.entries(), component: List }),
  "/*": { entry: true, component: ({ data }) => <Mdx code={data.code} /> },   // a page per file
}
```

- Files: `content/<language>/<folder>/`. A file without a translation is the default language's
  (`entry.fallback`, with `i18n.fallback: "hide"` it does not exist there).
- `content.entries()` → `{ slug, url, path, lang, fallback, data, readingTime }[]`.
- `entry: true`: the address names the entry (`/*` or `/:slug`); core lists the addresses, answers
  404, fills `<head>` (title, description, alternates, canonical of a copy, social image). `data`
  is the entry: `{ …, code, toc, alternates, original, tree? }`. With `load`, `load` gets it as
  `entry` and returns what the component gets.
- Low level: `content.list(dir)`, `read(path)`, `json(path)`, `frontmatter(path)`, `mdx(path)`,
  `in(lang)`.

## Packages of features (`@consify/docs`, `@consify/blog`, yours)

- `index.ts` exports a factory that returns `defineFeature(...)`; it must stay loadable by Node
  (no JSX, no CSS, no `@consify/core/ui`): pages are `lazy(() => import("./page.tsx"))`, MDX
  components `lazyComponents(() => import("./mdx.tsx"), ["A", "B"])`.
- Server-only code: `import.meta.env.SSR ? import("./server.ts") : …`.
- `@consify/core/ui`: `SitePage`, `docsLayoutOptions`, `Footer`, `FallbackNotice`, `SearchField`,
  `SiteLink`, `useMessages`, `useSidebarCollapsed`, `consify` (was `@consify/core/routes`).
- `package.json` `"consify": { "prebundle": [...] }`: browser dependencies Vite pre-bundles.
- Skills: `skills/<name>/SKILL.md` at the package root.
- Several instances: `docs({ id: "guides", title: "Guides" })` is just another feature.

## The three features

- `docs({ id = "docs", title, versions: { list, default }, toc, breadcrumbs, pagination, llmsTxt, og, editOnGithub })`:
  pages `/{lang}/docs/...`; search `/{lang}/docs/search.json`; `/{lang}/docs/llms.txt`;
  social images `/{lang}/docs/og/<slug>.png`; a versioned section redirects `/{lang}/docs` to the default version.
- `blog({ id = "blog", title, description, perPage, categories, authors, share, rss })`: list
  `/{lang}/blog`, posts `/{lang}/blog/<slug>`, `/{lang}/blog/rss.xml`, social images
  `/{lang}/blog/og/<slug>.png`, search; drafts and future posts hidden (`CONSIFY_DRAFTS=1` shows them).
- `apiReference({ input, title = "API", id = "api" })`: `/{lang}/api` (link id `api`, was `api-reference`).

## CLI

- `consify check [--strict]` (was `consify docs check`): addresses of every feature, front matter,
  translations (same code blocks, links, headings), meta.json.
- `consify skill sync|list`: skills of the `@consify/*` packages the project depends on and
  `custom/skills/<name>/SKILL.md`.
- `consify add`: a `skill` item goes to `custom/skills/<name>/`; a `feature` item prints the line
  for `features: [...]`.
- `consify links`, `consify lang add|status`, `consify locale`, `consify doctor`, `consify deploy`
  unchanged in use.

## Project layout

```
docs.config.ts  vite.config.ts  react-router.config.ts
content/<language>/            home.mdx, docs/, blog/, <feature>/
custom/components/*.tsx        MDX components by file name
custom/features/*.tsx          your features (one file each is enough)
custom/header.tsx, footer.tsx  replace parts of the site
custom/locales/<lang>.ts       interface strings
custom/skills/<name>/SKILL.md  skills of the project
custom/theme.css
```
