# Contributing

Thank you for helping. This file says how to set up the repository and what a good change looks like.

## Set up

```bash
bun install
bun run docs       # the documentation, http://localhost:3500
bun run demo       # the demo site, http://localhost:3300
bun run check      # lint, types, tests
```

The repository is a Bun workspace:

| Folder | What |
| --- | --- |
| `packages/core` | the `@consify/core` package |
| `packages/cli` | `@consify/cli`, the `consify` command-line tool |
| `packages/create-consify` | the project generator |
| `integrations/docs` | `@consify/docs`, the documentation feature |
| `integrations/blog` | `@consify/blog`, the blog feature |
| `integrations/api-reference` | `@consify/api-reference`, the API reference feature |
| `apps/docs` | the documentation of consify |
| `apps/demo` | a full example site |
| `apps/starter` | the template a new project starts from |

`packages/*` is the engine: `@consify/core`, its CLI and the project generator. `integrations/*`
holds the features that ship with consify. A feature package is `src/index.ts` (a factory that
returns `defineFeature(...)`, no JSX) and its UI; core reads the content, the feature draws it.

Every package ships its skills for Claude in `skills/<name>/SKILL.md`. `consify skill sync` collects
the ones of the packages a project uses into its `.claude/skills/`. This repository's own
`.claude/skills/` is made the same way: after editing a skill, run
`cd apps/docs && node ../../packages/cli/bin/consify skill sync --force` and copy the result up to
the repository's `.claude/skills/`.

## Before you send a change

- `bun run check` passes, and `bun run docs:check` if you touched documentation.
- New behavior has a test (`packages/*/test`).
- A change that a user can see is described in `apps/docs` in English **and** Russian and listed in `CHANGELOG.md`.
- A config option is documented in `apps/docs/content/en/docs/v0/configuration` and `reference/config.mdx`
  (a test fails when a top-level key is missing from the reference).
- Code has TSDoc comments where it is exported, and inline comments only where the reason is not obvious.

## Structure of the core

`packages/core/src`: `feature/` (`defineFeature`, addresses, the load context), `content/` (reading,
MDX, entries, search, feeds), `runtime/` (the page and loader of a route), `builtin/` (the front
page, 404, sitemap), `shared/` (layout, UI), `build/` (Vite plugin and routes), `config/`, `mdx/`,
`locales/`, `theme/`. See "Contributing" in the documentation for how to add a feature.

## Releasing

Only maintainers release. Update `CHANGELOG.md` and the version of every package in `packages/`
(they share one version), then push a tag `vX.Y.Z`. The Release workflow publishes them all.
