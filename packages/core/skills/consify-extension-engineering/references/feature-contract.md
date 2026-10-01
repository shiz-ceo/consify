# `defineFeature`

Everything a feature can do. `defineFeature`, `page`, `lazyComponents`, `Mdx` and the types
(`PageProps`, `LoadContext`, `Entry`, `EntryPage`, `LinkOption`, `FeatureSearch`, …) come from
`@consify/core`. The types in `node_modules/@consify/core/src/feature/types.ts` (or the published
`.d.ts`) are the source of truth; when they disagree with this page, they win.

```ts
defineFeature({
  id: "status",                      // /{lang}/status, content/<language>/status/, link id "status"
  path: "status",                    // optional: another address; "" = the front page /{lang}
  folder: "status",                  // optional: another content folder
  title: { en: "Status", ru: "Статус" },
  description: { en: "…", ru: "…" },
  messages: { en: { up: "Up" }, ru: { up: "Работает" } },
  pages: { "/": List, "/:service": page({ … }), "/old": { redirect: … } },
  files: { "/status.json": () => ({ … }) },
  content: { … },                    // see content.md
  links: ({ lang, t, config }) => [ … ],
  components: { Badge },
  search: { useSearch, open },
});
```

## `id`, `path`, `folder`

- `id`: lowercase letters, digits and `-`, starting with a letter. Two features with the same id
  stop the config (`duplicate feature "api"`).
- `path` defaults to `id`. `path: ""` makes the feature the front page of every language (it
  replaces `content/<language>/home.mdx`).
- `folder` defaults to `id`: `content/<language>/<folder>/`.

In a package, take `id` as an option with a default and derive everything from it.

## `title`, `description`

`Localized` text (`"API"` or `{ en, ru }`) or `({ lang, t }) => string`. `title` is the header link
and the default `<title>` of the pages; without it the feature offers no link. `description` shows
in drop-down menus.

## `messages` and `t`

Strings per language; English is the reference, other languages fall back to it. The project
overrides them with `custom/locales/<lang>.ts` or `i18n.messages`. `t(key, { name })` fills
`{name}`. `t` is passed to pages, `load`, `title`, `links`; inside other components use
`useMessages<MyMessages>()` from `@consify/core/ui`. Type the keys with
`MessagesOf<typeof myMessages>`.

## `pages`

Keys are addresses relative to the feature: `"/"`, `"/:slug"`, `"/*"`, start with `/`, no trailing
`/`. A value is one of:

- **a component** (a function, or `lazy(() => import("./page.tsx"))`): gets `{ lang, t, params }`;
- **`page({...})`**, which types `data` from `load`:

  ```tsx
  "/:service": page({
    paths: () => services.map((s) => ({ service: s.id })),       // addresses to pre-render
    load: ({ params, notFound }) => services.find((s) => s.id === params.service) ?? notFound(),
    title: ({ data }) => data.name,                                  // or description, or meta
    layout: "site",                                                  // "site" | "sidebar" | "none"
    component: ({ data, lang, t, params }) => <h1>{data.name}</h1>,
  })
  ```

- **a redirect**: `{ redirect: ({ lang, config }) => \`/${lang}/status\` }`.

Fields of `page()`:

| Field | Runs | What it does |
| --- | --- | --- |
| `component` | server + browser | The page. Gets `{ data, lang, params, t }`. |
| `load(context)` | server | Returns `data`. Context: `lang`, `params`, `t`, `content`, `readFile(path)` (from the project folder), `config`, `request`, `url(path)` (absolute address), `notFound()`, `redirect(to)`, `entry` (entry pages). |
| `paths({ lang, content, config })` | build | Parameters of every address of a `:param`/`*` page. Without it the page renders only on demand: a static site cannot build it, the sitemap does not list it. |
| `title`, `description` | server | A string or `({ data, lang, params, t }) => string`. Default title: the feature's, then the site's. |
| `meta` | server | `({ data, … }) => ({ title, description, image, alternates, canonical, head })`; wins over `title` and `description`. |
| `layout` | — | `site` (header + footer, default), `sidebar` (plus a header button for a panel the page draws; read it with `useSidebarCollapsed()`), `none` (the page draws everything, like the docs with `docsLayoutOptions` and `Footer`). |
| `entry` | — | A page per content entry; see [content.md](content.md). |

## `files`

Addresses with no page: feeds, JSON, images. A value is `load` or `{ load, paths }`; it gets the
same context as a page's `load` and returns a `Response`, text, bytes, or an object (JSON). The
content type comes from the extension of the address.

```ts
files: {
  "/rss.xml": async ({ content, lang, url }) => buildRss(await content.entries(), …),
  "/:slug/og.png": { paths: …, load: … },
}
```

## `links`

`({ lang, t, config }) => LinkOption[]`: more places the site may link to than the front page
(which a feature with a `title` offers by itself). `id` is `<feature id>:<name>` (`blog:rss`); also
`title`, `url` (with the language), `description?`, `external?`, `primary?` (listed in the header
when the site does not choose). The site picks them in `header.links` and `footer.columns`;
`consify links` prints them.

## `components`

MDX components the feature adds to every `.mdx` of the site, by name. In a package always
`lazyComponents(() => import("./mdx.tsx"), ["A", "B"])`: the module loads when one is first drawn.

## `search`

Leave it out when the feature has `content`: core searches the entries
(`/{lang}/<id>/search.json`). Otherwise:

- `useSearch({ lang, isStatic })` → `{ search, setSearch, isLoading, items }` (`items: null` shows
  nothing): results for the site's one search dialog;
- `open()` → `boolean`: open a search of the feature's own (Scalar's), `false` when it is not
  there yet.

## Testing a feature

```ts
import { defineConfig, linkCatalog } from "@consify/core";
import { createLoadContext, siteAddresses } from "@consify/core/node";

const config = defineConfig({ site: { name: "D" }, i18n: { languages: ["en", "ru"] }, features: [status()] });
linkCatalog(config, "ru");                                 // the links it offers
(await siteAddresses(config, cwd)).map((a) => a.url);      // every address, per language
const feature = config.features[0];
const page = feature.pages["/:service"];
if (page?.kind === "page") await page.load?.(createLoadContext({ config, feature, lang: "en", params: { service: "api" }, cwd }));
```
