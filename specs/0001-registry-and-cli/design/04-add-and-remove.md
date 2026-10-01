# Component: `consify add` and `consify remove`

## Purpose

The actual install/uninstall algorithm: resolve a specifier, fetch and validate its JSON (and every
`registryDependencies` entry, recursively), write files with overwrite protection, install npm
`dependencies`, and record everything in the lockfile — or, for `remove`, the reverse.

## Files

- `packages/core/src/build/registry/fetch.ts` — HTTP fetch + validation for one specifier.
- `packages/core/src/build/registry/add.ts` — orchestrates the whole `consify add` flow.
- `packages/core/src/build/registry/remove.ts` — orchestrates `consify remove`.
- `packages/core/src/build/registry/write.ts` — the actual filesystem writes (delegates path
  resolution per item type to `design/06-item-types.md`'s `resolveItemRoot`).
- `packages/core/src/build/registry/package-manager.ts` — detects and runs the project's package
  manager for `dependencies` (a small extraction of logic `create-consify`'s
  `packages/create-consify/src/cli.js` already has as `detectPackageManager`/`runCommand`, moved
  somewhere both `create-consify` and `consify` core can import from — see `tasks.md`'s note on
  this shared-code question).

## `fetch.ts`

```ts
export interface FetchedItem {
  item: RegistryItem;
  sourceUrl: string;
}

/** One HTTP GET, JSON-parsed and schema-validated. Does not recurse into registryDependencies —
 *  that's add.ts's job, since it needs to track the whole in-flight set for cycle detection. */
export async function fetchRegistryItem(
  resolved: ResolvedSpecifier,
): Promise<FetchedItem> {
  let response: Response;
  try {
    response = await fetch(resolved.url, { headers: resolved.headers });
  } catch (error) {
    throw new CliError(`Could not reach ${resolved.url}: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new CliError(`${resolved.url} responded with ${response.status} ${response.statusText}`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new CliError(`${resolved.url} did not return valid JSON`);
  }
  return { item: parseRegistryItem(json, resolved.url), sourceUrl: resolved.url };
}
```

## `add.ts` — the orchestration algorithm

```ts
export interface AddOptions {
  specifier: string;
  force: boolean;
}

