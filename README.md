# consify

A customizable documentation site foundation built on Fumadocs, React Router and Vite. Configure it
in one file, add your own pages, components and plugins, update the core with `bun update` without
touching your content. See [TASKS.md](TASKS.md) for the plan and the log of decisions.

## Structure

- `packages/create-consify`: the project generator (`bunx create-consify`).
- `packages/core`: the `@consify/core` package (config, `defineFeature`, content, layout, components, theme, React Router adapter, Vite plugin). Sections are features.
- `packages/cli`: the `consify` command (`dev`, `build`, `check`, `deploy`, `lang`, `skill`, `add`).
- `integrations/docs`: the `@consify/docs` package (the documentation extension: pages, versions, search, `llms.txt`, social images).
- `integrations/blog`: the `@consify/blog` package (the blog extension).
- `integrations/api-reference`: the `@consify/api-reference` package (the API reference extension).
- `apps/docs`: the documentation of consify itself (English and Russian, versioned as `v0`, with a blog from `@consify/blog`), built with consify.
- `apps/starter`: the minimal template for a new docs site.
- `apps/demo`: a full, realistic example ("Lattice", a fictional job queue): sections, nested categories, two languages, two versions, custom components and plugins.

## A project is only config

```
my-docs/
├─ docs.config.ts            all settings: site, languages, theme, head, banner, features (`docs()`, `blog()`, yours), mdx
├─ vite.config.ts            plugins: [consify(config)]
├─ react-router.config.ts    export default defineRouterConfig(config)
├─ content/<language>/docs/  your pages (.mdx), folders are sections; one folder per language
└─ custom/
   ├─ features/              your sections: one file each, `defineFeature` with React pages
   ├─ components/            Foo.tsx becomes <Foo /> in every .mdx page, no imports
   ├─ plugins/               remark / rehype / Shiki plugins (`mdx.plugins`)
   └─ theme.css              your styles, loaded after the core theme
```

Routes, the root layout and the content instance are generated into `.consify/` (gitignored), so
there is no `app/` folder to maintain.

## Commands

In this repository:

```bash
bun install
bun run docs       # the documentation of consify on http://localhost:3500
bun run demo       # demo site on http://localhost:3300
bun run starter    # the minimal starter
bun run build:demo # production build of the demo
bun run check      # lint + typecheck + tests
bun run e2e        # end-to-end tests (Playwright; first: bunx playwright install chromium)
```

In a docs project: `consify dev`, `consify build`, `consify start`, `consify typegen`, `consify links` (the link ids for `header.links`), `consify locale <language>`.

## Deploy modes

`deploy: { mode: "server" }` (default) builds a Node server (`consify start`) and pre-renders every
page. `deploy: { mode: "static" }` builds plain files (`build/client`) for any static host; search
runs in the browser.
