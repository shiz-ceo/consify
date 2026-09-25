# Extending the site: components, plugins, slots

Use this when a page needs something docsivi does not have. Everything lives in the user's project:
`custom/` and `docs.config.ts`. Never edit `node_modules/docsivi`.

## Decide, in this order

1. Do the built-in components do the job ([docsivi-cheatsheet.md](docsivi-cheatsheet.md))? Use them.
2. A new block for MDX pages: a component in `custom/components/<Name>.tsx`. The file name (capital
   letter) is the tag, the default export is the component. No import and no registration.
3. Changing how Markdown or code blocks are processed, or adding syntax: a plugin.
4. A different home page, header or footer: a slot (`custom/home.tsx`, `custom/header.tsx`,
   `custom/footer.tsx`).
5. A different look: `theme` in the config, or `custom/theme.css`.

**Ask the user before adding anything new.** Describe what you will add and why.

## A component

```tsx title="custom/components/Since.tsx"
export default function Since({ version }: { version: string }) {
  return <span className="rounded-full border px-2 py-0.5 text-xs">since {version}</span>;
}
```

```mdx
Recurring jobs <Since version="0.3" />
```

- Style with the tokens of the theme (`text-fd-muted-foreground`, `border-fd-border`, `bg-fd-card`),
  not fixed colors, so it works in the light and dark theme. Check a narrow screen.
- Do not put it inside a heading.
- A component with the name of a built-in one replaces it.
- Interactive components use hooks normally; add `"use client"` only when needed.
- After adding, use it once on the page that needed it and describe its props in a comment.

## A plugin

```ts title="custom/plugins/my-plugin.ts"
import { definePlugin } from "docsivi/plugins";

export const myPlugin = definePlugin({
  name: "my-plugin",
  remark: [],       // Markdown syntax tree
  rehype: [],       // HTML syntax tree
  shiki: { transformers: [], langs: [] },  // code blocks
  components: {},   // MDX components shipped with the plugin
});
```

```ts title="docs.config.ts"
import { myPlugin } from "./custom/plugins/my-plugin.ts";

export default defineConfig({ /* ... */ plugins: [myPlugin] });
```

- One plugin, one job, a unique `name`. Avoid new dependencies when a few lines do the job.
- Plugins run in the order they are listed.

## Slots

`custom/header.tsx` exports a default component (the middle of the header) and an optional `End`
(the right side). `custom/footer.tsx` receives `variant` (`full` or `compact`) and may reuse
`DefaultFooter` from `docsivi/components`. `custom/home.tsx` fills the content of the home page.
The header and the footer are shared by every page, so a slot changes them everywhere.

## Keep the config in step

When a new capability needs configuration, update `docs.config.ts` and re-read the schema of the
installed package first, so key names and types are right:

| New capability | Config |
| --- | --- |
| Another language | `i18n` |
| Another version | `versions` |
| A blog | `blog` |
| Links in the header | `nav` |
| A footer | `footer` |
| Edit on GitHub | `site.github` |
| The public address | `site.url` |
| Publishing mode | `deploy` |
| Search, table of contents, social images | `features` |