export async function runAddCommand(options: AddOptions, cwd: string): Promise<number> {
  const registries = readRegistriesFile(cwd);
  const lockfile = readLockfile(cwd);

  // Phase A: resolve + fetch the whole dependency tree, breadth-first, before writing anything.
  const toInstall: FetchedItem[] = [];
  const seen = new Set<string>(); // specifiers already queued or installed, cycle guard
  const queue: string[] = [options.specifier];
  const fetchSpinner = spinner(`Resolving ${options.specifier}...`);
  while (queue.length > 0) {
    const specifier = queue.shift() as string;
    if (seen.has(specifier)) continue;
    seen.add(specifier);
    if (lockfile.items[itemKeyFor(specifier)] && !options.force) {
      continue; // already installed, same specifier — nothing to re-fetch (see "already installed" below)
    }
    const resolved = resolveSpecifier(specifier, registries);
    fetchSpinner.update(`Fetching ${resolved.displaySpecifier}...`);
    const fetched = await fetchRegistryItem(resolved);
    toInstall.push(fetched);
    for (const dep of fetched.item.registryDependencies) {
      if (seen.has(dep)) {
        throw new CliError(`Circular registryDependencies: ${[...seen, dep].join(" -> ")}`);
      }
      queue.push(dep);
    }
  }
  fetchSpinner.succeed(`Resolved ${toInstall.length} item(s)`);

  if (toInstall.length === 0) {
    console.log(`${options.specifier} is already installed. Pass --force to reinstall.`);
    return 0;
  }

  // Phase B: validate every file path across the WHOLE batch before writing any of them
  // (all-or-nothing — see the RFC's use case 12).
  const conflicts: string[] = [];
  for (const { item } of toInstall) {
    const root = resolveItemRoot(item, cwd); // design/06-item-types.md
    for (const file of item.files) {
      const fullPath = join(root, file.path);
      const existing = lockfile.findByPath(fullPath); // design/05-lockfile.md
      if (existsSync(fullPath)) {
        const onDiskHash = hashFile(fullPath);
        const knownHash = existing?.hash;
        const isOurs = knownHash !== undefined;
        const isUnmodified = knownHash === onDiskHash;
        if (!isOurs || (!isUnmodified && !options.force)) {
          conflicts.push(fullPath);
        }
      }
    }
  }
  if (conflicts.length > 0) {
    throw new CliError(
      `These files already exist and were not installed by consify add (or were modified since ` +
        `install), pass --force to overwrite:\n${conflicts.map((c) => `  ${c}`).join("\n")}`,
    );
  }

  // Phase C: write files, install npm deps, update the lockfile — one item at a time, in
  // dependency-first order (toInstall is already ordered that way because of the BFS above:
  // a registryDependency is always fetched and pushed before the item that declared it... NOTE:
  // this needs a topological sort in the real implementation, not just BFS order — see the
  // "ordering correctness" edge case below, this pseudocode's BFS is intentionally simplified and
  // flagged as needing the real fix).
  for (const { item, sourceUrl } of toInstall) {
    const root = resolveItemRoot(item, cwd);
    for (const file of item.files) {
      const fullPath = join(root, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content);
      console.log(`${color.green("wrote")} ${relative(cwd, fullPath)}`);
    }
    if (item.dependencies.length > 0) {
      const installSpinner = spinner(`Installing ${item.dependencies.join(", ")}...`);
      await installPackages(item.dependencies, cwd);
      installSpinner.succeed(`Installed ${item.dependencies.length} package(s)`);
    }
    lockfile.set(itemKeyFor(options.specifier /* the specifier THIS item was reached by */), {
      name: item.name,
      type: item.type,
      source: sourceUrl,
      installedAt: new Date().toISOString(),
      files: item.files.map((f) => ({ path: relative(cwd, join(root, f.path)), hash: sha256(f.content) })),
      dependencies: item.dependencies,
      registryDependencies: item.registryDependencies,
    });
  }
  writeLockfile(cwd, lockfile);

  console.log(color.bold(`\nInstalled ${toInstall.length} item(s).`));
  return 0;
}
```

### Ordering correctness (flagged in the pseudocode above — a real requirement, not optional polish)

The BFS queue order in the pseudocode does **not** guarantee a `registryDependencies` entry is
written before the item that declared it (BFS visits level-by-level, so a dependency discovered while
processing item A is queued *after* any sibling already in the queue, not necessarily before A
itself is written). The real implementation must build a proper dependency graph from the fully
resolved `toInstall` set (after Phase A completes and every item's `registryDependencies` are known)
and topologically sort it before Phase C's write loop — a straightforward DFS-based topological sort,
using each item's specifier as the graph node id. Cycle detection (already done during Phase A's BFS
via the `seen` set check) means the topological sort itself cannot fail on a cycle by the time it
runs; it exists purely to fix write order, not to re-detect what Phase A already caught.

### "Already installed" check, precisely

`itemKeyFor(specifier)` is the lockfile's key for "this exact specifier was used to install this".
Using the *specifier* (not the item's own `name` field) as the key means:
`consify add @acme/badge` and `consify add https://acme.dev/r/badge.json` (even if they resolve to
the identical URL) are tracked as **two separate** lockfile entries if both were run — this is a
deliberate simplification (matching how the RFC's Non-goals rules out version-range-aware dedup):
the lockfile records *how you asked for it*, not a canonicalized identity. Flagged as a real,
user-visible quirk worth documenting in the CLI's own `--help` / the eventual docs page for this
feature (not just this spec) — a follow-up `consify registry dedupe` command is a reasonable future
addition, not built here.

## `remove.ts`

```ts
export interface RemoveOptions {
  specifier: string;
  force: boolean;
}

export async function runRemoveCommand(options: RemoveOptions, cwd: string): Promise<number> {
  const lockfile = readLockfile(cwd);
  const key = itemKeyFor(options.specifier);
  const entry = lockfile.items[key];
  if (!entry) {
    throw new CliError(`"${options.specifier}" is not installed (nothing in consify.registry-lock.json).`);
  }

  // dependents check: does any OTHER installed item list this specifier in its own registryDependencies?
  const dependents = Object.entries(lockfile.items)
    .filter(([otherKey, other]) => otherKey !== key && other.registryDependencies.includes(options.specifier))
    .map(([, other]) => other.name);
  if (dependents.length > 0 && !options.force) {
    throw new CliError(
      `"${options.specifier}" is a dependency of: ${dependents.join(", ")}. ` +
        `Pass --force to remove it anyway (this may break them).`,
    );
  }

  const modified: string[] = [];
  const removed: string[] = [];
  for (const file of entry.files) {
    const fullPath = join(cwd, file.path);
    if (!existsSync(fullPath)) continue; // already gone, nothing to do
    if (hashFile(fullPath) !== file.hash && !options.force) {
      modified.push(file.path);
      continue;
    }
    rmSync(fullPath);
    removed.push(file.path);
  }
  if (modified.length > 0) {
    console.log(
      `${color.yellow("kept")} (modified since install, pass --force to remove anyway):\n` +
        modified.map((m) => `  ${m}`).join("\n"),
    );
  }
  for (const path of removed) console.log(`${color.red("removed")} ${path}`);

  lockfile.delete(key);
  writeLockfile(cwd, lockfile);
  console.log(`\nRemoved ${options.specifier}. npm dependencies it added were NOT removed automatically — see the RFC's open question 2.`);
  return 0;
}
```

Note the explicit, printed disclosure of the npm-dependency-pruning limitation (RFC Open question
2) — this is intentional: the command's own output is where a user is most likely to actually read
this caveat, not just a spec file.

## `package-manager.ts`

```ts
/** Mirrors create-consify's own detectPackageManager (npm_config_user_agent sniffing) — see
 *  packages/create-consify/src/cli.js for the existing, already-tested implementation this should
 *  be extracted from (or duplicated with a comment pointing at the original, if extracting into a
 *  shared module turns out awkward across the two packages' build setups — see tasks.md). */
