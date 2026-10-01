# Component: the lockfile (`consify.registry-lock.json`)

## Purpose

Record what was installed, from where, and a content hash of every file at install time — so a
later `consify add`/`consify remove` can tell "unmodified since install" from "user edited this"
from "not ours at all," and so `consify list` has something to read.

## File: `packages/core/src/build/registry/lockfile.ts`

Committed to git (like `bun.lock`/`package-lock.json` — it's project state, not a cache, and matters
for anyone else on the project running `consify list` or `consify remove` to see the same picture).

### On-disk format

```json
{
  "version": 1,
  "items": {
    "@acme/pricing-card": {
      "name": "pricing-card",
      "type": "component",
      "source": "https://acme.dev/r/pricing-card.json",
      "installedAt": "2026-09-29T12:00:00.000Z",
      "files": [
        { "path": "custom/components/PricingCard.tsx", "hash": "sha256:9f86d0..." }
      ],
      "dependencies": ["clsx@^2.0.0"],
      "registryDependencies": ["@acme/badge"]
    },
    "@acme/badge": {
      "name": "badge",
      "type": "component",
      "source": "https://acme.dev/r/badge.json",
      "installedAt": "2026-09-29T12:00:00.000Z",
      "files": [{ "path": "custom/components/Badge.tsx", "hash": "sha256:1c2ef4..." }],
      "dependencies": [],
      "registryDependencies": []
    }
  }
}
```

The top-level `items` key is the **specifier the item was installed by** (`itemKeyFor`, which today
is simply the specifier string itself, normalized by trimming — see `design/04`'s note on why this
is specifier-keyed rather than name-keyed). `version: 1` is a schema version for the lockfile format
itself, so a future breaking change to this file's shape has somewhere to branch on
(`if (raw.version !== 1) { migrate or error }`) — not exercised by this RFC (there is only version 1),
but the field costs nothing to add now and is exactly the kind of thing that's painful to retrofit
later (`bun.lock`/`package-lock.json` both learned this the hard way with un-versioned early formats).

### Zod schema

```ts
const lockfileEntryFileSchema = z.object({ path: z.string(), hash: z.string() });

const lockfileEntrySchema = z.object({
  name: z.string(),
  type: z.enum(registryItemTypes),
  source: z.string(),
  installedAt: z.string(),
  files: z.array(lockfileEntryFileSchema),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
});

const lockfileSchema = z.object({
  version: z.literal(1),
  items: z.record(z.string(), lockfileEntrySchema),
});
export type Lockfile = z.infer<typeof lockfileSchema>;
```

### Hashing

```ts
import { createHash } from "node:crypto";

export function sha256(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function hashFile(path: string): string {
  return sha256(readFileSync(path, "utf8"));
}
```

Plain Node `crypto`, no new dependency. Hashing the exact file *content* (not mtime, not size) is
what makes "was this file modified since install" reliable across git clones/checkouts where mtimes
are meaningless.

### Read/write + convenience API

```ts
const lockfilePath = (cwd: string) => join(cwd, "consify.registry-lock.json");

export function readLockfile(cwd: string): LockfileHandle {
  const path = lockfilePath(cwd);
  const raw = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { version: 1, items: {} };
  const parsed = lockfileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CliError(`consify.registry-lock.json is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return new LockfileHandle(parsed.data);
}

export function writeLockfile(cwd: string, handle: LockfileHandle): void {
  writeFileSync(lockfilePath(cwd), `${JSON.stringify(handle.data, null, 2)}\n`);
}

/** Small wrapper so add.ts/remove.ts don't manipulate the raw object shape directly. */
export class LockfileHandle {
  constructor(public data: Lockfile) {}
  get items() { return this.data.items; }
  set(key: string, entry: Lockfile["items"][string]): void { this.data.items[key] = entry; }
  delete(key: string): void { delete this.data.items[key]; }
  /** Finds an entry (if any) whose files list includes this exact on-disk path — used by add.ts's
   *  Phase B conflict check to answer "did WE write this file, under some other specifier?" */
  findByPath(fullPath: string): { hash: string } | undefined {
    for (const entry of Object.values(this.data.items)) {
      const match = entry.files.find((f) => f.path === relative(process.cwd(), fullPath));
      if (match) return match;
    }
    return undefined;
  }
}

export function itemKeyFor(specifier: string): string {
  return specifier.trim();
}
```

## `consify list` / `consify registry list`

Both names are accepted as aliases for the same command (`consify list` is the short form; `consify
registry list` groups it under the `registry` subcommand namespace alongside `add-source` /
`remove-source` / `list-sources` for discoverability via `consify registry --help`) —
file: `packages/core/src/build/registry/list.ts`.

```ts
export function runListCommand(cwd: string): number {
  const lockfile = readLockfile(cwd);
  const entries = Object.entries(lockfile.items);
  if (entries.length === 0) {
    console.log("Nothing installed from a registry yet. See `consify add --help`.");
    return 0;
  }
  const nameWidth = Math.max(...entries.map(([key]) => key.length));
  for (const [key, entry] of entries) {
    const modified = entry.files.some((f) => existsSync(join(cwd, f.path)) && hashFile(join(cwd, f.path)) !== f.hash);
    const missing = entry.files.some((f) => !existsSync(join(cwd, f.path)));
    const flag = missing ? color.red("missing files") : modified ? color.yellow("modified") : "";
    console.log(`  ${key.padEnd(nameWidth)}  ${entry.type.padEnd(9)}  ${entry.source}  ${flag}`.trimEnd());
  }
  return 0;
}
```

## Edge cases

- **A file the lockfile references was deleted by hand (not through `consify remove`)** — `consify
  list` flags it as `missing files` (shown above); `consify remove` on that specifier simply skips
  deleting files that are already gone (see `design/04`'s `remove.ts`: `if (!existsSync(fullPath))
  continue`) and still cleans up the lockfile entry — removing a stale lockfile entry for
  already-deleted files must never error.
- **The lockfile is manually edited and becomes inconsistent** (e.g. a `files` entry pointing at a
  path that was never actually written by consify) — not specially detected; the hash comparison
  naturally treats "path doesn't exist" as `missing`, and if the path exists but was never written by
  consify, the hash simply won't match whatever's there (or will coincidentally match, which is
  harmless — a coincidental sha256 collision on a real project file is not a threat model this
  feature needs to defend against).
- **Concurrent `consify add` invocations** (e.g. two terminal tabs) — not handled; a
  read-modify-write race on `consify.registry-lock.json` can lose one invocation's update. No file
  locking is introduced for this RFC (matches the project's existing conventions — nothing else in
  the CLI locks files either, e.g. `consify skill sync`'s manifest has the identical unguarded
  read-modify-write pattern already in production) — flagged here for completeness, not treated as
  worth solving now.
