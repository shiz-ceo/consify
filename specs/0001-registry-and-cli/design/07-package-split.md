# Component: splitting the CLI + registry into their own package (`packages/cli`)

**Read this file before `design/01` through `design/06`** — it corrects every file path they use.
This decision was made after those five files were drafted (the user asked for it mid-spec), so they
still say `packages/core/src/build/cli/...` / `packages/core/src/build/registry/...`; this file is
the authority on where things actually live.

## Motivation

1. **Dependency weight.** The CLI migration adds `commander`; the registry adds nothing new
   dependency-wise (plain `fetch`, `node:crypto`); but `serve-socket.ts` (already existing, just
   relocating) already pulls in `express`, `compression`, `morgan`, `@react-router/express`. None of
   this is needed by a project that only imports `consify`'s Vite plugin, config schema, and theme —
   i.e. by `consify-docs`/`consify-blog`/`consify-api-reference` themselves, which import
   `packageDir`/`resolveFeatureFile`/`loadFeatureNode`/`defineFeatureNode` from `consify/node` for
   their own `node.ts` files, and have never needed `express` or `commander` to do that. Keeping
   the CLI in `packages/core` means every feature package's install drags in dependencies it never
   uses.
2. **Independent versioning.** The CLI (and the registry format it implements) can now ship its own
   version, release its own changelog entries, and — down the line — even be usable against an older
   `consify` core without forcing a lockstep bump, the same way `@react-router/dev` and
   `react-router` are already two separate, independently-versioned packages that this exact
   codebase already depends on side by side (a precedent already in use, not a new idea being
   introduced).
3. **A cleaner public surface.** As the "what moves" section below shows, `consify/node`'s export
   list currently mixes two genuinely different audiences: build-time hooks a *feature package*
   needs (`defineFeatureNode`, `packageDir`, `loadFeatureNode`, `resolveFeatureFile`) and CLI-command
   entry points that only `bin/consify` itself (and tests) ever call
   (`runDeployCommand`/`runDoctorCommand`/etc.). Splitting the package makes this obvious instead of
   implicit: `consify/node` keeps only the first group, and the second group stops being a public
   export at all (see "What `consify-cli` no longer needs to export publicly" below) — a smaller,
   more honest public API, not a cosmetic reorganization.

## New package

```
packages/cli/
├─ package.json           npm name: "consify-cli"
├─ tsconfig.json
├─ tsconfig.build.json
├─ bin/consify             the executable — bin field: { "consify": "./bin/consify" }
├─ src/
│  ├─ cli/
│  │  ├─ program.ts
│  │  ├─ legacy-run.ts
│  │  ├─ spinner.ts
│  │  ├─ errors.ts
│  │  └─ spawn-commands.ts
│  ├─ registry/
│  │  ├─ schema.ts
│  │  ├─ config.ts
│  │  ├─ resolve.ts
│  │  ├─ fetch.ts
│  │  ├─ write.ts
│  │  ├─ item-types.ts
│  │  ├─ lockfile.ts
│  │  ├─ add.ts
│  │  ├─ remove.ts
│  │  ├─ sources.ts
│  │  ├─ list.ts
│  │  └─ package-manager.ts
│  ├─ deploy/               (moved wholesale from packages/core/src/build/deploy/)
│  │  ├─ command.ts
│  │  ├─ registry.ts        (the DEPLOY TARGET registry — githubPages/cloudflarePages/.../nginx.
│  │  │                      Unfortunate name collision with the NEW registry/ folder above — see
│  │  │                      "naming collision" edge case below)
│  │  ├─ slug.ts
│  │  ├─ git.ts
│  │  ├─ types.ts
│  │  ├─ snippets/{ci.ts,nginx.ts}
│  │  └─ targets/{github-pages,cloudflare-pages,netlify,vercel,docker,nginx}.ts
│  ├─ colors.ts             (moved from packages/core/src/build/colors.ts — used by deploy + doctor
│  │                         + the new registry code's write/remove output)
│  ├─ doctor.ts              (moved)
│  ├─ docs-command.ts        (moved)
│  ├─ docs-check.ts          (moved — the actual check logic; see "docs:check script" note below)
│  ├─ skill-command.ts       (moved — see "resolving consify's OWN skills/ folder" below)
│  ├─ lang-command.ts        (moved)
│  ├─ links-command.ts       (moved)
│  ├─ locale-command.ts      (NEW file — see "splitting locales/template.ts" below; this is the
│  │                         part of the old template.ts that becomes runLocaleCommand/
│  │                         registerLocaleCommand)
│  └─ serve-socket.ts        (moved)
└─ test/                     (moved wholesale — see "test migration" below)
   ├─ deploy.test.ts
   ├─ docs-check.test.ts
   ├─ skill.test.ts
   ├─ lang.test.ts           (only the CLI-facing parts — see the note below)
   ├─ links.test.ts
   └─ locales.test.ts        (only the CLI-facing parts — see the note below)
```

