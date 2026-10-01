# Component: the registry schema (`registry.json` / `registry-item.json`)

## Purpose

Define the exact, versioned, zod-validated shape a registry author's JSON must have. This is the
one format every registry — official or third-party — is expected to produce; `consify add` never
accepts anything that doesn't validate against it.

## File: `packages/core/src/build/registry/schema.ts`

### The item-type union

```ts
export const registryItemTypes = ["component", "plugin", "feature", "skill", "theme"] as const;
export type RegistryItemType = (typeof registryItemTypes)[number];
```

Exactly the five types discussed in the RFC's use cases; see `design/06-item-types.md` for what each
one means for where files land. The union is closed (`z.enum`, not an open string) — an unknown
`type` is a validation error, not silently accepted and mishandled.

### `RegistryItemFile`

```ts
export const registryItemFileSchema = z.object({
  /** Where it lands, relative to the appropriate root for the item's type — e.g. for a
   *  `component` item this is relative to `custom/components/`, for a `feature` item relative to
   *  `custom/features/<id>/`. See design/06-item-types.md for the exact root per type. */
  path: z.string().min(1).refine((p) => !p.startsWith("/") && !p.includes(".."), {
    message: "path must be relative and must not contain '..'",
  }),
  /** The full text content of the file, inline. */
  content: z.string(),
  /** Optional — a hint for editors/registries that generate the JSON; consify itself does not
   *  branch on this today, but it is part of the shadcn-compatible shape and costs nothing to
   *  accept and pass through into the lockfile for humans reading it later. */
  type: z.string().optional(),
});
export type RegistryItemFile = z.infer<typeof registryItemFileSchema>;
```

The `path` validation (`refine`) is a hard security boundary: without it, a malicious or buggy
`registry-item.json` could specify `path: "../../../../etc/cron.d/evil"` and `registry/write.ts`
(design/04) would happily write outside the project. This check must run **before** any file is
written, for **every** file in **every** item in the whole dependency chain (top-level item and all
resolved `registryDependencies`) — see design/04's "all-or-nothing" validation pass.

### `RegistryItem`

```ts
export const registryItemSchema = z.object({
  /** Bare name, no namespace — the namespace is a property of *how* it was fetched (which
   *  registry it came from), not of the item's own identity. Lowercase letters, digits, `-`. */
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "must be lowercase letters, digits and '-'"),
  type: z.enum(registryItemTypes),
  /** One-line, shown by `consify list` / `consify registry list` and in --help-adjacent output. */
  description: z.string().optional(),
  /** For a `feature` or `skill` item: the id the feature is created/attached under
   *  (`custom/features/<id>/`). Required for `type: "feature"`; for `type: "skill"` it names the
   *  *existing* feature id to attach to (see design/06-item-types.md — a skill item does not create
   *  a feature, it only adds a skill/ folder to one that must already exist locally). Ignored for
   *  component/plugin/theme. */
  featureId: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  files: z.array(registryItemFileSchema).min(1),
  /** npm packages this item needs — installed with the project's detected package manager after
   *  files are written. Plain npm range strings, e.g. "^2.0.0", "*". */
  dependencies: z.array(z.string()).default([]),
  /** Other registry items this one needs, resolved and installed first. Each entry is a specifier
   *  in the same format `consify add` itself accepts: a full URL, "@namespace/name", or a bare name
   *  (resolved against the *installing project's* configured registries at add-time, not against
   *  whatever registry this item itself came from — see design/04's resolution-context note). */
  registryDependencies: z.array(z.string()).default([]),
}).superRefine((item, ctx) => {
  if (item.type === "feature" && item.featureId === undefined) {
    ctx.addIssue({ code: "custom", path: ["featureId"], message: `type "feature" requires featureId` });
  }
  if (item.type === "skill" && item.featureId === undefined) {
    ctx.addIssue({ code: "custom", path: ["featureId"], message: `type "skill" requires featureId (the existing feature to attach to)` });
  }
});
export type RegistryItem = z.infer<typeof registryItemSchema>;
```

### `RegistryIndex` (`registry.json`)

```ts
export const registryIndexEntrySchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  type: z.enum(registryItemTypes),
  description: z.string().optional(),
});

export const registryIndexSchema = z.object({
  /** Free text, shown by `consify registry list` next to the registry's namespace. */
  name: z.string().optional(),
  items: z.array(registryIndexEntrySchema),
});
export type RegistryIndex = z.infer<typeof registryIndexSchema>;
```

`registry.json` is **optional infrastructure for browsing**, not something `consify add` itself
needs to function — `consify add <url-to-a-registry-item.json>` and `consify add @ns/name` (which
substitutes into a per-registry template URL, see design/03) both go straight to a
`registry-item.json`, never through `registry.json` first. `registry.json` only matters for a future
"list what @ns actually has" feature (not built in this RFC — see the RFC's Non-goals — the schema
is defined now anyway since it costs nothing and avoids a breaking format change if that follow-up
happens later; `registry/schema.ts` exports it but no command reads it yet).

## Validation entry point

```ts
/** Fetches nothing — pure validation of an already-parsed JSON value. Used by fetch.ts right after
 *  `JSON.parse`, and by tests. Throws CliError (not a raw ZodError) with a human message. */
export function parseRegistryItem(json: unknown, sourceUrl: string): RegistryItem {
  const result = registryItemSchema.safeParse(json);
  if (!result.success) {
    throw new CliError(`${sourceUrl} is not a valid registry item:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
```

## Edge cases

- **`files` is empty** — rejected by `.min(1)`; a registry item that does nothing is almost
  certainly a bug in whatever generated it, and an empty install would be a confusing no-op.
- **Duplicate `path` values within one item's `files`** — not currently rejected by the schema
  itself (zod doesn't have a built-in "array of unique X" without a custom `.refine`); add a
  `.refine` checking `new Set(files.map(f => f.path)).size === files.length` with message
  `"duplicate path in files"` — this is a real authoring mistake worth catching at validation time
  rather than "last write wins" silently inside `write.ts`.
- **`name` in the JSON does not match the name the item was requested by** (e.g. `consify add
  @acme/foo` but the fetched JSON's `name` field says `"bar"`) — this is **not** an error; the
  specifier used to fetch it (`@acme/foo`) is what gets recorded in the lockfile as how it was
  installed, but the item's own declared `name` field is what's shown in `consify list` (a registry
  author renaming their own file path without updating the JSON's `name` is their own bookkeeping
  issue, not something consify should refuse over — flagged as a note, not a validation error).
- **A `feature`-type item's `featureId` collides with an already-existing local
  `custom/features/<id>/` that was NOT created by a previous `consify add`** (i.e., no lockfile
  entry for it) — this is the standard overwrite-protection case, handled in `design/04` exactly like
  `consify skill sync`'s existing "not created by us" guard, not specific to schema validation.