export function detectPackageManager(cwd: string): "bun" | "npm" | "pnpm" | "yarn" {
  // 1. npm_config_user_agent env var (set when consify itself was invoked via a package manager's
  //    run-script, e.g. `bun run dev` sets it to "bun/1.2.0 ...")
  // 2. fall back to checking for bun.lock / pnpm-lock.yaml / yarn.lock / package-lock.json in cwd
  // 3. default to "npm"
}

export async function installPackages(packages: readonly string[], cwd: string): Promise<void> {
  const pm = detectPackageManager(cwd);
  const addCommand = pm === "npm" ? ["install", ...packages] : ["add", ...packages];
  const result = Bun.spawnSync([pm, ...addCommand], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new CliError(`${pm} ${addCommand.join(" ")} failed:\n${result.stderr.toString()}`);
  }
}
```

## Edge cases

- **A `registryDependencies` specifier resolves through a *different* registry than the item that
  declared it** — allowed, by design (RFC use case 5's `@acme/changelog` depending on `@acme/badge`
  is the common case, but nothing stops `@acme/thing` depending on `@other-vendor/base-component`).
  Resolution always happens against the **installing project's** `consify.registries.json`, never
  against some registry-specific config the dependency's author might have had in mind — call this
  the "resolution context" rule, and document it in the item schema's own field comment (already
  present in `design/02-registry-schema.md`) since it is the one place an author needs to know it:
  a `registryDependencies` entry using a bare name or `@namespace` assumes the *installer* has that
  namespace configured (or a default registry) — an author publishing a `registryDependencies` entry
  should prefer a full URL for anything outside their own namespace, to avoid depending on the
  installer's local config.
- **Network failure partway through fetching a large dependency chain** — Phase A fails immediately
  on the first fetch error (no partial Phase A state is ever used for Phase C), so nothing is written;
  this is the "all-or-nothing" guarantee from RFC use case 12, and it is why Phase A is fully
  separate from Phase C rather than interleaved.
- **`--force` on `add` vs. `--force` on `remove`** — two different meanings, both documented in each
  command's own `--help`: on `add`, it means "overwrite locally-modified or foreign files"; on
  `remove`, it means "delete even if locally modified, and even if something depends on it." Do not
  conflate them into one shared option description in the implementation.
- **An item with `featureId` set writes into `custom/features/<id>/`, and a DIFFERENT already-installed
  item also targets the same `featureId`** — allowed; a `feature` item creating `custom/features/status/feature.ts`
  and a separate `skill` item later attaching `custom/features/status/skill/SKILL.md` to the same
  `featureId` is exactly RFC use case-adjacent normal usage, not a conflict — the per-file overwrite
  check (Phase B) is what actually guards against collisions, not anything at the `featureId` level.
