# @consify/docs

The documentation section of a [consify](https://github.com/shiz-ceo/consify) site: MDX pages in
`content/<language>/docs` with a sidebar, search, several versions, translations, `llms.txt` and generated
social images.

```sh
bun add @consify/docs
```

```ts
// docs.config.ts
import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";

export default defineConfig({
  site: { name: "Acme" },
  features: [docs({ versions: { list: [{ id: "v1", status: "latest" }] } })],
});
```
