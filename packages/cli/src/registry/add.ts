// `consify add <specifier>`: fetches the item and its registryDependencies, installs their npm
// packages, writes their files with overwrite protection and records them in the lockfile.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "../cli/errors.ts";
import { spinner } from "../cli/spinner.ts";
import { readRegistriesFile } from "./config.ts";
import { type FetchedItem, fetchRegistryItem } from "./fetch.ts";
import {
  hashFile,
  itemKeyFor,
  type LockfileHandle,
  readLockfile,
  writeLockfile,
} from "./lockfile.ts";
import { installPackages } from "./package-manager.ts";
import { resolveSpecifier } from "./resolve.ts";
import { assertNoConflicts, type ToInstall, writeItems } from "./write.ts";

/**
 * Whether every file of this specifier's lockfile entry is still on disk unchanged. Being in the
 * lockfile is not enough: a modified file must still be reported as a conflict.
 */
function isUnmodifiedSinceInstall(
  specifier: string,
  lockfile: LockfileHandle,
  cwd: string,
): boolean {
  const entry = lockfile.items[itemKeyFor(specifier)];
  if (!entry) return false;
  return entry.files.every((file) => {
    const fullPath = join(cwd, file.path);
    return existsSync(fullPath) && hashFile(fullPath) === file.hash;
  });
}

export interface AddOptions {
  specifier: string;
  force: boolean;
}

/**
 * Resolves and fetches the whole dependency tree before anything is written, so a failed fetch
 * leaves the project untouched. A specifier reached twice (a shared dependency) is fetched once;
 * real cycles are rejected by `topologicalSort`.
 */
async function resolveAndFetchAll(
  rootSpecifier: string,
  force: boolean,
  cwd: string,
): Promise<Map<string, FetchedItem>> {
  const registries = readRegistriesFile(cwd);
  const lockfile = readLockfile(cwd);

  const fetchedBySpecifier = new Map<string, FetchedItem>();
  const seen = new Set<string>(); // specifiers already queued or fetched
  const queue: string[] = [rootSpecifier];
  const fetchSpinner = spinner(`Resolving ${rootSpecifier}...`);

  while (queue.length > 0) {
    const specifier = queue.shift() as string;
    if (seen.has(specifier)) continue;
    seen.add(specifier);
    if (
      lockfile.items[itemKeyFor(specifier)] &&
      !force &&
      isUnmodifiedSinceInstall(specifier, lockfile, cwd)
    ) {
      continue; // already installed under this exact specifier, unmodified — genuinely nothing to do
    }
    const resolved = resolveSpecifier(specifier, registries);
    fetchSpinner.update(`Fetching ${resolved.displaySpecifier}...`);
    const fetched = await fetchRegistryItem(resolved);
    fetchedBySpecifier.set(specifier, fetched);
    for (const dep of fetched.item.registryDependencies) {
      if (!seen.has(dep)) queue.push(dep);
    }
  }
  fetchSpinner.succeed(`Resolved ${fetchedBySpecifier.size} item(s)`);
  return fetchedBySpecifier;
}

/** Orders the batch dependencies first, and rejects a cycle in `registryDependencies`. */
export function topologicalSort(fetchedBySpecifier: ReadonlyMap<string, FetchedItem>): ToInstall[] {
  const result: ToInstall[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const path: string[] = [];

  function visit(specifier: string): void {
    if (visited.has(specifier)) return;
    const fetched = fetchedBySpecifier.get(specifier);
    if (!fetched) return; // an already-installed dependency, not part of this batch
    if (visiting.has(specifier)) {
      const cycleStart = path.indexOf(specifier);
      throw new CliError(
        `Circular registryDependencies: ${[...path.slice(cycleStart), specifier].join(" -> ")}`,
      );
    }
    visiting.add(specifier);
    path.push(specifier);
    for (const dep of fetched.item.registryDependencies) visit(dep);
    path.pop();
    visiting.delete(specifier);
    visited.add(specifier);
    result.push({ fetched, specifier });
  }

  for (const specifier of fetchedBySpecifier.keys()) visit(specifier);
  return result;
}

export async function runAddCommand(options: AddOptions, cwd: string): Promise<number> {
  const fetchedBySpecifier = await resolveAndFetchAll(options.specifier, options.force, cwd);

  if (fetchedBySpecifier.size === 0) {
    console.log(`${options.specifier} is already installed. Pass --force to reinstall.`);
    return 0;
  }

  const toInstall = topologicalSort(fetchedBySpecifier);
  const lockfile = readLockfile(cwd);
  // Packages go in before any file is written: a failed install then leaves no orphaned files.
  assertNoConflicts(toInstall, lockfile, cwd, options.force);

  const allDependencies = toInstall.flatMap(({ fetched }) => {
    const { item } = fetched;
    if (item.type === "feature") {
      const packageSpec = item.packageVersion
        ? `${item.packageName}@${item.packageVersion}`
        : item.packageName;
      return [packageSpec, ...item.dependencies];
    }
    return item.dependencies;
  });
  if (allDependencies.length > 0) {
    const installSpinner = spinner(`Installing ${allDependencies.join(", ")}...`);
    await installPackages(allDependencies, cwd);
    installSpinner.succeed(`Installed ${allDependencies.length} package(s)`);
  }

  writeItems(toInstall, lockfile, { force: options.force }, cwd);
  writeLockfile(cwd, lockfile);
  console.log(`\nInstalled ${toInstall.length} item(s).`);
  if (toInstall.some(({ fetched }) => fetched.item.type === "skill")) {
    console.log("Run `consify skill sync` to pick up the new skill for Claude.");
  }
  return 0;
}
