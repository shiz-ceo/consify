# Implementation plan

Phases are strictly ordered (each depends on the previous one being fully green — tests, lint,
typecheck — before starting the next), except where a phase explicitly says its tasks can run in
parallel with each other. Every task names its exact files and a concrete "done" criterion, so it can
be handed to an agent on its own.

## Phase 0 — Extract the CLI into `packages/cli`, move nothing else

**Goal**: `consify-cli` exists, contains everything `design/07-package-split.md` lists, behaves
byte-for-byte identically to today's `consify` CLI, and every existing test that exercised the moved
code now lives in `packages/cli/test/` and still passes. **No new functionality (no commander, no
registry) is introduced in this phase** — it is a pure move, verified by the fact that nothing about
`bin/consify`'s behavior changes for any existing command.

### Task 0.1 — Verify import sites before moving anything

Grep the whole monorepo (`packages/`, `apps/`, `scripts/`) for every symbol
`design/07-package-split.md`'s "what moves" list names, to confirm no non-CLI code imports them
today: `runDeployCommand`, `runDoctorCommand`, `runDocsCommand`, `runSkillCommand`, `runLangCommand`,
`runLinksCommand`, `runLocaleCommand`, `runServeSocketCommand`, `deployTargets`, `findTarget`,
`DeployContext`, `DeployFile`, `DeployTarget`, `languageFiles`, `languageStatus`, and everything
`packages/core/src/build/colors.ts` exports. Also specifically re-read
`packages/core/test/links.test.ts` and `packages/core/test/lang.test.ts` in full to determine whether
they test only CLI entry points (whole file moves) or also pure library functions like `linkCatalog`
(file splits — see `design/07`'s test-migration section). Record findings as a short checklist
comment at the top of this task before proceeding — if anything unexpected imports one of these
symbols from outside the CLI, stop and reconsider before moving it (this task exists specifically to
catch that before Task 0.3 physically moves files).

**Done when**: a written list exists (in the PR description or a scratch file, not part of the
final diff) confirming for each symbol above either "only used by the CLI/tests, safe to move
wholesale" or "also used elsewhere, needs a split" with the specific other use site named.

### Task 0.2 — Scaffold `packages/cli`

Create `packages/cli/package.json` (per `design/07`'s dependency table), `packages/cli/tsconfig.json`
(copy `packages/core/tsconfig.json`'s shape, adjust paths), `packages/cli/tsconfig.build.json` (copy
`packages/core/tsconfig.build.json`'s shape verbatim except `rootDir`/`outDir`, which already match
the existing convention other packages use). Add `packages/cli` to the root `package.json`'s bun
workspace globs if they are an explicit list rather than a `packages/*` glob (check
`package.json`'s `"workspaces"` field first — if it's already `["packages/*", "apps/*", "e2e"]` or
similar, no change is needed here at all).

**Done when**: `bun install` at the repo root succeeds with the new empty package present, and
`bun run --filter consify-cli typecheck` runs (even with zero source files yet, an empty `src/`
with just a placeholder or the tsconfig alone should produce a clean, trivial pass — adjust the
`typecheck` script to tolerate an empty src if needed).

### Task 0.3 — Move deploy/**, colors.ts, doctor.ts, docs-command.ts, docs-check.ts, skill-command.ts, lang-command.ts, links-command.ts, serve-socket.ts

One `git mv` per file/directory from `packages/core/src/build/...` to `packages/cli/src/...`,
per `design/07`'s file tree (including the `registry.ts` → `targets-list.ts` rename for the deploy
target list, and updating its one internal import in `command.ts`). Update every `import` line
inside the moved files that referenced another moved file (most stay identical since relative depth
is unchanged — `./colors.ts`, `../colors.ts` etc. keep working as long as the *relative* structure
between moved files is preserved, which it is). Update every `import` that referenced something that
**stayed** in `packages/core` (`loadConfig`, `packageDir`, `resolveFeatureFile`, `Feature` types) to
import from the `consify` package's public export instead of a relative path reaching across the new
package boundary (e.g. `import { loadConfig } from "consify/node"` instead of
`import { loadConfig } from "../load-config.ts"`).

**Done when**: `packages/core/src/build/deploy/`, `colors.ts`, `doctor.ts`, `docs-command.ts`,
`docs-check.ts`, `skill-command.ts`, `lang-command.ts`, `links-command.ts`, `serve-socket.ts` no
longer exist; their equivalents exist under `packages/cli/src/`; `bun run --filter consify-cli
typecheck` is clean.

### Task 0.4 — Split `locales/template.ts`

Per `design/07`'s exact split: `renderLocaleTemplate`/`warnMissingLocales`/anything else not
CLI-argument-parsing stays in `packages/core/src/locales/template.ts`; `runLocaleCommand`'s body
(argument parsing, file writing, console output) becomes `packages/cli/src/locale-command.ts`,
importing `renderLocaleTemplate` from `consify`.

**Done when**: `packages/core/src/locales/template.ts` no longer exports `runLocaleCommand`;
`packages/cli/src/locale-command.ts` exports it instead; both packages typecheck cleanly.

### Task 0.5 — Rewrite `consify/node`'s export list (`packages/core/src/node.ts`)

Remove every export `design/07` lists as moved (`runDeployCommand`, `deployTargets`, `findTarget`,
`DeployContext`/`DeployFile`/`DeployTarget`, `runDoctorCommand`, `runDocsCommand`, `runSkillCommand`,
`runLangCommand`/`languageFiles`/`languageStatus` (or only `runLangCommand` if Task 0.1 found the
other two are pure and used elsewhere — follow Task 0.1's actual finding, not this task's assumption),
`runLinksCommand`, `runLocaleCommand`, `runServeSocketCommand`). Keep every export `design/07`'s
"what stays" table lists (`defineFeatureNode`, `loadFeatureNode`, `resolveFeatureFile`, `packageDir`,
`loadConfig`, `prerenderPaths`, `enabledRoutes`/`RouteEntry`, `scaffoldExtensions`,
`renderLocaleTemplate`, `warnMissingLocales`).

**Done when**: `packages/core/src/node.ts` contains only the "stays" list; `bun run --filter consify
typecheck` is clean (this will surface any remaining internal `consify` code that accidentally
imported one of the removed exports from its own `node.ts` re-export rather than a direct relative
path — fix any such case by switching it to a relative import, since `consify`'s own internal code
should never need to import from its own public subpath export).

### Task 0.6 — Write `packages/cli/bin/consify` (the OLD dispatch logic, not yet commander)

Copy today's `packages/core/bin/consify` content into `packages/cli/bin/consify` verbatim, updating
only the one line that does `await import("consify/node")` for the moved commands — since those
commands are no longer in `consify/node`, change the dispatch to import them via relative paths
within the same package instead (`import { runDeployCommand } from "../src/deploy/command.ts"`,
etc., one per moved command) rather than a dynamic `consify/node` import. **Deliberately do not
introduce commander in this task** — Phase 0's entire point is "move without changing behavior,"
and the commander migration is Phase 1.

**Done when**: `packages/core/bin/consify` is deleted; `packages/cli/bin/consify` exists; running it
manually from a real project produces identical output to today's `packages/core/bin/consify` for
every command (`deploy list`, `doctor`, `docs check`, `skill sync`, `lang status`, `links`,
`locale de`, `--version`, `--help`, `dev`/`build`/`typegen`/`start` still spawn the same way as
before).

### Task 0.7 — Move the tests

Per `design/07`'s test-migration section: move (or split, per Task 0.1's findings)
`packages/core/test/{deploy,docs-check,skill,lang,links,locales}.test.ts` and
`packages/core/test/fixtures/skill-feature/` into `packages/cli/test/`, fixing the fixture's
`feature.ts` to import `defineFeature` from `"consify"` (public export) instead of a relative path.

