# Package structure

The layout of `@consify/docs`, `@consify/blog` and `@consify/api-reference`. Match it for a
published package; a private package in one monorepo takes what it needs.

```
consify-status/
├─ package.json
├─ tsconfig.json             types: ["bun", "vite/client"] (import.meta.env)
├─ tsconfig.build.json       extends tsconfig.json, compiles src/ for publishing
├─ src/
│  ├─ index.ts               the factory and the public types. No JSX, CSS or @consify/core/ui
│  ├─ options.ts             zod schema, input and output types
│  ├─ messages.ts            strings per language; export type StatusMessages = MessagesOf<…>
│  ├─ page.tsx, list-page.tsx  pages (default exports), each loaded with lazy()
│  ├─ mdx.tsx                MDX components (named exports), loaded with lazyComponents()
│  ├─ server.ts              server-only code, imported under import.meta.env.SSR
│  └─ ui/                    components and CSS the pages share
├─ skills/
│  └─ consify-status-authoring/
│     ├─ SKILL.md
│     └─ references/         optional
└─ test/
   └─ status.test.ts
```

Flat `src/`, one file per job. Plain logic (parsing, sorting, a feed builder) goes in its own `.ts`
file with no React, so tests import it directly.

## `index.ts`

Node imports it with `docs.config.ts`, and so does the browser bundle.

```ts title="src/index.ts"
import { defineFeature, lazyComponents, page } from "@consify/core";
import { lazy } from "react";
import { statusMessages } from "./messages.ts";
import { type StatusOptionsInput, statusOptionsSchema } from "./options.ts";

const ListPage = lazy(() => import("./list-page.tsx"));

export function status(input: StatusOptionsInput = {}) {
  const parsed = statusOptionsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `status(): ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const { id, source } = parsed.data;
  return defineFeature({
    id,
    title: ({ t }) => t("status"),
    messages: statusMessages,
    pages: {
      "/": page({
        load: async ({ readFile }) => {
          const { parseServices } = await (import.meta.env.SSR
            ? import("./server.ts")
            : Promise.reject(new Error("server only")));
          return parseServices(await readFile(source));
        },
        component: ListPage,
      }),
    },
    components: lazyComponents(() => import("./mdx.tsx"), ["StatusBadge"]),
  });
}
```

- Export the factory and the types a project needs (`StatusOptionsInput`, data types pages share).
- Export nothing that pulls in JSX or CSS.
- A page module imports its data type from `./index.ts` with `import type` only.

## `package.json`

```json
{
  "name": "consify-status",
  "type": "module",
  "exports": { ".": "./src/index.ts", "./package.json": "./package.json" },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json",
    "test": "bun test",
    "build": "bun run ../../scripts/build-package.ts"
  },
  "dependencies": { "zod": "…", "some-browser-lib": "…" },
  "peerDependencies": {
    "@consify/core": "^1.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router": "^8.4.0"
  },
  "consify": { "prebundle": ["some-browser-lib"] }
}
```

- **Name**: `@consify/<name>` or `consify-<name>`. A project finds its consify packages by these
  prefixes: Tailwind scans them, `prebundle` is read from them, `consify skill sync` collects their
  skills. Another name gets none of that.
- **`consify.prebundle`**: dependencies the pages load in the browser. Vite pre-bundles them at
  start instead of re-optimizing and reloading during the first visit (which breaks hydration).
  Resolved from the package, so a project does not depend on them itself.
- **`@consify/core` is a peer dependency**: the project has exactly one.

## Build and publish

Node cannot run TypeScript from `node_modules`, so a published package ships JavaScript. In this
monorepo, `scripts/build-package.ts` compiles `src/` with `tsconfig.build.json`, copies CSS and
`.d.ts` files, copies `skills/`, `README.md`, `LICENSE` and `CHANGELOG.md`, and points `exports` at
`dist/`. Outside it, reproduce the same result with your own tool: compiled `src/`, stylesheets next
to it, `skills/` at the package root.

## Tests

`bun:test`. Test plain logic without a file system. For the rest, a temp folder
(`mkdtempSync(join(tmpdir(), "consify-status-"))`, removed in `afterEach`) with fixture content, and:

- options: a wrong option throws with its name;
- `linkCatalog(config, lang)`: the links, translated;
- `siteAddresses(config, cwd)`: every address in every language;
- `createLoadContext({ config, feature, lang, params, cwd })`: what a `load` returns;
- two instances (`status()`, `status({ id: "uptime" })`): separate ids, addresses, folders; the
  same id twice is refused.

`integrations/blog/test/blog.test.ts` and `integrations/api-reference/test/api-reference.test.ts`
in the consify repository show all of these.

## Its own skill

`skills/<name>/SKILL.md` at the package root. `consify skill sync` copies it to the project's
`.claude/skills/<name>/` when the project depends on the package.

- `name` in the front matter is the folder name: `consify-<feature>-authoring` unless there is a
  reason not to. Lowercase letters, digits, `-`.
- `description` says when to use it and when not (what belongs to **consify** or
  **consify-translate**).
- Cover only what is specific: its options, front matter, file layout, review rules. Do not repeat
  the interview, translation or verification; the core skills own them.

`integrations/blog/skills/consify-blog-authoring/SKILL.md` is a complete example.
