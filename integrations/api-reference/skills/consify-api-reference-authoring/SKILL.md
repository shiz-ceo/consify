---
name: consify-api-reference-authoring
description: Keep a consify site's API reference in sync with its OpenAPI schema — descriptions, examples, tags, grouping. Use when asked to document an API, add or update endpoint descriptions, or set up the apiReference() feature. This is not prose written as MDX pages; almost all of the work happens in the OpenAPI schema file itself.
---

# consify-api-reference-authoring

The API reference is not a set of MDX pages: it is one page (`/{lang}/api`) rendered from an OpenAPI
schema with [Scalar](https://scalar.com). Writing "the API docs" here mostly means improving that
schema, not writing prose in `content/`.

## Set up if it is not there

`bun add @consify/api-reference`, then `apiReference()` in `features` — ask before adding it:

```ts title="docs.config.ts"
import { apiReference } from "@consify/api-reference";

features: [apiReference({ input: "./openapi.json", title: "API" })],
```

| Option | Default | |
| --- | --- | --- |
| `input` | — | The OpenAPI schema: a file of the project (`./openapi.json`, read on the server) or an `http(s)` URL (loaded by the browser) |
| `title` | `"API"` | The link in the header and the page title; a string or `{ en, ru }` |
| `id` | `"api"` | The address `/{lang}/<id>` and the link id for `header.links` |

A second reference is a second call with its own `id`:
`apiReference({ id: "admin-api", input: "./admin.json", title: "Admin API" })` → `/{lang}/admin-api`.
Two with the same `id` stop the config. The site's search field opens Scalar's own search on this
page.

## Improving the schema

Work directly in the OpenAPI file(s) named by `input`:

- **`description`** on every operation and every schema/property — write it from what the code
  actually does (read the handler, not just the route name); never invent behavior.
- **`summary`** short, one line, shown in lists.
- **`tags`** group related operations; a schema with no tags is harder to find in the sidebar.
- **`example`** / `examples` on request and response bodies — a real, working example beats a
  placeholder. If the project has integration tests or a Postman collection, prefer examples proven
  to work over hand-written ones.
- **Errors:** document the response codes that are actually possible for an operation (`4xx`/`5xx`),
  not just the happy path.

If the schema is generated from code (a framework's own OpenAPI generator, TSDoc-to-schema tooling),
improve the source comments instead of hand-editing the generated file — check for a `openapi.json`
that is clearly a build artifact (committed but regenerated) before editing it directly, and ask if
unsure.

## What this skill does not do

- It does not write a guide or tutorial about the API — that belongs to **consify-docs-authoring**
  (a page can link to `/api` for the exact request/response shapes and keep the guide about the
  *task*, not the endpoint list).
- It does not translate the schema — it is not per-language content; `title` of
  `apiReference()` is the only string consify itself localizes.

## Verify

```bash
bun run build   # a missing input file fails the page (and a static build); a duplicate id stops the config
bun run dev     # open /{lang}/api and check the operations, examples and grouping render as expected
```

`consify check` confirms the page's address exists, but does not read the schema: validate it with
the project's OpenAPI tooling if it has one.