**Done when**: `bun test packages/cli` passes with every one of these test files present and
green; `bun test packages/core` no longer contains them and still passes (nothing broke in what
stayed behind, in particular any file that Task 0.1 found needed to split rather than move
wholesale).

### Task 0.8 — Update `create-consify` and root scripts for the new package

`packages/create-consify/scripts/prepare-template.ts`'s dependency-version-resolution loop needs
`consify-cli` added to whatever list it iterates (see `design/07`'s note on the existing
`name.replace(/^consify-/, "")` convention already handling this correctly once the package exists at
`packages/cli` with npm name `consify-cli`). Root `package.json`'s scripts that reference
`packages/core/bin` on `PATH` (`"docs"`, `"build:docs"`, `"demo"`, etc. — see the current
`PATH="$PWD/packages/core/bin:$PATH"` pattern) must change to `packages/cli/bin` instead, since that
is where the `consify` executable now lives.

**Done when**: `bun run docs`, `bun run demo`, `bun run build:docs`, `bun run build:demo`,
`bun run --cwd apps/starter dev` all still work (apps/docs, apps/demo, apps/starter's own
`package.json` scripts call bare `consify dev`/`consify build`, resolved via the workspace's
`node_modules/.bin/consify` symlink — bun/npm workspaces regenerate that symlink automatically to
point at whichever package declares the `consify` bin, so these should need **no changes at all**
once `bun install` re-links; verify this assumption by actually running each script, don't just
assume the symlink update is automatic without checking).

