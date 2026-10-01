---
name: consify-extension-engineering
description: Build a consify feature package — the same kind of thing @consify/docs, @consify/blog and @consify/api-reference are, meant to be reused across projects or published as its own package. Use when asked to build a publishable feature, a reusable section, or "something like the blog package but for X". Not for a section of one project (one file in custom/features/ — see the consify skill's extending.md, the lighter path).
---

# consify-extension-engineering

A section of a consify site is a **feature**: one `defineFeature({...})` listed in `features` of
`docs.config.ts`. It comes in two sizes:

- **In one project:** `custom/features/<name>.tsx`, one file. The **consify** skill's
  `references/extending.md` covers it. Use it for a status page, a changelog, a one-off.
- **A package:** its own npm package, tests, version and dependencies, installed into several
  projects. **This skill.**

Not obvious which? Ask: is it reused across projects, does it need its own releases, does it bring
dependencies a project should only take on when it uses it? A "yes" means a package.

`@consify/docs`, `@consify/blog` and `@consify/api-reference` use the same `defineFeature` as a
project's own file. Nothing is reserved for them.

## What a feature package is

```
consify-status/
├─ package.json            "consify": { "prebundle": [...] }, peer dependency on @consify/core
├─ src/
│  ├─ index.ts             the factory: status(options) → defineFeature({...}). No JSX, no CSS
│  ├─ options.ts           zod schema of the options (optional)
│  ├─ messages.ts          strings per language (optional)
│  ├─ page.tsx             a page: default export, loaded with lazy()
│  ├─ mdx.tsx              MDX components, loaded with lazyComponents() (optional)
│  └─ server.ts            server-only code, imported under import.meta.env.SSR (optional)
├─ skills/<name>/SKILL.md  what an agent needs to know to use it
└─ test/*.test.ts
```

1. **`index.ts` exports a factory** that returns `defineFeature(...)`. Every address, content folder
   and link id comes from `id` (an option with a default), so a second instance is just a second call:
   `status({ id: "uptime" })`.
2. **`index.ts` stays loadable by Node.** Node reads it with `docs.config.ts` (CLI, tests). Nothing
   it imports statically may contain JSX, a stylesheet or `@consify/core/ui`:
   - pages: `const Page = lazy(() => import("./page.tsx"))` (`lazy` from `react`);
   - MDX components: `components: lazyComponents(() => import("./mdx.tsx"), ["Badge", "Uptime"])`;
   - server-only code (`node:*`, a heavy parser): `import.meta.env.SSR ? import("./server.ts") : …`
     inside `load`, so the browser bundle drops it. Prefer the load context (`readFile`, `content`)
     over `node:fs`.
3. **Pages are React components** that get `{ data, lang, params, t }`. They may import
   `@consify/core/ui` (`SitePage`, `docsLayoutOptions`, `Footer`, `FallbackNotice`, `SearchField`,
   `SiteLink`, `useMessages`, `useSidebarCollapsed`, `consify`) and CSS.
4. **MDX content is core's job.** Declare `content: { schema, filter, sort, tree, search, llms, og }`
   and an `entry: true` page; core reads, checks, translates, compiles, searches and lists the
   addresses. The feature only draws it.
5. **Browser dependencies** a page loads go in `package.json` → `"consify": { "prebundle": [...] }`.
6. **Name it `@consify/<name>` or `consify-<name>`.** Only such dependencies of a project are found
   for Tailwind scanning, `prebundle` and `consify skill sync`.
7. **Ship a skill** in `skills/<name>/SKILL.md` at the package root.

Details: [references/feature-contract.md](references/feature-contract.md) (every field of
`defineFeature`), [references/content.md](references/content.md) (MDX content and entry pages),
[references/package-structure.md](references/package-structure.md) (package.json, build, tests,
skill).

## The model: `@consify/api-reference`

The smallest real package. `src/index.ts`:

```ts title="src/index.ts"
import { defineFeature, type Localized } from "@consify/core";
import { lazy } from "react";

/** The page, loaded when it is shown: Node reads this module with `docs.config.ts`. */
const ApiPage = lazy(() => import("./page.tsx"));

export interface ApiReferenceOptions {
  input: string;
  title?: Localized;
  id?: string;
}

export type ApiSource = { url: string } | { content: string };

export function apiReference({ input, title = "API", id = "api" }: ApiReferenceOptions) {
  return defineFeature({
    id,
    title,
    description: { en: "Every endpoint, with a client to try it", ru: "Все методы, с клиентом для запросов" },
    pages: {
      "/": {
        layout: "sidebar",
        load: async ({ readFile }): Promise<ApiSource> =>
          /^https?:\/\//.test(input) ? { url: input } : { content: await readFile(input) },
        component: ApiPage,
      },
    },
    search: { open: openScalarSearch }, // the site's search field opens Scalar's own search
  });
}
```

- `page.tsx` (default export, `PageProps<ApiSource>`) mounts `scalar.tsx` with another `lazy()`,
  because Scalar needs the browser. `scalar.tsx` imports its CSS and `SearchField`,
  `useSidebarCollapsed` from `@consify/core/ui`.
- `package.json` has `"consify": { "prebundle": ["@scalar/api-reference-react"] }`.
- `skills/consify-api-reference-authoring/SKILL.md` teaches how to improve the OpenAPI schema.
- `test/api-reference.test.ts` checks the address, the link, a second instance and a duplicate id
  with `defineConfig`, `linkCatalog` and `siteAddresses`.

For MDX content, read `@consify/blog` (`content` with a schema, `filter`, `sort`, an entry page, a
feed in `files`, `lazyComponents`) and `@consify/docs` (`tree`, `llms`, `og`, a redirect).

## Workflow

1. **Scope it.** What it shows, for whom, where the data comes from (MDX files in
   `content/<language>/<id>/`, a file of the project, an API).
2. **Options.** A zod schema; the factory parses the input and throws one error naming every bad
   option (`status(): perPage: …`), so a typo stops at config load.
3. **`index.ts`**: `defineFeature` with `id`, `title`, `messages`, `pages`, `files`, `content`,
   `links`, `components`, `search` as needed. Every dynamic page (`:param`, `*`) that is not an
   entry page has `paths`, or a static site cannot build it.
4. **Pages and components** in their own `.tsx` files, loaded lazily.
5. **Tests** (`bun:test`): options, addresses (`siteAddresses`), links (`linkCatalog`), a `load`
   (`createLoadContext`), two instances.
6. **Skill** in `skills/<name>/SKILL.md`.

## Verify

```bash
bun run typecheck
bun test
```

Then in a project that lists it in `features`:

```bash
consify check        # every address of every feature, front matter, translations
bun run build        # also with deploy.mode "static" if it should work there
bun run dev          # every page in every language, light and dark
```

Report what was built, what could not be checked and why. Never commit.
