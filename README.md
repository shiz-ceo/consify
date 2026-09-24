# docsivi

Customizable documentation site foundation built on Fumadocs. Work in progress, see [TASKS.md](TASKS.md) for the plan and current status.

## Structure

- `packages/core`: the `docsivi` package (config, plugins, components, theme).
- `apps/starter`: the minimal template for a new docs site.
- `apps/demo`: a full, realistic example site ("Lattice", a fictional job queue): sections, nested categories, two languages, two versions, custom components and plugins.

## Commands

```bash
bun install
bun test
bun run typecheck
bun run demo    # run the demo site on http://localhost:3300
bun run starter # run the minimal starter
bun run check   # lint + typecheck + tests
```
