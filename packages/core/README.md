# @consify/core

A documentation site foundation you configure instead of maintain. Your project is a config file
and your pages; the packages are updated with one command.

This is the core: the config (`docs.config.ts`, validated), the layout of the site (home page, header,
footer, slots), the theme, the MDX pipeline and the build (Vite plugin, React Router adapter, CLI).
The sections of the site are features listed in `features`: the documentation
(`@consify/docs`), the blog (`@consify/blog`), the API reference (`@consify/api-reference`) or your own.

Built on [Fumadocs](https://fumadocs.dev), [React Router](https://reactrouter.com) and
[Vite](https://vite.dev). Configuration is validated with [Zod](https://zod.dev).

- Docs with MDX, search, table of contents, previous and next links, Edit on GitHub (the `@consify/docs` package)
- Several languages, with a fallback for pages you have not translated, and several versions of the docs (`@consify/docs`)
- A blog with categories, tags, search, RSS and social images; drafts never reach the browser (the `@consify/blog` package)
- An API reference from an OpenAPI schema (the `@consify/api-reference` package)
- Your own sections: one file with `defineFeature` (React pages, content, strings), listed in `features`
- Your own design: theme tokens, MDX components and plugins (`mdx`), a header and a footer of your own
- Runs as a Node server or exports plain static files

## Start

```bash
bun create @consify my-docs
cd my-docs
bun run dev
```

Or add it to an existing project:

```bash
bun add @consify/core @consify/docs react react-dom react-router
bun add -d vite typescript
```

```ts
// docs.config.ts
import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";

export default defineConfig({
  site: { name: "My docs" },
  features: [docs()],
});
```

```ts
// vite.config.ts
import { consify } from "@consify/core/vite";
import { defineConfig } from "vite";
import config from "./docs.config.ts";

export default defineConfig({ plugins: [consify(config)] });
```

```ts
// react-router.config.ts
import { defineRouterConfig } from "@consify/core/react-router";
import config from "./docs.config.ts";

export default defineRouterConfig(config);
```

## Commands

`consify dev`, `consify build`, `consify start`, `consify typegen`.

## Documentation

See the documentation site and the [repository](https://github.com/shiz-ceo/consify).

## License

MIT