## What stays in `packages/core` (`consify`)

| File | Why it stays |
| --- | --- |
| `src/build/load-config.ts` | Needed by both the Vite plugin (core's own build-time code) and every `consify-cli` command — `consify-cli` imports `loadConfig` from `consify`, does not own it |
| `src/build/feature-node.ts` (`defineFeatureNode`, `loadFeatureNode`, `resolveFeatureFile`, `packageDir`) | Public contract for `consify-blog`/`consify-docs`/`consify-api-reference`'s own `node.ts` files, loaded by the Vite plugin at build time — nothing to do with the CLI a person types, must not require `consify-cli` as a dependency just to define a feature |
| `src/build/router/**` (`prerender.ts`, `route-list.ts`, `scaffold.ts`) | Vite/router build-time integration, not CLI |
| `src/build/vite/**` | The Vite plugin itself |
| `src/config/**`, `src/shared/**`, `src/theme/**`, `src/mdx/**`, `src/system/**`, `src/features/home/**`, `src/plugins/**` | The library surface — config schema, `defineFeature`, theme tokens, MDX pipeline, the home feature, plugin types. None of this is CLI code and none of it changes in this RFC |
| `src/locales/define.ts`, `src/locales/en.ts`, `src/locales/ru.ts`, `src/locales/registry.ts` | The locale *data* and `defineLocale` — used at runtime by the site, not CLI-specific |
| `src/locales/template.ts` — but **only** `renderLocaleTemplate` and `warnMissingLocales` | Pure functions with no CLI argument parsing in them; kept because they're referenced from build-time code paths that have nothing to do with `consify-cli` (`warnMissingLocales` runs as part of the Vite plugin's own startup warning, not as a CLI command) |
| `skills/**` (the six core skills: `consify`, `consify-theme`, `consify-translate`, `consify-upgrade`, `consify-content-audit`, `consify-extension-engineering`) | These are skill *content*, not CLI code — they stay physically inside the `consify` package (as they already do today) and are still discovered the same way, just from a different reader (see "resolving consify's own skills/ folder" below) |

## What moves to `packages/cli` (`consify-cli`)

