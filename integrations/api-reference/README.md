# @consify/api-reference

An API reference for a [consify](https://github.com/shiz-ceo/consify) documentation site,
generated from an OpenAPI schema with [Scalar](https://scalar.com), on its own page at `/{lang}/api`.

```sh
bun add @consify/api-reference
```

```ts
// docs.config.ts
import { defineConfig } from "@consify/core";
import { apiReference } from "@consify/api-reference";

export default defineConfig({
  site: { name: "Acme" },
  features: [apiReference({ input: "./openapi.json" })],
});
```
