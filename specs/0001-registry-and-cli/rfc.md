# RFC 0001 — A shadcn-style registry for consify, and a full CLI migration to commander + zod

Status: Draft, approved for implementation by the user 2026-09-29.

## Document map

| File | What's in it |
| --- | --- |
| `rfc.md` (this file) | Summary, motivation, use cases, architecture, non-goals, open questions |
| `design/01-cli-framework.md` | commander + zod migration: how every existing command moves over without breaking its tests |
| `design/02-registry-schema.md` | `registry.json` / `registry-item.json` — the Zod schemas, exact shape, validation rules |
| `design/03-registry-config-and-sources.md` | `consify.registries.json`, namespace resolution, private registries (auth) |
| `design/04-add-and-remove.md` | `consify add` / `consify remove` — the actual install/uninstall algorithm, `registryDependencies`, npm deps |
| `design/05-lockfile.md` | `consify.registry-lock.json`, modification detection, `consify registry list` / `consify list` |
| `design/06-item-types.md` | Per-type handling: `component`, `plugin`, `feature`, `skill`, `theme` — where files land, edge cases specific to each |
| `design/07-package-split.md` | **Read this before any other design file** — the whole CLI and the registry move into a new package, `packages/cli` (npm name `consify-cli`), separate from the `consify` core library. Every file path in `design/01` through `design/06` written as `packages/core/src/build/...` must be read as `packages/cli/src/...` unless `07-package-split.md`'s "what stays in `consify`" table says otherwise |
| `tasks.md` | Phased implementation plan, one task per file/module, dependencies between tasks |

**Amendment (added after `design/01`–`design/05` were drafted, before `design/06`/`tasks.md`):** the
CLI (every command, not just the registry ones) and the whole registry system move into a new
package, `packages/cli`, instead of living inside `packages/core`. This was decided mid-spec, so
`design/01` through `design/05` still say `packages/core/src/build/cli/...` and
`packages/core/src/build/registry/...` in their code samples and prose — every such path should be
read as `packages/cli/src/...`. **`design/07-package-split.md` is the authority on exact paths**;
where it disagrees with an earlier file's path, `07` wins. Nothing about the *logic* in `design/01`
through `design/05` changes because of the split — only *which package* the files listed there live
in.

## Summary

Two things ship together, because the second cannot be built well without the first:

