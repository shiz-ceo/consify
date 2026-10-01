# Amendment: `integrations/` workspace, `feature` = npm package, `theme` = plain file

Written after Phases 0–6 were fully implemented (see `tasks.md`'s history) and already merged into
the `feat/registry-and-cli` branch. This is a follow-up design decision, made in conversation with
the user, that changes two of the five item types and moves three existing packages into a new
workspace. It supersedes the relevant parts of `design/02`, `design/06`, and `tasks.md` — those files
are kept as historical record of the original design; this file is the authority where they disagree.

## 1. `integrations/` workspace

A new top-level folder, `integrations/`, added to the root `package.json`'s `workspaces` array
alongside `packages/*` and `apps/*`. Three existing packages move there, **npm package names
unchanged**:

- `packages/blog` → `integrations/blog` (npm: `consify-blog`)
- `packages/docs` → `integrations/docs` (npm: `consify-docs`)
- `packages/api-reference` → `integrations/api-reference` (npm: `consify-api-reference`)

`packages/core` (`consify`) and `packages/cli` (`consify-cli`) stay in `packages/` — they are the
engine. `packages/create-consify` **also stays in `packages/`** (confirmed by the user: it's a
project generator/tool, not a `defineFeature`-based integration, so it belongs with the engine, not
with the integrations).

### What needs updating for the move (mechanical, same kind of work as the Phase 0 package split)

- Root `package.json`'s `workspaces` array.
- `scripts/prepare-template.ts`'s dependency-version-resolution loop: today it does
  `name.replace(/^consify-/, "")` to find `packages/<dir>` for a given `consify-<dir>` package name.
  This breaks for the three moved packages (no longer under `packages/`). Replace the single regex
  with an explicit lookup table (or two rules: try `packages/<dir>` first, then
  `integrations/<dir>`) — whichever reads more clearly; do not leave a silent wrong guess.
- `scripts/check-package.ts`'s package list/paths (it references `packages/blog` etc. explicitly for
  building+packing tarballs).
- Each of the three packages' own `package.json` `repository.directory` field
  (`"packages/blog"` → `"integrations/blog"`).
- `CONTRIBUTING.md`'s folder table.
- Any CI workflow that references `packages/blog`/`packages/docs`/`packages/api-reference` by path
  (grep `.github/workflows/*.yml` — the `docs:check`/`deploy-docs.yml` workflows reference
  `apps/docs`, not these, but verify rather than assume).
- `apps/demo`, `apps/docs`, `apps/starter`'s own `package.json` dependencies on `consify-blog`/
  `consify-docs`/`consify-api-reference` **do not need to change at all** — they depend by npm
  package name, which is unchanged; only the workspace's internal linking (which bun resolves by
  name, not by path) needs the packages to still exist somewhere `workspaces` covers, which they do
  once `integrations/*` is added to that array.

### Verification for this part

`bun install` at the root re-links everything; `bun run check` (lint/typecheck/tests),
`bun run check:build`, `bun run check:package` (its explicit package list needs the path update
above) must all stay green, exactly as Phase 0's own acceptance criterion was.

## 2. `type: "feature"` becomes package-only (supersedes `design/02` and `design/06`)

**The old `feature`-item shape (`featureId` + `files`, copying `feature.ts`/`node.ts`/`routes/*` into
`custom/features/<id>/`) is removed entirely.** A `feature`-type registry item is now always "install
this as an npm dependency, then add it to `extensions`" — never a file copy. Rationale (from the
conversation): a real feature (like the blog) is large and has its own build-time integration
(content scaffolding via the `fumadocs-mdx` macro, etc.) that only works correctly as a properly
versioned, updatable npm package — copying that much source into `custom/` was never going to be a
good experience, and the user confirmed this directly: "фичи бы требовал как нпм пакеты."

### New schema for `type: "feature"`

