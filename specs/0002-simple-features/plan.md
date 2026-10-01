# 0002: one `defineFeature`

Goal: a feature is React components, optionally reading `content/` and translated strings. One
function, `defineFeature`, one object, one file. A junior writes a feature in under 100 lines.
Everything else (routes, pre-render, sitemap, header links, 404, languages) is derived by core.

## The API

```tsx
import { defineFeature } from "@consify/core";

export const status = defineFeature({
  id: "status",                                  // URL segment, content folder, link id
  title: { en: "Status", ru: "Статус" },         // the header link (omit for no link)
  messages: { en: { up: "Up" }, ru: { up: "Работает" } },
  pages: {
    "/": ({ t }) => <h1>{t("up")}</h1>,         // /:lang/status
    "/:service": {                               // /:lang/status/:service
      paths: () => services.map((s) => ({ service: s.id })),
      load: ({ params, notFound }) => services.find((s) => s.id === params.service) ?? notFound(),
      title: ({ data }) => data.name,
      component: ({ data }) => <h1>{data.name}</h1>,
    },
  },
  files: {
    "/status.json": () => ({ services }),        // a resource route: JSON, text or a Response
  },
});
```

`docs.config.ts`: `features: [docs(), blog(), status]`.

- A page is a component, or `{ component, load?, paths?, title?, description?, layout? }`.
- `load` runs on the server. It gets `{ lang, params, t, content, site, notFound, redirect }`.
- `content` reads `content/<lang>/<id>/` (falls back to the default language by `i18n.fallback`):
  `list`, `read`, `json`, `mdx` (compiled on the server, rendered with `<Mdx />`).
- `paths` lists the params of a dynamic page for pre-render and the sitemap. No `paths`: rendered on
  demand (server mode only).
- Heavy pages of a package use `React.lazy(() => import(...))` so the config stays loadable in Node.
- Several instances are just several features: `blog({ id: "news" })` returns another feature.

## What goes away

`defineInstanceFeature`, `multi-instance.ts`, `instance-route.ts`, `content-module.ts`, `FeatureNode`
and every `node.ts`, `packageFile`/`factoryModule`/`factoryExport`/`exports`/`ext`, `Feature.generated`,
`available`/`when`/`enabled`, `consify:<id>` modules and `instance.d.ts`, `scaffoldExtensions`,
fumadocs-mdx and its macros, the deprecations machinery, `contract/` + `content/` split.

## Phases

1. Core: new `defineFeature`, route generation (one generic wrapper per page), page shell, `t`,
   server `content` + runtime MDX (`<Mdx />`), prerender/sitemap/links from pages. Config:
   `extensions` → `features`, MDX switches → `mdx`.
2. Demo `status` feature as one file.
3. `@consify/api-reference`, then `@consify/blog`, then `@consify/docs` on the new API.
4. Home page, search dialog, 404/redirect/sitemap/robots as core internals.
5. CLI (`links`, `lang`, `docs check`, `doctor`, `skill`), `create-consify`, starter.
6. apps/demo, apps/docs (en + ru docs of the new API), skills, CHANGELOG.
7. Verify: lint, typecheck, tests (rewritten), demo/docs/starter builds, browser, e2e.
