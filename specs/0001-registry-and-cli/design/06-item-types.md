# Component: per-type item handling

File: `packages/cli/src/registry/item-types.ts` (see `design/07-package-split.md` for why this path,
not `packages/core/...`).

## Purpose

`RegistryItem.type` decides two things: where its `files` land (the "root" every file's `path` is
relative to), and whether anything beyond a plain file write is needed (installing npm
`dependencies` is common to all types and handled once in `add.ts`, not here — this file is only
about the type-specific root-resolution and any type-specific validation beyond what
`design/02-registry-schema.md`'s schema already enforces).

## `resolveItemRoot`

```ts
export function resolveItemRoot(item: RegistryItem, cwd: string): string {
  switch (item.type) {
    case "component":
      return join(cwd, "custom/components");
    case "plugin":
      return join(cwd, "custom/plugins");
    case "feature":
      // item.featureId is guaranteed present by the schema's superRefine for this type
      return join(cwd, "custom/features", item.featureId as string);
    case "skill":
      // attaches to an EXISTING feature's own skill/ folder — see "skill items" below
      return join(cwd, "custom/features", item.featureId as string, "skill");
    case "theme":
      // theme items never write into a root the normal way — see "theme items" below
      return join(cwd, ".consify-registry-theme-suggestions"); // never actually used for a real write
  }
}
```

## `component` items

Straightforward: `files` land under `custom/components/`. Typically one file
(`{ path: "Since.tsx", content: "..." }` → `custom/components/Since.tsx`), but nothing prevents a
component item shipping more than one file (a component plus a small co-located helper module) —
the schema allows `files.length >= 1`, no upper bound.

**Edge case**: a component item's file name doesn't start with a capital letter (consify's own MDX
component convention: the file name *is* the tag, and tags are capitalized). Not validated/enforced
by the schema or by `write.ts` — an author shipping `custom/components/since.tsx` (lowercase) would
simply produce a component nobody can use as `<since />` the conventional way (JSX treats a
lowercase tag name as an HTML element, not a component reference). This is called out here as a
**documentation** matter (the eventual public docs for authoring a registry item should say this
explicitly), not a runtime validation this RFC adds — consify does not currently validate custom
component file naming for `custom/components/` in general (a user can already name one lowercase by
hand today and hit the same confusion), so the registry path doesn't need to be stricter than the
existing manual path.

## `plugin` items

Land under `custom/plugins/`. A plugin item's `content` is expected to be a module calling
`definePlugin` (see `packages/core/src/plugins/` — `import { definePlugin } from "consify/plugins"`)
but **this is not validated** — `write.ts` writes whatever `content` string the item provides; if
it's not a valid plugin module, the project's own `bun run build`/`typecheck` will surface that the
normal way (a broken import, a type error), not something `consify add` itself checks. Registry
items are trusted the same way any code a person copies from the internet is trusted — the schema
validates *shape* (is this valid JSON matching the item format), never *correctness* of the
JavaScript/TypeScript inside `content` strings.

## `feature` items

Land under `custom/features/<featureId>/`. Expected to include at minimum a `feature.ts` (calling
`defineFeature`, per `packages/core/src/shared/feature.ts`'s existing contract — see the
`consify-extension-engineering` skill, which already documents this exact contract in depth for a
human/agent writing one by hand; a `feature`-type registry item is just a pre-packaged version of
what that skill teaches someone to write from scratch), and optionally `node.ts`, `routes/*.tsx`,
and its own `skill/SKILL.md` (a feature item can ship its own skill as part of the same item — see
"a feature item bundling a skill" below, distinct from a standalone `skill`-type item).

**After writing a `feature` item's files, the installing project's `docs.config.ts` does NOT get
automatically updated** to add the new feature to `extensions` — this mirrors the `theme` item's
"never auto-edit `docs.config.ts`" rule (RFC Non-goals) and is the single most important thing
`consify add`'s printed summary must surface clearly for this type: after writing
`custom/features/status/feature.ts`, the command's final output must explicitly say something like:

```
Add it to extensions in docs.config.ts to enable it:

  import { status } from "./custom/features/status/feature.ts";
  extensions: [..., status],
```

(the exact import name is read from the item's own declared `name` field, converted to a valid JS
identifier — `item.name.replace(/-/g, "")` camelCased, or the author can hint the correct export name
via the item's `description` field convention documented for authors; either is acceptable, decide
at implementation time and document the choice in the eventual public authoring docs — not a
consify-side validation concern).

**A feature item bundling a skill**: if a `feature`-type item's `files` includes a path starting
with `skill/` (e.g. `skill/SKILL.md`), it lands at `custom/features/<featureId>/skill/SKILL.md` —
`resolveItemRoot` for `type: "feature"` already returns `custom/features/<featureId>/`, and the
file's own relative `path: "skill/SKILL.md"` naturally lands in the right place with no special
casing needed in `item-types.ts` itself. `consify skill sync` (existing, unmodified system) then
picks it up automatically the next time it runs, exactly as it would for a feature written by hand —
this is a nice emergent property of the two systems' path conventions already agreeing, not something
this RFC had to engineer specially.

## `skill` items

The one type that does **not** create something new — it **attaches** to an *existing* feature.
`featureId` (required by the schema for this type) names a feature that must already exist locally:

```ts
// in write.ts, before writing a "skill"-type item's files:
if (item.type === "skill") {
  const featureDir = join(cwd, "custom/features", item.featureId as string);
  if (!existsSync(join(featureDir, "feature.ts"))) {
    throw new CliError(
      `"${item.name}" is a skill for the feature "${item.featureId}", but ` +
        `custom/features/${item.featureId}/feature.ts does not exist. Install that feature first.`,
    );
  }
}
```

This check runs during Phase B of `add.ts` (design/04) — alongside the file-conflict check, before
anything is written — so a `skill` item targeting a feature that isn't installed fails cleanly with
this specific message rather than a generic "file conflict" or a silent write into a directory that
doesn't otherwise exist (`mkdirSync(..., { recursive: true })` would happily create
`custom/features/nonexistent-id/skill/` with nothing else in it, which is a broken, confusing state —
this check exists specifically to prevent that).

