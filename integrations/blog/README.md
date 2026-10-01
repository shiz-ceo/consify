# @consify/blog

A blog for a [consify](https://github.com/shiz-ceo/consify) documentation site: posts in MDX with
categories and authors, a list with filters and search, an RSS feed, social images, and MDX
components for posts (`<Authors />`, `<Benchmark />`, `<Figure />`, …).

```sh
bun add @consify/blog
```

```ts
// docs.config.ts
import { defineConfig } from "@consify/core";
import { blog } from "@consify/blog";

export default defineConfig({
  site: { name: "Acme" },
  features: [blog({ authors: { ada: { name: "Ada Novak" } } })],
});
```

Posts live in `content/<language>/blog/<slug>.mdx` (`content/en/blog/<slug>.mdx` for the default language). See the
[documentation](https://github.com/shiz-ceo/consify/tree/main/apps/docs/content/en/docs/v0/blog) for the options and
the front matter.