Everything else `design/01` through `design/06` already listed: the whole `cli/` tree, the whole
`registry/` tree, `deploy/**` wholesale, `colors.ts`, `doctor.ts`, `docs-command.ts` +
`docs-check.ts`, `skill-command.ts`, `lang-command.ts`, `links-command.ts`, `serve-socket.ts`, and
the CLI-facing half of `locales/template.ts` (renamed `locale-command.ts` in its new home, to avoid
implying it's the same file as the one that stays behind in `consify`).

### Splitting `locales/template.ts`

Today's single file has two unrelated things in it: `renderLocaleTemplate(config, lang)` (a pure
string-building function, called both by `consify locale <lang>` AND — separately — by
`create-consify`'s scaffolding for a language with no built-in strings) and
`runLocaleCommand(args, cwd)` (the CLI wrapper: argument parsing, file-exists check, calling
`renderLocaleTemplate`, printing the result). The split:

- `packages/core/src/locales/template.ts` keeps `renderLocaleTemplate` and `warnMissingLocales`,
  loses `runLocaleCommand` (and its `languagePattern` regex constant, which moves with it since
  nothing else uses it).
- `packages/cli/src/locale-command.ts` is a new file: `import { renderLocaleTemplate } from
  "consify"` (public export, already exported from `consify`'s main entry — verify at
  implementation time whether it's currently exported from `consify/node` or `consify`'s root
  export; move it to whichever one already makes sense, or add it to the root export if it isn't
  exported anywhere yet — check `packages/core/src/index.ts` and `packages/core/src/node.ts`
  first), then the exact `runLocaleCommand`/`registerLocaleCommand` logic from `design/01`'s table.

### Resolving consify's own `skills/` folder from a different package

Today's `skill-command.ts` (inside `packages/core`) finds its own core skills with:

```ts
const root = packageDir({ dir: import.meta.url }); // resolves to packages/core's own root
const skillsDir = join(root, "skills");
```

Once `skill-command.ts` lives in `packages/cli`, `import.meta.url` there resolves to *that*
package's own directory, which has no `skills/` folder of its own — `consify-cli` ships no skills
itself (the "core" skills are conceptually about the `consify` library, not about the CLI tool, and
stay attributed to the `consify` package in the lockfile-equivalent `.consify-skills.json` manifest,
matching what `design/... ` — actually this is pre-existing behavior from the already-shipped skill
system, not part of this RFC — unchanged output, just a different code path to get there). The fix:

```ts
// packages/cli/src/skill-command.ts
import { createRequire } from "node:module";

function coreSkillsRoot(cwd: string): string | undefined {
  try {
    const require = createRequire(pathToFileURL(join(cwd, "package.json")).href);
    return dirname(require.resolve("consify/package.json")); // resolves the PROJECT's installed
                                                               // consify, not consify-cli's own
  } catch {
    return undefined; // consify isn't installed in this project — no core skills to sync, not an error
  }
}
```

This resolves `consify` from the **project being operated on** (`cwd`), not from `consify-cli`'s own
`node_modules` — the same resolution direction `packageDir`/`resolveFeatureFile` already use
elsewhere in the codebase for feature packages, just applied here to find the core library's own
`skills/` folder instead of a feature's. If `consify` somehow isn't resolvable from the project
(a broken install), `coreSkillsRoot` returns `undefined` and `skill-command.ts` treats that exactly
like "no core skills to sync" rather than throwing — a project mid-`bun install` or with a corrupted
`node_modules` should not make `consify skill sync` crash, just do less.

### Naming collision: `registry.ts` (deploy targets) vs `registry/` (the new feature)

`packages/core/src/build/deploy/registry.ts` (existing, exports `deployTargets`/`findTarget` — the
list of deploy targets like `githubPages`/`docker`/`nginx`) and the new `packages/cli/src/registry/`
directory (the shadcn-style item registry) share the word "registry" for two unrelated concepts once
they're both inside `packages/cli`. This is confusing enough to fix at move time, not leave as a
future cleanup:

**Decision: rename the deploy-targets file.** `packages/cli/src/deploy/registry.ts` →
`packages/cli/src/deploy/targets-list.ts` (exports stay named `deployTargets`/`findTarget` — only
the filename changes), updating its one import site (`packages/cli/src/deploy/command.ts`'s `import
{ deployTargets, findTarget } from "./registry.ts"` → `from "./targets-list.ts"`) and its own test
file's import if `deploy.test.ts` imports directly from the file path rather than through
`command.ts`. Not renaming the new `registry/` folder, since "registry" is this RFC's own subject and
every design file already refers to it that way throughout — renaming the long-established,
unrelated file is the smaller, less confusing change.

### Test migration

Every test file that exercises a moved command moves with it, unchanged in content except import
paths (which shrink, since they're now relative to `packages/cli/test/` importing from
`packages/cli/src/...` instead of `packages/core/test/` importing from `packages/core/src/...` — the
relative depth is the same, `../src/...`, so in practice most import lines don't even need to change
text, just the file's location does):

- `packages/core/test/deploy.test.ts` → `packages/cli/test/deploy.test.ts`
- `packages/core/test/docs-check.test.ts` → `packages/cli/test/docs-check.test.ts`
- `packages/core/test/skill.test.ts` → `packages/cli/test/skill.test.ts` (**and** its fixture
  directory, `packages/core/test/fixtures/skill-feature/` → `packages/cli/test/fixtures/skill-feature/`
  — the fixture's own `feature.ts` imports `defineFeature` from a relative path into
  `packages/core/src/shared/feature.ts` today; once the fixture moves to `packages/cli/test/`, that
  import must become `import { defineFeature } from "consify"` (the public export) instead of a
  relative path reaching across package boundaries into `packages/core/src/` — reaching into
  another package's `src/` via a relative path from `packages/cli` would work at test time in this
  monorepo but is exactly the kind of implicit coupling a real package boundary should not have)
- `packages/core/test/links.test.ts` → `packages/cli/test/links.test.ts` — **verify at
  implementation time** whether this file tests `runLinksCommand` (CLI, moves) or `linkCatalog`
  directly (library code in `packages/core/src/shared/catalog.ts`, stays) — the earlier design
  session's summary suggests `linkCatalog`/`primaryLinks`/`resolveHref`/nav helpers are core library
  code that stays in `packages/core`, so `links.test.ts` may need to **split** into a part that stays
  (testing `linkCatalog` etc.) and a part that moves (testing `runLinksCommand`'s CLI output
  formatting) — read the actual current file before assuming it's a clean one-file move
- `packages/core/test/lang.test.ts` → likely also a **split**, for the same reason: `languageFiles`/
  `languageStatus` (pure functions, `design/01`'s table lists `lang-command.ts` moving wholesale, but
  re-check at implementation time whether any of its exports are consumed by non-CLI code — the
  RFC's earlier design session summary lists `languageFiles, languageStatus, runLangCommand` as
  three exports from the same file today; if nothing outside the CLI imports the first two, the
  whole file moves cleanly and this split does not apply — **this is a verify-first-then-move task**,
  not a foregone conclusion, and `tasks.md` must list it as such)
- `packages/core/test/locales.test.ts` → **split**: whatever tests `renderLocaleTemplate`/
  `warnMissingLocales` stays in `packages/core/test/`, whatever tests `runLocaleCommand` moves to
  `packages/cli/test/locale-command.test.ts`

The general rule for every "moves wholesale" entry above: **verify no other package currently
imports the moving file's exports before moving it** — this design was written from the codebase as
understood during this RFC's own drafting session, not from a fresh read of every current import
site; `tasks.md`'s Phase 1 explicitly starts with a grep-based verification pass for exactly this
reason, before any file is actually moved.

## Dependency wiring

`packages/cli/package.json`:

```json
{
  "name": "consify-cli",
  "type": "module",
  "bin": { "consify": "./bin/consify" },
  "dependencies": {
    "consify": "workspace:*",
    "commander": "^14.0.0",
    "zod": "4.6.5",
    "@react-router/express": "8.4.0",
    "compression": "^1.8.1",
    "express": "^5.2.1",
    "morgan": "^1.10.1"
  }
}
```

(`zod`'s exact pinned version should match whatever `packages/core/package.json` currently pins, to
avoid two different zod versions in one project's dependency tree — check at implementation time.)

`packages/core/package.json` **removes**: `@react-router/express`, `compression`, `express`,
`morgan` (and their `@types/*` devDependencies) — these were added to `consify` specifically for
`serve-socket.ts`, which is moving out. This is a genuine, concrete size reduction for every project
that installs `consify` but not `consify-cli` — not expected to be a common case in practice (nearly
everyone wants the CLI), but it is the correct dependency graph regardless, and it means
`consify`'s own `bun install` in this monorepo gets lighter too.

`packages/core/package.json`'s `bin` field is **removed entirely** — `consify` stops shipping an
executable; `consify-cli` is the only package with one.

## `create-consify` changes

`packages/create-consify/src/template.js`'s `renderPackageJson` (and
`packages/create-consify/scripts/prepare-template.ts`'s dependency-version-resolution loop, which
today does `name.replace(/^consify-/, "")` to find each workspace package's own directory to read its
published version from) both need to add `consify-cli` to the generated project's `dependencies`
alongside `consify`. Concretely, in `prepare-template.ts`:

```ts
// today:
const dir = name.replace(/^consify-/, ""); // "consify-blog" -> "blog", finds packages/blog
// consify-cli needs the same treatment: "consify-cli" -> "cli", finds packages/cli — this already
// works with the existing regex, IF packages/cli/package.json's name is exactly "consify-cli" and
// the folder is exactly packages/cli (both true per this design) — verify this at implementation
// time rather than assuming, since it is exactly the kind of one-off naming mismatch that silently
// breaks a regex-based convention
```

The generated `docs.config.ts` template (`renderConfig` in `template.js`) does not change — nothing
about `import { defineConfig } from "consify"` or `import { docs } from "consify-docs"` changes,
since those are `consify`/`consify-docs` imports, not CLI-related.

The generated project's `package.json` **scripts** also don't change
(`"dev": "consify dev"`, etc.) — they call the `consify` *command* (a bin name), which is still
called `consify`, just now provided by a different underlying npm package. This is the whole point
of keeping the bin name stable across the split: **zero visible change for anyone typing `consify
<command>`**, only the dependency graph one level below that is different.

## What `consify-cli` no longer needs to export publicly

Today, `consify/node` exports `runDeployCommand`, `runDoctorCommand`, `runDocsCommand`,
`runSkillCommand`, `runLangCommand`, `runLinksCommand`, `runLocaleCommand`, `runServeSocketCommand`,
plus the deploy-target types (`DeployContext`/`DeployFile`/`DeployTarget`) and `deployTargets`/
`findTarget`. Every one of these existed as a public export **only** so `bin/consify` (a separate
file within the same package, importing across the `consify/node` subpath export boundary rather
than a plain relative import — see the historical reason in the file's own top comment: "The other
commands ... run inside this process, see `consify/node`") and the test suite could reach them.

Once `bin/consify`, the command implementations, and their tests **all live in the same package**
(`consify-cli`), there is no package boundary between them to cross — `bin/consify` and
`cli/program.ts` import `registerDeployCommand`/etc. via plain relative imports
(`../deploy/command.ts`), and tests import via plain relative imports too
(`../src/deploy/command.ts`). **None of these need to be re-exported from any public subpath of
`consify-cli` at all** — `consify-cli`'s `package.json` `exports` field can be just
`{ "./package.json": "./package.json" }` (needed for `consify --version`'s own package
introspection, and for `consify skill sync`'s doctor-adjacent version checks) with no importable
JS export subpath, since nothing outside the package ever needs to `import` from `consify-cli` — it
is consumed exclusively as a CLI binary. This is the "cleaner public surface" benefit named in
Motivation, made concrete.

## Edge cases specific to the split

- **A project has `consify` installed but not `consify-cli`** (e.g. someone removed it, or an old
  lockfile). Running `consify <anything>` fails at the shell level with "command not found" (no bin
  named `consify` is registered) — this is a clear, if slightly unusual-looking, failure mode; no
  special detection/error message is designed for it in this RFC (it's the same failure shape as
  removing any CLI tool's package while keeping its library), but worth a one-line mention in the
  eventual user-facing docs for this change (`tasks.md`'s docs-update task should cover it).
- **`consify-cli`'s installed version is older than `consify`'s, or vice versa** — `consify doctor`
  (which moves to `consify-cli`) already checks that every `consify-*` package (a list currently
  hardcoded as `["consify", "consify-docs", "consify-blog", "consify-api-reference"]` in
  `doctor.ts`) is the same version; this list must gain `"consify-cli"` as part of the move, so a
  version mismatch between `consify` and `consify-cli` themselves is caught by the exact same
  mechanism that already catches a `consify-docs`/`consify-blog` mismatch today — do not special-case
  this, just add the string to the existing list.
- **Someone imports `consify/node`'s `runDeployCommand` etc. from outside this monorepo today**
  (a real external consumer, if any exist by the time this ships) — this is a breaking change for
  them, full stop. Not mitigated in this RFC (no re-export shim left behind in `consify/node`
  pointing at `consify-cli`, since that would require `consify` to depend on `consify-cli`, inverting
  the dependency direction this whole split exists to establish). Flagged as a real breaking change
  to call out in the CHANGELOG entry `tasks.md`'s final phase writes, not something to design around
  silently.