1. **A full migration of the `consify` CLI from hand-rolled argument parsing to [commander](https://github.com/tj/commander.js) for command/argument parsing and [zod](https://zod.dev) for validating the parsed options** — every existing command (`dev`, `build`, `start`, `typegen`, `locale`, `links`, `lang`, `deploy`, `doctor`, `docs`, `skill`) moves to this framework, not just the new ones.
2. **A registry system modeled on [shadcn/ui's registry](https://ui.shadcn.com/docs/registry)**: `consify add <specifier>` fetches a JSON description of a component/plugin/feature/skill/theme recipe from anywhere on the web and writes its files into the project — no npm package, no `bun add`, just files copied in, the same way `npx shadcn add button` does today for shadcn/ui.

## Motivation

consify has real places a project extends it (`custom/components/`, `custom/plugins/`, `custom/features/<id>/`, and now `custom/features/<id>/skill/`), but right now the only way to get someone else's ready-made component/plugin/feature is to manually copy files out of their repository. There is no lightweight distribution mechanism that doesn't require publishing and depending on a real npm package (with its own versioning, its own `bun add`, and — as the user found out this session — real friction around registering an npm scope/organization for a small or personal project).

A registry closes that gap the way shadcn/ui closes it for UI primitives: static JSON, no server, no npm publish, and a CLI command that copies the source directly into the consumer's project so they own and can edit the code from the moment it lands.

The CLI migration is not optional scope creep bolted onto the registry — it is what the user asked for directly, and it is the right foundation to build the registry's own commands on: consistent argument parsing, consistent `--help` text, and one validation layer (zod) instead of every command hand-rolling its own `args.includes("--force")` / `args.indexOf("--name")` logic (see the current `packages/core/src/build/deploy/command.ts`, `packages/core/src/build/lang-command.ts`, `packages/core/src/locales/template.ts` for examples of the pattern being replaced).

## Use cases

1. **A user wants a ready-made "since" badge component someone published.** They run `consify add https://example.com/r/since-badge.json`. The CLI fetches the JSON, sees it is a `registry:component`, writes `custom/components/Since.tsx`, and reports what it wrote.

2. **A user wants to use several components from the same third-party author regularly**, not paste a full URL every time. They run `consify registry add-source @acme https://acme.dev/r/{name}.json` once (this is a *template* URL — `{name}` is substituted per item), which writes an entry into `consify.registries.json`. From then on, `consify add @acme/pricing-card` resolves through that template.

3. **A user wants the official, first-party consify registry's item.** `consify add consify-getting-started-banner` (a bare name, no `@namespace`) resolves against the one registry marked `"default": true` in `consify.registries.json` — which `create-consify` seeds pointing at `https://consify.shiz-ceo.ru/r/{name}.json` — the official catalog hosted on the docs site itself (built from `apps/docs`, see `design/02-registry-schema.md`).

4. **A company has an internal registry of proprietary components behind auth.** They run `consify registry add-source @internal https://ui.company.internal/r/{name}.json --header "Authorization: Bearer ${COMPANY_REGISTRY_TOKEN}"`. The literal string `${COMPANY_REGISTRY_TOKEN}` (not a real secret) is what's written to `consify.registries.json` — safe to commit — and at fetch time consify resolves it from `process.env.COMPANY_REGISTRY_TOKEN`. If that variable isn't set when `consify add @internal/...` runs, the command fails with a clear error naming the missing variable, before making any network request.

5. **An item depends on another item.** A `feature` item `@acme/changelog` declares `registryDependencies: ["@acme/badge"]`. Running `consify add @acme/changelog` installs `@acme/badge` first (if not already installed), then `@acme/changelog`, and both show up in the lockfile with `@acme/changelog` recording that it pulled in `@acme/badge` as a dependency (so `consify remove @acme/changelog` can offer to remove the now-unused dependency too — see `design/04-add-and-remove.md` for the exact removal semantics).

6. **A user re-runs `consify add` for something they already installed, after editing the file themselves.** consify detects (via the lockfile's stored hash of the file at install time) that the on-disk file no longer matches what was installed, and refuses to overwrite without `--force`, the same protection `consify skill sync` already has for its own files.

7. **A user wants to see what's currently installed from registries**, e.get before deciding to clean up. `consify list` reads `consify.registry-lock.json` and prints a table: item name, source registry, files, whether any file was locally modified since install.

8. **A user wants to remove something they no longer use.** `consify remove @acme/pricing-card` looks it up in the lockfile, deletes the files it installed (skipping — with a warning — any file that was locally modified since install, unless `--force`), and removes its lockfile entry. If another installed item still lists it as a `registryDependencies` entry, `consify remove` refuses and names the dependent item, unless `--force`.

9. **A contributor wants to publish their own item without asking anyone's permission.** They write one `registry-item.json` file (schema in `design/02-registry-schema.md`), host it anywhere static (their own domain, a GitHub raw URL, a Gist raw URL, GitHub Pages), and tell people to `consify add <that URL>` directly — no registration, no approval process, exactly like shadcn/ui's own registry model.

10. **Someone runs an existing command exactly as documented today.** `consify deploy github-pages --ci`, `consify lang add ru --copy`, `consify doctor` — all keep working with the exact same flags and output, because the CLI migration is required to be behavior-preserving for every existing command (see Non-goals and `design/01-cli-framework.md`'s compatibility section).

11. **Someone runs a command with a bad flag.** Today, most commands silently ignore an unrecognized flag (`args.includes()` just doesn't match). After the migration, commander reports `error: unknown option '--nam'` with a suggestion (`(Did you mean --name?)`, commander's built-in feature) — this is called out explicitly as an intentional, documented behavior change (see Non-goals) since it is a strict improvement, not a compatibility break in the promised sense (no *valid* invocation changes behavior).

12. **A registry fetch fails (network error, 404, invalid JSON).** `consify add` prints a clear, specific error (which URL, what went wrong) and exits 1. No partial writes: if the top-level item or any of its `registryDependencies` fails to fetch or fails schema validation, nothing is written to disk for the whole `add` invocation (all-or-nothing, detailed in `design/04-and-remove.md`).

## Architecture

### Component map

**Superseded by the amendment above** — every `packages/core/src/build/...` path below except
`deploy/command.ts`'s neighbors that explicitly stay put (there are none — the whole `cli/` and
`registry/` trees, and every existing command file, move to `packages/cli/src/...`) should be read
that way. This diagram is kept as originally drafted because it still correctly shows *how the
pieces relate to each other*; `design/07-package-split.md` has the corrected, authoritative path for
every single file, plus the handful of files/exports that stay in `packages/core` (mainly
`build/load-config.ts`, `build/feature-node.ts`, and the pure render functions in
`locales/template.ts` — `consify-cli` imports these from the `consify` package rather than owning
them, since other packages need them too).

```
packages/core/
├─ bin/consify                          thin entry point: builds and runs the commander program
├─ src/build/
│  ├─ cli/
│  │  ├─ program.ts                     builds the root Command, registers every subcommand
│  │  ├─ legacy-run.ts                  the runXCommand(args, cwd) compatibility wrapper factory
│  │  ├─ spinner.ts                     hand-rolled animated spinner (extends colors.ts's approach)
│  │  └─ errors.ts                      CliError class + shared error formatting/exit-code mapping
│  ├─ registry/
│  │  ├─ schema.ts                      zod schemas: RegistryIndex, RegistryItem, item-type unions
│  │  ├─ config.ts                      reads/writes consify.registries.json, namespace resolution
│  │  ├─ resolve.ts                     specifier parsing (URL vs @ns/name vs bare name)
│  │  ├─ fetch.ts                       HTTP fetch + auth header interpolation + schema validation
│  │  ├─ write.ts                       per-item-type file placement (delegates to item-types.ts)
│  │  ├─ item-types.ts                  the 5 type handlers: component/plugin/feature/skill/theme
│  │  ├─ lockfile.ts                    reads/writes consify.registry-lock.json, hash comparison
│  │  ├─ add.ts                         `consify add`: orchestrates resolve→fetch→deps→write→lock
│  │  ├─ remove.ts                      `consify remove`: orchestrates lockfile lookup→dep check→delete
│  │  ├─ sources.ts                     `consify registry add-source/remove-source/list-sources`
│  │  └─ list.ts                        `consify list` / `consify registry list` (installed items)
│  ├─ deploy/command.ts                 (existing, refactored: zod schema + commander Command + legacy wrapper)
│  ├─ doctor.ts                         (existing, refactored the same way)
│  ├─ docs-command.ts                   (existing, refactored the same way)
│  ├─ skill-command.ts                  (existing, refactored the same way)
│  ├─ lang-command.ts                   (existing, refactored the same way)
│  ├─ links-command.ts                  (existing, refactored the same way)
│  └─ serve-socket.ts                   (existing; gains a proper commander option definition for `start --socket`)
├─ src/locales/template.ts              (existing runLocaleCommand, refactored the same way)
└─ src/node.ts                          exports every runXCommand (unchanged surface) + new registry exports
```

### How a request flows: `consify add @acme/pricing-card`

```
bin/consify
  → cli/program.ts's root Command parses argv
  → the "add" Command's .action() runs (options already zod-validated)
  → registry/add.ts: runAddCommand(options, cwd)
      → registry/resolve.ts: parses "@acme/pricing-card" → { namespace: "@acme", name: "pricing-card" }
      → registry/config.ts: reads consify.registries.json → template URL for "@acme"
      → resolve.ts: substitutes {name} → concrete URL
      → registry/fetch.ts: GET the URL (+ auth headers if configured), zod-parses as RegistryItem
      → for each entry in item.registryDependencies (if any): recurse into the same
        resolve → fetch step (cycle detection via a Set of in-flight specifiers)
      → registry/lockfile.ts: for every item about to be written, check if already installed
        and if its files' on-disk hashes still match the lockfile (skip if unchanged and same
        version; refuse without --force if changed)
      → registry/write.ts → item-types.ts: for each item, dispatch on `type` to know where files go
      → if item.dependencies (npm packages) is non-empty: spawn `bun add <deps>` (or the detected
        package manager), with cli/spinner.ts showing progress
      → registry/lockfile.ts: write one lockfile entry per installed item (files + hashes + source)
      → print a summary: what was written, what npm deps were added, what's next
```

### The compatibility-preserving CLI migration, in one paragraph

Every existing `runXCommand(args: readonly string[], cwd: string): Promise<number>` export in `consify/node` keeps that exact signature. Internally, each one becomes a thin wrapper (`cli/legacy-run.ts` provides a `makeLegacyRunner(command: Command)` helper) that builds a **fresh** commander `Command` per call (commander `Command` instances are not safely reusable across parses), calls `.exitOverride()` so a parse error throws a `CommanderError` instead of calling `process.exit`, `parseAsync(["node", "consify", ...args], { from: "user" })`, and catches `CommanderError` to convert it into the existing `console.error(...); return 1` shape every command already uses. This means **zero changes are required to any existing test file** that calls `runDeployCommand(["deploy", "--name", "x"], cwd)` and asserts on stdout/exit code — the observable behavior for every valid invocation is unchanged, and it is a hard requirement of this RFC that it stays that way (see `design/01-cli-framework.md` for the exact code and a table of every current flag mapped to its new zod-validated commander option).

### Why commander (and not a hand-rolled parser, and not a different library)

Alternatives considered:

- **Keep the hand-rolled `option(args, name)` pattern**, just formalize it — rejected: this is what the user explicitly asked to move away from ("будем использовать commander + zod для валидации команд"), and it does not give free `--help` generation, typo suggestions, or a real subcommand tree, all of which the registry commands benefit from immediately (`consify registry add-source`, `consify registry remove-source`, `consify registry list`, `consify registry list-sources` — a real nested subcommand structure).
- **yargs** — more features than needed, heavier, and its TypeScript types are a worse fit for deriving zod schemas from than commander's simpler `.option()`/`.argument()` model.
- **citty / cac** — smaller and modern, but far less established (commander is what shadcn's own CLI is built on, which is a relevant precedent given the whole registry idea is modeled on shadcn).

commander is the pick: it is the de facto standard, shadcn/ui's own CLI uses it (so the registry-side code has a real precedent to mirror for `add`/subcommand ergonomics), and it composes cleanly with zod by treating commander purely as "parse strings into a loosely-typed options object" and zod purely as "validate and produce the final typed options" — a clean separation kept throughout this RFC (commander never does type coercion beyond what `.option()` already offers; zod schemas do everything else, including cross-field validation commander cannot express, like "`--socket` and a positional `PORT` env fallback are mutually exclusive").

### Why the file-content-inline registry-item format (not URLs per file)

Considered and rejected: **one URL per file** inside `registry-item.json` (`files: [{ path, url }]` instead of `{ path, content }`). This was rejected per explicit user decision: fewer network round-trips per `consify add` (one request instead of N+1), atomic (either the whole JSON parses and validates or nothing does — no partial download leaving some files fetched and others not), and it matches what shadcn/ui itself does. The trade-off — a registry item's JSON file is less pleasant to hand-edit since file content sits inside a JSON string — is accepted because registry items are expected to be generated by tooling (a `consify registry pack` command is listed as a *possible* future addition in Non-goals, not built now) more often than hand-written.

### Why `consify.registries.json` as a separate file (not a `docs.config.ts` field)

Considered and rejected: a `registries` field inside `docs.config.ts`'s schema. Rejected per explicit user decision, for a concrete reason beyond preference: `docs.config.ts` is loaded through `loadConfig()` (`packages/core/src/build/load-config.ts`), which either does a direct Node `import()` or falls back to spinning up a full Vite SSR server when the config imports something Node can't run directly. Every registry command (`add`, `remove`, `list`, `registry add-source`, ...) would then pay that cost (up to a Vite server boot) just to read a small namespace-to-URL map, and — worse — *writing* to it (e.g. `registry add-source` persisting a new entry) means round-tripping through a TypeScript AST or asking the user to hand-edit a `.ts` file, neither of which fits the "CLI writes it for you" ergonomics `registry add-source` is supposed to have. A plain JSON file is trivial to read and write directly with `readFileSync`/`writeFileSync`+`JSON.parse`/`stringify`, with no config-loading machinery involved, mirroring exactly how `consify.registry-lock.json` already needs to work.

### CLI animation (the "анимация" ask)

A small hand-rolled spinner (`cli/spinner.ts`), consistent with the project's existing preference for zero-dependency terminal output (see `packages/core/src/build/colors.ts`, which deliberately avoids a color library). It:

- Cycles through a small frame set (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, the same braille spinner frames used by most modern CLI tools including npm/pnpm/shadcn's own `ora`-based spinner) on a `setInterval`, writing `\r` + frame + message to `process.stdout`.
- Is a complete no-op (prints one static line, no interval, no `\r` cursor tricks) when `!process.stdout.isTTY` or `NO_COLOR` is set — exactly the same guard `colors.ts` already uses, so CI logs and piped output stay clean single lines instead of filling with carriage-return garbage.
- Used during: fetching a registry item or its dependencies (`Fetching @acme/pricing-card...`), running the package manager install step (`Installing 2 packages...`), nothing else — deploy/doctor/docs/skill/lang commands are not changed to use it, since they are fast, local, file-only operations with nothing worth animating (only the registry's network/subprocess steps have meaningful wait time).
- Full API and implementation are in `design/01-cli-framework.md`.

## Non-goals (explicitly out of scope for this RFC)

- **A hosted/managed registry index or approval process.** Anyone can host their own `registry.json` and share the URL; there is no central "npm-of-registries" that reviews or lists third-party ones (mirrors shadcn/ui's own model — see the RFC's motivation section).
- **A visual catalog/browsing page on the consify docs site** (e.g. `consify.shiz-ceo.ru/registry` listing the official items with previews). Valuable, but it is a docs-site feature built on top of a `registry.json` that already exists — sequencing it after the registry mechanism ships is the right order, not a reason to block this RFC. Tracked as a follow-up, not designed here.
- **`consify registry pack`** (a command to turn a folder of real files into a `registry-item.json`, for authors). Also valuable, also a natural follow-up once the format is stable, not built now — authors write `registry-item.json` by hand or with their own tooling for the first version.
- **Semantic versioning of registry items** (an item declaring `1.2.0`, `consify add` resolving version ranges, `consify update` doing a version-aware diff). The lockfile records a plain content hash for drift detection (design/05-lockfile.md), not a version number with range semantics — this is a deliberate simplification; "the file changed on the server" and "the file changed locally" are the only two states tracked.
- **Automated editing of `docs.config.ts`** for `theme`-type items (see `design/06-item-types.md`) — consify never parses/rewrites the user's own TypeScript config file; a theme item prints instructions instead of attempting an AST edit, which was explicitly rejected as too fragile/risky for a file that is hand-maintained source of truth.
- **Publishing consify's own packages to a scoped npm name or GitHub Packages.** That is the separate, already-resolved conversation about `@shiz-ceo/*` naming — unrelated to this RFC and not blocked by it or blocking it.
- **Changing what `dev`/`build`/`typegen` actually run.** The CLI migration changes *how their arguments are parsed and dispatched*, never what `@react-router/dev`/`@react-router/serve` binary gets spawned or with what arguments once parsed — behavior-preserving, as stated in Use case 10.
- **Removing or renaming any existing flag.** Every flag documented today (`--copy`, `--missing`, `--force`, `--ci`, `--socket`, `--domain`, `--name`, `--path`, `--port`, `--languages`, `--strict`) keeps its exact name and meaning after the migration.

## Open questions

These were not blocking enough to hold up writing this spec, but should be resolved (by the user, or by whoever implements a later phase) before the affected phase starts:

1. **Where does the *official* registry's content actually live and get built from?** Use case 3 assumes `https://consify.shiz-ceo.ru/r/{name}.json` exists, served from `apps/docs/public/r/`. This RFC's Phase 6 (see `tasks.md`) only adds the *mechanism* (a `consify.registries.json` seeded by `create-consify` pointing at that URL, and the fetch/add code that would consume it) — it does not commit to writing any real official items yet, since Non-goals excludes committing to specific registry content. Someone needs to decide what the first 2-3 official items actually are before Phase 6's seed file is meaningful (a placeholder `registry.json` with zero items is a valid, honest starting point).
2. **Should `consify remove`'s "another item depends on this" check also walk `dependencies` (npm packages), not just `registryDependencies`?** Current design (`design/04-and-remove.md`) only tracks registry-level dependencies for this check; npm packages added by an item are never automatically removed by `consify remove` even if nothing else uses them (matches how `bun remove` itself does not auto-prune transitive-only packages) — flagged here in case that reads as surprising later.
3. **Rate limiting / caching of registry fetches** — `consify add` always does a live fetch, no local cache of previously-fetched `registry-item.json` bodies. For a `registryDependencies` chain shared across multiple `consify add` invocations in the same session this means re-fetching the same URL. Not designed here; acceptable for v1 given registry items are expected to be small JSON files, not a performance concern until proven otherwise.