### Task 0.9 — Full regression pass

Run `bun run check` (lint + typecheck + `prepare:template` + `bun test packages`), `bun run
check:build`, `bun run check:package` (this one specifically needs its tarball list — currently
`["core", "docs", "blog", "api-reference"]` in `scripts/check-package.ts` — updated to include `cli`,
and its generated project's `package.json` dependency substitution to include the `consify-cli`
tarball alongside `consify`'s), `bun run e2e`.

**Done when**: everything in that list is green, with zero behavior change from before Phase 0 for
any existing command — this is the acceptance gate for the whole phase; do not start Phase 1 until
this task is done.

---

## Phase 1 — The commander + zod migration (inside `packages/cli`, which now exists)

Depends on: Phase 0 complete. Each command in this phase can be migrated independently of the
others (they don't call each other), so the sub-tasks below may be done in any order or in parallel,
but Task 1.1 (the shared framework pieces) must land first since every other task in this phase
depends on it.

### Task 1.1 — The shared CLI framework pieces

Create `packages/cli/src/cli/errors.ts` (`CliError`, `runAction`), `packages/cli/src/cli/spinner.ts`
(the `spinner()` function, per `design/01`), `packages/cli/src/cli/legacy-run.ts`
(`makeLegacyRunner`, per `design/01` — including its exact `chdir`/`exitOverride`/error-catching
behavior). Add `commander` to `packages/cli/package.json`'s dependencies.

**Done when**: these three files exist, typecheck, and have their own unit tests: `spinner.test.ts`
(verify the non-TTY no-op path prints plain lines, since a CI environment's `process.stdout.isTTY`
is `false` — this is the only realistically testable behavior of the spinner without mocking a real
TTY, which is not worth doing for this), `errors.test.ts` (a `CliError` thrown inside `runAction`
returns 1 and prints the message; a plain `Error` re-throws).

### Task 1.2 through 1.8 — Migrate each existing command

One task per row of `design/01-cli-framework.md`'s table (`deploy`, `doctor`, `docs check`, `skill
sync`/`skill list`, `lang add`/`lang status`, `links`, `locale`). For each: add the zod options
schema, the `register*Command(program)` function, refactor the existing logic function to read from
the validated options object instead of hand-parsed `args`, and produce the `run*Command` export via
`makeLegacyRunner`. **The existing test file for that command must pass completely unmodified** — this
is the literal acceptance criterion per task, checked by running that one test file before and after
the change and diffing nothing but pass/fail status (not the file itself, which shouldn't change at
all).

**Done when** (per task): the specific test file for that command (`deploy.test.ts`,
`skill.test.ts`, `docs-check.test.ts`, `lang.test.ts`, `links.test.ts`,
`locale-command.test.ts`) is unmodified from Phase 0's end state and still fully passes; manually
running `node packages/cli/bin/consify <command> --help` against a real project prints sensible,
commander-generated help text (this is new — Phase 0's old dispatch had no `--help` per subcommand,
only the top-level usage string — call out any command whose new `--help` output looks wrong or
confusing during this task, it's a sign the `.option()`/`.description()` calls need better wording,
not a sign of a functional bug).

### Task 1.9 — `dev`/`build`/`typegen`/`start` as commander commands

Create `packages/cli/src/cli/spawn-commands.ts` per `design/01`'s `registerSpawnCommands` sketch,
including `start`'s `--socket` handling (replacing today's manual `args.indexOf("--socket")` in
`bin/consify` with a real commander option, per `design/01`).

**Done when**: `consify dev`, `consify build`, `consify typegen` forward every argument to the
underlying `@react-router/dev` binary exactly as before (test by comparing `consify dev --port 3000
--host` output/behavior before and after — should spawn the identical child process command line);
`consify start` and `consify start --socket /tmp/x.sock` both work exactly as today (re-run the
manual verification from the original `serve-socket.ts` implementation session: start it against a
real built project, curl the socket, confirm 200 and clean shutdown).

### Task 1.10 — `packages/cli/src/cli/program.ts` and the new `bin/consify`

Wire every `register*Command` (from Tasks 1.2–1.9) into `buildProgram()`, per `design/01`'s sketch,
including the custom `--version` handling (every installed `consify-*` package, now including
`consify-cli` itself in the list — see `design/07`'s doctor-list edge case, the same list should be
shared or at least kept in sync between `doctor.ts` and this `--version` handler; consider extracting
the package list `["consify", "consify-docs", "consify-blog", "consify-api-reference", "consify-cli",
"create-consify"]` into one shared constant both read from, to prevent the two lists silently
diverging in the future — a small but real correctness detail). Replace `packages/cli/bin/consify`'s
Phase-0 manual-dispatch content with the two-line `buildProgram().parseAsync(process.argv)` form.

**Done when**: `bun run check` (the whole monorepo's lint/typecheck/test) is green; every command
documented in `apps/docs/content/{en,ru}/docs/v0/reference/cli.mdx` still behaves as documented when
run manually against a real project (`apps/demo` is the natural test bed — it already exercises
docs+blog+api-reference+a custom feature); `consify --help` (no subcommand) prints commander's
auto-generated top-level help listing every command with its one-line description, instead of the
old flat usage string.

---

## Phase 2 — Registry schema and configuration

Depends on: Phase 1 complete (needs the CLI framework to register commands against). Tasks 2.1 and
2.2 can be done in parallel; 2.3 depends on both.

### Task 2.1 — `registry/schema.ts`

Per `design/02-registry-schema.md` in full: `registryItemTypes`, `registryItemFileSchema` (with the
path-traversal `.refine`), `registryItemSchema` (with the `featureId`-required `.superRefine` and
the duplicate-path `.refine` noted in that design doc's edge cases), `registryIndexEntrySchema`,
`registryIndexSchema`, `parseRegistryItem`.

**Done when**: a test file `registry-schema.test.ts` covers: a minimal valid `component` item
parses; a `feature` item without `featureId` fails with a clear message naming the field; a `skill`
item without `featureId` fails the same way; a file `path` containing `..` fails; a file `path`
starting with `/` fails; two files with the same `path` fail; an unknown `type` value fails; the
empty-`files` case fails.

### Task 2.2 — `registry/config.ts`

Per `design/03-registry-config-and-sources.md`: `registrySourceSchema`, `registriesFileSchema` (with
the "at most one default" `.superRefine`), `readRegistriesFile`, `writeRegistriesFile`.

**Done when**: a test file `registry-config.test.ts` covers: reading a nonexistent file returns
`{ registries: {} }`; a valid file round-trips through read/write unchanged; two entries both marked
`default: true` fails validation; an invalid namespace key (not starting with `@`) fails; a `url`
without `{name}` fails.

### Task 2.3 — `registry/resolve.ts`

Per `design/03`: `resolveSpecifier`, `interpolateEnv`, using `replaceAll` (not `replace`) for the
`{name}` substitution per the edge case `design/03` calls out explicitly.

**Done when**: a test file `registry-resolve.test.ts` covers all of `design/03`'s edge cases as
explicit test cases: a full URL passes through unchanged; `@ns/name` with a configured namespace
resolves correctly; `@ns/name` with an unconfigured namespace throws `CliError` listing what *is*
configured; a bare name with a configured default resolves; a bare name with no default configured
throws `CliError`; a header value referencing `${UNSET_VAR}` throws `CliError` naming the variable;
a header value referencing `${SET_VAR}` (set via `process.env` in the test) resolves to the real
value; a template URL with `{name}` appearing twice gets both occurrences replaced (this is the
specific regression test for the `replace` vs `replaceAll` bug called out in `design/03`).

---

## Phase 3 — The install/uninstall engine

Depends on: Phase 2 complete. Tasks 3.1 and 3.2 can run in parallel; 3.3 depends on 3.1; 3.4 and 3.5
depend on 3.2 and 3.3 both.

### Task 3.1 — `registry/lockfile.ts`

Per `design/05-lockfile.md` in full: the schema, `sha256`/`hashFile`, `readLockfile`/`writeLockfile`,
`LockfileHandle` (with `findByPath`), `itemKeyFor`.

**Done when**: a test file `registry-lockfile.test.ts` covers: reading a nonexistent lockfile
returns an empty one; round-trip read/write; `hashFile` produces a stable hash for the same content
written twice; `findByPath` finds an entry by its recorded relative path and returns `undefined` for
an untracked path; an invalid lockfile (bad `version`, malformed entry) throws `CliError`.

### Task 3.2 — `registry/item-types.ts`

Per `design/06-item-types.md` in full: `resolveItemRoot` for all five types, the `skill`-type
feature-existence check (as a separate exported function, `assertFeatureExists` or similar, called
from `write.ts` — see Task 3.3), the `theme`-type print-instead-of-write behavior.

**Done when**: a test file `registry-item-types.test.ts` covers: `resolveItemRoot` returns the
correct path for each of the five types; the `skill`-type check throws `CliError` when the target
feature's `feature.ts` doesn't exist and passes when it does (use a temp directory fixture, same
convention as `packages/core/test/skill.test.ts`'s existing temp-dir + fixture pattern).

### Task 3.3 — `registry/write.ts` and `registry/fetch.ts`

Per `design/04-add-and-remove.md`: `fetchRegistryItem` (network call + validation), the Phase
B conflict-detection logic and Phase C write logic from `add.ts`'s pseudocode, factored into
`write.ts` as the piece `add.ts` (Task 3.4) calls rather than inlined there (the pseudocode in
`design/04` shows it inline for readability; the real implementation should be
`writeItems(toInstall: FetchedItem[], lockfile: LockfileHandle, options: { force: boolean }, cwd:
string): void`, doing exactly Phase B + Phase C, so `add.ts` itself stays focused on Phase A's
resolution/fetch orchestration).

**Done when**: `registry-fetch.test.ts` covers (using a mocked `fetch` — Bun's test runner supports
`spyOn(globalThis, "fetch")` or an injected fetch function; pick whichever the implementer finds
cleaner, but do not make real network calls in tests): a successful fetch + valid JSON parses into
a `RegistryItem`; a non-2xx response throws `CliError` naming the status; invalid JSON throws
`CliError`; JSON that fails schema validation throws `CliError` with the validation detail.
`registry-write.test.ts` covers: writing a fresh component item creates the file and a lockfile
entry with the correct hash; re-running the same install with an unchanged on-disk file and no
`--force` is a no-op (per `add.ts`'s "already installed" short-circuit — though that check technically
lives in `add.ts`, this test can exercise `write.ts` directly by pre-seeding a matching lockfile
entry and confirming `write.ts` doesn't throw a conflict for it); a locally-modified file (hash
mismatch) without `--force` throws `CliError` listing the conflicting path; the same with `--force`
succeeds and overwrites.

### Task 3.4 — `registry/package-manager.ts`

Per `design/04`: `detectPackageManager`, `installPackages`. Consider extracting
`detectPackageManager`'s logic from `packages/create-consify/src/cli.js`'s existing
`detectPackageManager` into a genuinely shared location both packages import from, rather than
duplicating the sniffing logic — evaluate at implementation time whether `create-consify` and
`consify-cli` can share a tiny internal-only package or whether `consify-cli` re-implements the
~10-line function independently with a comment pointing at the original as the reference
implementation; either is acceptable, but note the decision made and why in the PR.

**Done when**: `registry-package-manager.test.ts` covers `detectPackageManager`'s three detection
paths (env var, lockfile sniffing, default-to-npm fallback) using a temp directory per case, mirroring
`create-consify`'s own existing test coverage for the same logic (`packages/create-consify/test/cli.test.ts`
already tests `detectPackageManager` — use the same test cases here, adapted to whichever module
actually owns the implementation per this task's extraction decision).

### Task 3.5 — `registry/add.ts` and `registry/remove.ts`

The full orchestration from `design/04`, including the **topological sort** the design doc flags as
a real requirement (not the simplified BFS-order pseudocode) for Phase C's write order when
`registryDependencies` are involved, and `remove.ts`'s dependents-check and locally-modified-file
handling.

**Done when**: `registry-add.test.ts` (integration-style, using a temp project directory + a local
HTTP server or mocked fetch serving fixture `registry-item.json` bodies — see the note below on test
infrastructure) covers every use case from the RFC that involves `add`: installing a single
component; installing an item with one `registryDependencies` entry (both end up in the lockfile,
dependency written before dependent — assert file-write order via a spy or by checking mtimes is
fragile; instead assert the *lockfile* records both and that dependency-order correctness is
verified by a **unit test on the topological sort function in isolation**, not by inferring it from
file-system side effects); a circular `registryDependencies` throws `CliError` naming the cycle;
re-adding an unchanged item is a no-op; re-adding a locally-modified item without `--force` fails,
with `--force` succeeds; a `skill`-type item targeting a missing feature fails with the specific
message from `design/06`. `registry-remove.test.ts` covers: removing an installed item deletes its
files and lockfile entry; removing an item another installed item depends on fails without
`--force`, succeeds with it; removing an item whose file was already manually deleted doesn't error;
removing an item whose file was locally modified keeps the file (with a warning) unless `--force`.

**Test infrastructure note**: `registry-add.test.ts` needs *something* to fetch from. Options: (a) a
real `Bun.serve()` instance started in `beforeAll`/stopped in `afterAll`, serving fixture JSON bodies
from an in-memory route table keyed by path — closest to a real integration test, a bit more
scaffolding; (b) mock global `fetch` to return canned `Response` objects based on the requested URL
— less scaffolding, doesn't exercise real HTTP semantics (status codes, headers) as thoroughly.
Recommendation: (a), a real local `Bun.serve()`, specifically because `design/03`'s auth-header
interpolation (`registry add-source ... --header`) deserves at least one test that confirms the
header *actually arrives* on the request the server receives, which a fetch mock cannot verify as
convincingly as a real request/response round trip.

---

## Phase 4 — Registry CLI commands

Depends on: Phase 3 complete.

### Task 4.1 — `registry/sources.ts` and its commander registration

Per `design/03`: `addSource`, `removeSource`, `listSources`, plus `register*Command` wiring for
`consify registry add-source <namespace> <url>`, `consify registry remove-source <namespace>`,
`consify registry list-sources`, each with zod-validated options per `design/03`'s
`addSourceOptionsSchema`.

**Done when**: `registry-sources.test.ts` covers: adding a new source writes it correctly; adding an
existing namespace without `--force` fails, with `--force` overwrites; marking a new source
`--default` clears any previous default; removing a nonexistent namespace fails with a clear message;
`listSources` on an empty file prints the "no registries configured" message verbatim (assert the
exact string, not just that *something* printed, since this is a specific UX detail worth locking
down); `listSources` never prints a raw resolved header value (assert the output does NOT contain
whatever literal env var value was set for a test with a configured header — a genuine security-
relevant assertion, not just a formatting nicety).

### Task 4.2 — `registry/list.ts` and its commander registration

Per `design/05`: `runListCommand`, registered as both `consify list` and `consify registry list`
(two commander `.command()` registrations calling the same underlying function — or one registered
as an alias of the other via commander's `.alias()`, whichever reads more clearly in the actual
`program.ts` — implementer's choice, document briefly in a comment either way).

**Done when**: `registry-list.test.ts` covers: an empty lockfile prints the "nothing installed"
message; installed items print one line each with correct padding; a locally-modified file shows the
`modified` flag; a deleted-but-still-locked file shows the `missing files` flag.

### Task 4.3 — `registry/add.ts` / `remove.ts` commander registration (`consify add`, `consify remove`)

Wire `runAddCommand`/`runRemoveCommand` (Task 3.5) into `program.ts` as `consify add <specifier>`
and `consify remove <specifier>`, each with their `--force` option per `design/04`.

**Done when**: manually running `consify add <a real fixture URL served locally>` against a fresh
`apps/starter`-like temp project produces the exact file-write and lockfile output described in the
RFC's use cases 1 through 9 — walk through every one of those nine use cases manually, once, against
a real (if minimal) locally-hosted registry, as the final human-verification gate for this phase, not
just the automated test suite.

---

## Phase 5 — `create-consify` integration and the official registry seed

Depends on: Phase 4 complete.

### Task 5.1 — Seed `consify.registries.json` in the generated project

`packages/create-consify/src/cli.js`'s `scaffold()` writes a `consify.registries.json` into every
new project, seeded with the one official registry:

```json
{
  "registries": {
    "@shiz-ceo": { "url": "https://consify.shiz-ceo.ru/r/{name}.json", "default": true }
  }
}
```

(Per the RFC's Open Question 1: this points at a URL that does not yet serve any real items — an
empty `apps/docs/public/r/registry.json` with zero entries, or no `r/` directory at all yet, is an
acceptable starting state; `consify add <anything-not-yet-published>` against it will simply 404 with
a clear error until real items are published, which is honest and expected, not a bug to work around
in this task.)

**Done when**: a freshly scaffolded project (via `bunx create-consify` in a real or CI-simulated run,
matching `packages/create-consify/test/cli.test.ts`'s existing scaffold-testing convention) contains
this file with this exact content (parameterized only by nothing — this seed is the same for every
new project, unlike `docs.config.ts` which varies per answer).

### Task 5.2 — Update `packages/create-consify`'s own dependency generation

Per `design/07`'s note: verify `prepare-template.ts`'s existing `name.replace(/^consify-/, "")`
convention correctly picks up `consify-cli` → `packages/cli` with zero code changes (it should, given
the naming chosen in `design/07`) — this task is primarily verification, not new code, unless the
verification in Phase 0's Task 0.8 already covered this (if so, this task is a no-op, confirm and
close it as "already done by 0.8").

**Done when**: a freshly scaffolded project's `package.json` lists both `"consify"` and
`"consify-cli"` as dependencies with correct version ranges, and `bun install` in that scaffolded
project succeeds.

---

## Phase 6 — Documentation and polish

Depends on: Phase 5 complete. Tasks in this phase can run in parallel with each other.

### Task 6.1 — `reference/cli.mdx` (en + ru)

Add every new/changed command: `consify add`, `consify remove`, `consify list`, `consify registry
add-source/remove-source/list-sources/list`, and update the existing command rows if their `--help`
wording changed meaningfully during the commander migration (Task 1.2–1.8's per-command work may have
produced better-worded descriptions than today's docs — reconcile, don't just append). Run
`bun run docs:check --strict` after editing both language versions, per this repository's own
established convention for keeping code blocks byte-identical between `en`/`ru`.

### Task 6.2 — A new "Registry" page under `customizing/` (en + ru)

Following the existing pattern set by `customizing/skills.mdx` (written earlier this project) almost
exactly — same tone, same structure (what it is, how to use it, how to author one, edge cases worth
knowing). Cover: what a registry item is, `consify add` for all three specifier forms, configuring a
private registry with `--header`, the five item types and where each lands, the lockfile and
`consify list`/`consify remove`. Add it to `customizing/meta.json` for both languages, and cross-link
from `customizing/extensions.mdx`'s existing "A skill for Claude" section (added earlier this
project) — a natural place to also mention "or distribute it as a registry item instead of a
private `custom/features/` folder."

### Task 6.3 — CHANGELOG.md entry

One entry (or two, if it reads better split) under `[Unreleased]`, following this repository's
existing CHANGELOG style (see the entries already there for "Deploy and CLI", "A skill for every
feature" as the closest tonal/structural precedent) — covering both the CLI migration (mention the
package split explicitly, and the breaking-change note from `design/07`'s edge cases about
`consify/node`'s shrunk export surface) and the registry system.

### Task 6.4 — `consify doctor` gains a registry-drift check (optional, nice-to-have, not blocking)

Cross-reference with the RFC's own prior-session context: an earlier phase of this project
considered and deliberately deferred adding a "skills are out of date" check to `consify doctor`
specifically because of CI-blocking risk (a `--ci` deploy workflow calls `consify doctor` and a
false-positive failure there blocks a deploy for an unrelated reason). Apply the same caution here:
if this task is picked up, a lockfile/registry-drift check in `doctor.ts` must be a warning
(non-zero exit only for genuine errors like an unreadable lockfile, never for "a registry item's
source is now unreachable" or "a newer version might exist," since neither of those is meaningful
without the versioning this RFC explicitly excludes in Non-goals). Given that constraint mostly
removes what such a check could usefully report, this task is marked optional and may reasonably be
dropped entirely rather than implemented — record the decision either way, don't leave it silently
undone.