```ts
// registry/schema.ts — the feature-specific fields change; component/plugin/skill/theme unaffected
// except theme (see part 3 below)
{
  name: string,               // unchanged
  type: "feature",
  description?: string,       // unchanged
  packageName: string,        // the npm package to install, e.g. "consify-blog"
  packageVersion?: string,    // an npm range, e.g. "^1.0.0" — defaults to "*" (latest) if omitted
  exportName: string,         // the named export to import and call, e.g. "blog"
  dependencies: string[],     // default [] — EXTRA packages beyond packageName itself, for the rare
                              // case a feature needs something not already a dependency of its own
                              // package.json (npm already resolves packageName's own deps normally)
  registryDependencies: string[], // unchanged meaning, still supported
}
```

`files` and `featureId` are **removed from the schema for `type: "feature"`** (a `superRefine` should
reject them if present, with a clear message, rather than silently ignoring them — a registry author
who copy-pasted the old shape deserves an error, not silent data loss).

### What `consify add` does for a `feature`-type item

1. `bun add <packageName>` (or `<packageName>@<packageVersion>` if given), plus anything in
   `dependencies`, via the existing `package-manager.ts`.
2. Prints the extensions snippet, now **always as a function call** (features are factories in this
   codebase's own convention — `docs()`, `blog(options)`, `apiReference(options)` all are):
   ```
   import { blog } from "consify-blog";
   extensions: [..., blog()],
   ```
3. **Lockfile entry, with an empty `files` list** — there is nothing on disk this item wrote, but a
   record still belongs in `consify.registry-lock.json` so `consify list` shows it as installed and
   `registryDependencies` bookkeeping (another item depending on this one) still works. `consify
   remove` on such an entry deletes the lockfile record and prints (mirroring the existing disclosure
   already used for `dependencies`): "the npm package itself was not removed — run `bun remove
   consify-blog` yourself if you no longer need it." No file-hash conflict checking applies to this
   entry (there are no files) — `writeItems`'s conflict-detection loop already skips items with zero
   files naturally once `theme`'s special-case is removed (see part 3), so this should fall out for
   free rather than needing new branching, but verify this in the actual `checkForConflicts`/loop code
   rather than assuming.

### `resolveItemRoot` for `feature`

No longer applicable — `item-types.ts` should not attempt to resolve a filesystem root for
`type: "feature"` at all now (there is nothing to write). `write.ts`'s dispatch on `item.type` gets a
`"feature"` branch that does the `bun add` + prints the snippet, structurally parallel to how
`"theme"` used to be the one type that didn't write files — except a `feature` item **does** still
get a lockfile entry (empty `files`), where `theme` (old behavior) did not.

### Existing `feature`-type tests and docs

Every test in `packages/cli/test/registry/registry-item-types.test.ts` and
`registry-add.test.ts`/`registry-write.test.ts` that exercises the *old* file-copying `feature`
behavior (`featureId`, files landing in `custom/features/<id>/`) needs to be rewritten against the
new package-based behavior, not left in place — they test a shape that no longer exists. The
`customizing/registry.mdx` docs page (en+ru) needs its `feature` row and any prose describing the old
behavior rewritten to match.

## 3. `type: "theme"` becomes a plain file-copy type (supersedes the "prints, does not write" rule)

**Reverted, per the user's explicit correction ("тема пусть будет как файл"):** a `theme`-type item
is now handled exactly like `component`/`plugin` — its `files` are written to disk, get a normal
lockfile entry with real file hashes, and participate in the normal overwrite-protection check like
everything else. **No more special printed-instructions-only behavior, no more "never gets a lockfile
entry."**

### `resolveItemRoot` for `theme`

```ts
case "theme":
  return join(cwd, "custom"); // a theme item's files are typically just "theme.css", landing at
                               // custom/theme.css — the file consify's own theme system already
                               // loads after its own tokens (see the theme.css convention already
                               // documented in configuration/theme.mdx)
```

A theme item's `files[].path` is a real path again (not a printed label) — typically just
`"theme.css"`, sometimes more than one file if a theme also ships e.g. a font-face declaration file
imported from `theme.css`. If `custom/theme.css` already exists and wasn't written by a previous
`consify add`, the standard conflict check applies (needs `--force`) — same as any other type, no
special casing.

**Still true, unchanged from the original design:** consify never edits `docs.config.ts` for a theme
item — if an author wants to suggest `theme.preset`/`theme.brand` values alongside the CSS file, that
goes in the item's `description` field (shown by `consify list`) or in prose in wherever the item is
documented, not something `consify add` prints specially. This part of the original design was never
in question; only the "prints instead of writes" mechanic is reverted.

### Schema change for `theme`

None beyond what's already there — `registryItemFileSchema`/`registryItemSchema` already support
this shape (a `theme` item with normal `files`); only `item-types.ts`'s `resolveItemRoot` and
`write.ts`'s dispatch (removing the special branch, folding `"theme"` into the same code path as
`"component"`/`"plugin"`) need to change. `addsASkill` (added in the follow-up commit after Phase 6)
is unaffected — themes never add a skill.

## 4. The three official `feature` items themselves

Once part 2 ships, write and host three real registry items for `apps/docs/public/r/`
(`https://consify.shiz-ceo.ru/r/{name}.json` once deployed — locally these are just static JSON files
in the repo, served the same way every other page under `apps/docs/public/` already is):

