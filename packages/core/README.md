# consify

A documentation site foundation you configure instead of maintain. Your project is a config file
and your pages; the core is a package that you update with one command.

Built on [Fumadocs](https://fumadocs.dev), [React Router](https://reactrouter.com) and
[Vite](https://vite.dev). Configuration is validated with [Zod](https://zod.dev).

- Docs with MDX, search, table of contents, previous and next links, Edit on GitHub
- Several languages and several versions of the docs, with a fallback for pages you have not translated
- A blog with categories, tags, search, RSS and social images; drafts never reach the browser
- An API reference from an OpenAPI schema (optional)
- Your own design: theme tokens, plugins, MDX components, and slots for the home page, header and footer
- Runs as a Node server or exports plain static files

## Start

```bash
bunx create-consify@latest my-docs
cd my-docs
bun run dev
```

Or add it to an existing project:

```bash
bun add consify react react-dom react-router
bun add -d vite typescript
```

```ts
// docs.config.ts
import { defineConfig } from "consify";

export default defineConfig({ site: { name: "My docs" } });
```

```ts
// vite.config.ts
import { consify } from "consify/vite";
import { defineConfig } from "vite";
import config from "./docs.config.ts";

export default defineConfig({ plugins: [consify(config)] });
```

```ts
// react-router.config.ts
import { defineRouterConfig } from "consify/react-router";
import config from "./docs.config.ts";

export default defineRouterConfig(config);
```

## Commands

`consify dev`, `consify build`, `consify start`, `consify typegen`.

## Documentation

See the documentation site and the [repository](https://github.com/shiz-ceo/consify).

## License

MIT
