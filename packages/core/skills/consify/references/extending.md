# Extending the site: components, plugins, header and footer, sections, skills

Use this when a request needs something consify does not have yet. Everything lives in the user's
project: `custom/` and `docs.config.ts`. Never edit `node_modules/@consify/*`.

## Decide, in this order

1. Do the built-in components do the job ([cheatsheet.md](cheatsheet.md))? Use them.
2. A new block for MDX pages: a component in `custom/components/<Name>.tsx`.
3. Changing how Markdown or code blocks are processed, or new syntax: a plugin in `mdx.plugins`.
4. A different header or footer: `custom/header.tsx`, `custom/footer.tsx`.
5. A front page: `content/<language>/home.mdx`; a React one: a feature with `path: ""`.
6. A different look: hand off to **consify-theme**.
7. A section with its own pages (not docs, blog or API reference): a feature in
   `custom/features/<name>.tsx`. Reused across projects or published: **consify-extension-engineering**.
8. Knowledge an agent needs about this project: a skill in `custom/skills/<name>/SKILL.md`.

**Ask the user before adding anything new.** Say what you will add and why. This holds mid-task
too: if writing a page reveals a missing capability, stop and ask; do not work around it or add it
silently.

## A component

The file name (capital letter) is the tag, the default export is the component. No import, no
registration.

```tsx title="custom/components/Since.tsx"
export default function Since({ version }: { version: string }) {
  return <span className="rounded-full border border-fd-border px-2 py-0.5 text-xs">since {version}</span>;
}
```

```mdx
Recurring jobs <Since version="0.3" />
```

- Style with theme tokens (`text-fd-muted-foreground`, `border-fd-border`, `bg-fd-card`), never
  fixed colors, so light and dark both work. Check a narrow screen.
- Not inside a heading. A component named like a built-in one replaces it.
- A component defined elsewhere: `mdx: { components: { Since } }`.
- Use it once on the page that needed it; describe its props in a comment.

## A plugin

```ts title="custom/plugins/my-plugin.ts"
import { definePlugin } from "@consify/core";

export const myPlugin = definePlugin({
  name: "my-plugin",
  remark: [],                               // Markdown syntax tree
  rehype: [],                               // HTML syntax tree
  shiki: { transformers: [], langs: [] },   // code blocks
  components: {},                           // MDX components shipped with the plugin
  messages: {},                             // strings per language
});
```

```ts title="docs.config.ts"
import { myPlugin } from "./custom/plugins/my-plugin.ts";

export default defineConfig({ /* … */ mdx: { plugins: [myPlugin] } });
```

One plugin, one job, a unique `name`. They run in the listed order, after the built-in ones. Avoid
new dependencies when a few lines do.

## Header and footer

- `custom/header.tsx`: the default export replaces the middle of the header (the links); a named
  export `End` fills the right side, before search, language and theme controls. Props:
  `{ consify, lang, links }`.
- `custom/footer.tsx`: the default export replaces the footer on every page. Props:
  `{ consify, lang }`.
- Or components in `slots: { header, headerEnd, footer }`; the config wins over the files.

They are shared by every page; a change shows everywhere. For links only, `header.links` and
`footer` in the config are enough.

## The front page

`content/<language>/home.mdx`, one per language:

```mdx title="content/en/home.mdx"
---
title: Acme
description: Background jobs for TypeScript.
---

<Hero
  title="Background jobs without the guesswork"
  description="Typed jobs from the producer to the worker."
  actions={[
    { label: "Get started", href: "/docs" },
    { label: "Why Acme?", href: "/docs/concepts", variant: "secondary" },
  ]}
/>

<Features items={[{ icon: "ShieldCheck", title: "Typed", description: "Payloads are checked.", href: "/docs" }]} />

The rest of the file is ordinary MDX.
```

Links in `href` get the language added. Without
`home.mdx`, `/{lang}` redirects to the first feature with a title. A React front page is a feature
with `path: ""`.

## A section: a feature in one file

`custom/features/<name>.tsx` exports one `defineFeature`. The example below is a whole feature: a
list, a page per service, a JSON file, in every language.