**Why a separate type from `feature` at all**, given a feature item can already bundle its own
`skill/SKILL.md` (previous section) — because a *third party* often wants to add a skill for
someone else's *already-published* feature (their own consify project's own `custom/features/status/`,
written by hand, not by any registry item) without republishing the whole feature. `type: "skill"` is
that case: "teach the assistant about a feature that's already there," independent of who or how
that feature got installed.

## `theme` items

The only type that never writes a "real" file at all, by design (RFC Non-goals: no automated editing
of `docs.config.ts`). A `theme`-type item's `files` are still validated by the schema (at least one
file), but `write.ts` handles this type specially:

```ts
if (item.type === "theme") {
  console.log(color.bold(`\n${item.name} is a theme snippet — add this to docs.config.ts yourself:\n`));
  for (const file of item.files) {
    console.log(`--- ${file.path} ---`);
    console.log(file.content);
  }
  // no lockfile entry is created for a theme item — there's nothing on disk to track modification
  // of, and "is this still installed" has no meaning for something that was only ever printed
  return;
}
```

A theme item's `files[].path` is repurposed as a **label** for what's being printed (conventionally
something like `"docs.config.ts snippet"` or `"custom/theme.css addition"`), not an actual write
target — this is a deliberate, documented exception to the otherwise-universal "`path` is relative to
the item's root and gets written there" rule, called out explicitly here because it is genuinely the
one type that breaks the pattern every other type follows, and an implementer reading `write.ts`
top-to-bottom needs to know this is intentional, not a missed case.

**No lockfile entry for `theme` items** is itself an edge case worth restating: `consify list` will
never show a previously-"added" theme item, and `consify add <same-theme-item>` again later simply
re-prints the same snippet — this is correct, expected behavior (re-printing instructions has no
side effect to be idempotent about), not a bug to fix.

## Summary table

| Type | Root | Creates lockfile entry | Special validation before write |
| --- | --- | --- | --- |
| `component` | `custom/components/` | Yes | None beyond the schema |
| `plugin` | `custom/plugins/` | Yes | None beyond the schema |
| `feature` | `custom/features/<featureId>/` | Yes | None beyond the schema (featureId presence already enforced by schema) |
| `skill` | `custom/features/<featureId>/skill/` | Yes | `featureId`'s `feature.ts` must already exist |
| `theme` | N/A — printed, not written | **No** | None — printed as-is |