- `apps/docs/public/r/blog.json` — `{ name: "blog", type: "feature", packageName: "consify-blog", exportName: "blog", description: "..." }`
- `apps/docs/public/r/docs.json` — `{ name: "docs", type: "feature", packageName: "consify-docs", exportName: "docs", description: "..." }`
- `apps/docs/public/r/api-reference.json` — `{ name: "api-reference", type: "feature", packageName: "consify-api-reference", exportName: "apiReference", description: "..." }`

`packageVersion` may reasonably be omitted (defaults to latest) rather than pinned, since these are
consify's own first-party packages meant to track whatever's current.

## 5. Demonstrating it on `apps/demo`

`apps/demo` already depends on `consify-blog`/`consify-docs`/`consify-api-reference` directly (via
normal `bun add` + `extensions` in `docs.config.ts`, written by hand originally) — **that wiring does
not change**; a real project is not expected to switch to `consify add` for dependencies it already
has correctly configured. The demonstration instead proves the new mechanism works, without
disturbing the demo's own working state:

1. In a **disposable scratch directory** (not `apps/demo` itself — `mkdtemp`, same convention every
   registry test already uses), scaffold a minimal project (or reuse the existing
   `check-package.ts`-style scaffold-and-pack-tarballs approach so the scratch project has real,
   locally-built `consify`/`consify-cli`/`consify-blog` tarballs available, not published ones).
2. Point that scratch project's `consify.registries.json` at the three JSON files from part 4 (a
   `file://` URL or a locally-served `Bun.serve()` — whichever is simpler to wire up reliably in a
   one-off manual verification; this does not need to become an automated test, though adding one is
   welcome if it's not much extra work given the existing `registry-add.test.ts` infrastructure
   already does exactly this kind of local-server setup).
3. Run `consify add blog` for real, observe: `consify-blog` gets added to the scratch project's
   `package.json` and installed, the `extensions` snippet is printed correctly with the `blog()`
   call form, `consify list` shows it installed with an empty file list, `consify remove blog`
   removes the lockfile entry and prints the "npm package itself was not removed" note.
4. Report the exact commands run and their real output in the final summary — this is the "покажи
   как работает" the user asked for, and it must be an actual transcript of a real run, not a
   description of expected behavior.

## Summary of what changes vs. what Phases 0–6 already shipped

| Thing | Phases 0–6 (already shipped) | This amendment |
| --- | --- | --- |
| `component`, `plugin` | Copy files | Unchanged |
| `skill` | Copy files, attaches to an existing `custom/features/<id>/` | Unchanged |
| `theme` | Prints instructions, writes nothing, no lockfile entry | **Now copies files like component/plugin**, gets a normal lockfile entry |
| `feature` | Copies files into `custom/features/<featureId>/`, needs `featureId` | **Now installs an npm package (`packageName`/`exportName`), no files, no `featureId`** |
| Package layout | `packages/{core,cli,blog,docs,api-reference,create-consify}` | `packages/{core,cli,create-consify}` + `integrations/{blog,docs,api-reference}` |
| Official registry content | None published yet (Open Question 1, still true) | Three real `feature` items for blog/docs/api-reference, demonstrated end-to-end |