```tsx title="custom/features/status.tsx"
import { defineFeature, page } from "@consify/core";
import { Link } from "react-router";

const services = [
  { id: "api", name: "API", state: "operational" },
  { id: "dashboard", name: "Dashboard", state: "degraded" },
] as const;

export const status = defineFeature({
  id: "status",                                   // /{lang}/status, content/<lang>/status/, link id
  title: { en: "Status", ru: "Статус" },          // header link and page titles
  description: { en: "Live state of the services", ru: "Состояние сервисов сейчас" },
  messages: {
    en: { operational: "Operational", degraded: "Degraded" },
    ru: { operational: "Работает", degraded: "Сбои" },
  },
  pages: {
    "/": ({ lang, t }) => (
      <main className="mx-auto w-full max-w-2xl px-4 py-12">
        {services.map((s) => (
          <Link key={s.id} to={`/${lang}/status/${s.id}`} className="flex justify-between py-2">
            {s.name} <span className="text-fd-muted-foreground">{t(s.state)}</span>
          </Link>
        ))}
      </main>
    ),
    "/:service": page({
      paths: () => services.map((s) => ({ service: s.id })),   // required for a static site
      load: ({ params, notFound }) => services.find((s) => s.id === params.service) ?? notFound(),
      title: ({ data }) => data.name,
      component: ({ data, t }) => <h1 className="text-3xl font-semibold">{data.name}: {t(data.state)}</h1>,
    }),
  },
  files: {
    "/status.json": () => ({ services }),         // JSON, text, bytes or a Response
  },
});
```

```ts title="docs.config.ts"
import { status } from "./custom/features/status.tsx";

export default defineConfig({ /* … */ features: [docs(), status] });
```

What else `defineFeature` takes:

| Field | For |
| --- | --- |
| `path` | Another address; `""` makes it the front page |
| `pages` | `"/"`, `"/:param"`, `"/*"`: a component, `page({ load, paths, title, meta, layout, component })`, or `{ redirect: ({ lang }) => url }` |
| `layout` (of a page) | `site` (header + footer, default), `sidebar` (plus a panel button), `none` (the page draws everything) |
| `files` | Addresses with no page: `"/feed.xml": ({ content, lang, url }) => …` |
| `content` | MDX files in `content/<lang>/<id>/`: `schema`, `filter`, `sort`, `tree`, `search`, `llms`, `og`; add `"/*": { entry: true, component: ({ data }) => <Mdx code={data.code} /> }` for a page per file |
| `links` | More link ids for `header.links` (`status:json`) |
| `components` | MDX components for every `.mdx` |
| `search` | A search of its own (`useSearch` or `open`); content is searched without it |

- `load`, `paths` and `files` run on the server: read files with `readFile("./data.json")`
  (from the project folder) or `content`, not with `fetch` to the site itself.
- `t(key, { name })` fills `{name}`; English is the reference. Link to the feature with
  `/${lang}/<id>/…`.
- A page that needs `@consify/core/ui` (`SitePage`, `FallbackNotice`, `useMessages`, …) goes in its
  own file, loaded with `lazy(() => import("./status-page.tsx"))`: `docs.config.ts` imports this
  file, and `@consify/core/ui` reads the site built from that config.
- A dynamic page without `paths` renders only on demand: a static site (`deploy.mode: "static"`)
  cannot build it.

The full contract: the **consify-extension-engineering** skill, `references/feature-contract.md`.

## A project skill

`custom/skills/<name>/SKILL.md` (with `name` and `description` in the front matter, `name` equal
to the folder). `consify skill sync` copies it to `.claude/skills/<name>/`; it wins over a package
skill with the same name. `consify add` puts a registry `skill` item there.

## Keep the config in step

Re-read the schema of the installed package before adding keys.

| New capability | Config |
| --- | --- |
| Another language | `i18n` |
| Another version | `versions` in `docs({ … })` |
| The docs | `features: [docs()]` (`bun add @consify/docs`) |
| A blog | `features: [blog()]` (`bun add @consify/blog`) |
| An API reference | `features: [apiReference({ input })]` (`bun add @consify/api-reference`) |
| A second docs section or blog | `docs({ id: "guides", title: "Guides" })`, `blog({ id: "news" })` |
| Your own section | `features: [status]` from `custom/features/status.tsx` |
| Links in the header (menus too) | `header.links` (ids from `consify links`, or `{ title, url }`) |
| A footer | `footer` (`columns[].links` take the same items) |
| Edit on GitHub | `site.github`, `editOnGithub` in `docs({ … })` |
| The public address | `site.url` |
| Publishing mode | `deploy` |
| Table of contents, social images, `llms.txt` | options of `docs({ … })` (`toc`, `og`, `llmsTxt`) |
| Math, twoslash, MDX components, plugins | `mdx` |
| Colors, presets, brand, fonts | hand off to **consify-theme** |
