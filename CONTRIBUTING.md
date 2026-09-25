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
| `packages/core` | the `consify` package |
| `packages/create-consify` | the project generator |
| `apps/docs` | the documentation of consify |
| `apps/demo` | a full example site |
| `apps/starter` | the template a new project starts from |
| `skills/consify-docs` | the skill that helps to write docs for a consify site |

## Before you send a change

- `bun run check` passes, and `bun run docs:check` if you touched documentation.
- New behavior has a test (`packages/core/test`).
- A change that a user can see is described in `apps/docs` in English **and** Russian and listed in `CHANGELOG.md`.
- A config option is documented in `apps/docs/content/docs/v0/configuration` and `reference/config.mdx`
  (a test fails when a top-level key is missing from the reference).
- Code has TSDoc comments where it is exported, and inline comments only where the reason is not obvious.

## Structure of the core

`packages/core/src`: `features/` (sections a project can turn on and off), `system/` (what every site has),
`shared/` (layout, UI, slots), `build/` (Vite plugin and the router adapter), `config/`, `mdx/`, `plugins/`, `theme/`.
See "Contributing" in the documentation for how to add a feature.

## Releasing

Only maintainers release. Update `CHANGELOG.md` and the version of `packages/core` and
`packages/create-consify`, then push a tag `vX.Y.Z`. The Release workflow publishes both packages.
