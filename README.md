# docsivi

A customizable documentation site foundation built on Fumadocs, React Router and Vite. Configure it
in one file, add your own pages, components and plugins, update the core with `bun update` without
touching your content. See [TASKS.md](TASKS.md) for the plan and the log of decisions.

## Structure

- `packages/core`: the `docsivi` package (config, plugins, components, theme, React Router adapter, Vite plugin, CLI).
- `apps/starter`: the minimal template for a new docs site.
- `apps/demo`: a full, realistic example ("Lattice", a fictional job queue): sections, nested categories, two languages, two versions, custom components and plugins.

## A project is only config

```
my-docs/
├─ docs.config.ts            all settings: site, languages, versions, theme, plugins, home page
├─ vite.config.ts            plugins: [docsivi(config)]
├─ react-router.config.ts    export default defineRouterConfig(config)
├─ content/docs/             your pages (.mdx), folders are sections
└─ custom/
   ├─ components/            Foo.tsx becomes <Foo /> in every .mdx page, no imports
   ├─ plugins/               remark / rehype / Shiki plugins
   └─ theme.css              your styles, loaded after the core theme
```

Routes, the root layout and the content instance are generated into `.docsivi/` (gitignored), so
there is no `app/` folder to maintain.

## Commands

In this repository:

```bash
bun install
bun run demo       # demo site on http://localhost:3300
bun run starter    # the minimal starter
bun run build:demo # production build of the demo
bun run check      # lint + typecheck + tests
```

In a docs project: `docsivi dev`, `docsivi build`, `docsivi start`, `docsivi typegen`.

## Deploy modes

`deploy: { mode: "server" }` (default) builds a Node server (`docsivi start`) and pre-renders every
page. `deploy: { mode: "static" }` builds plain files (`build/client`) for any static host; search
runs in the browser.
