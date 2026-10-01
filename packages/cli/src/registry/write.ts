// Conflict detection and file writing for `consify add`.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { CliError } from "../cli/errors.ts";
import { color } from "../colors.ts";
import type { FetchedItem } from "./fetch.ts";
import { resolveItemRoot } from "./item-types.ts";
import {
  hashFile,
  itemKeyFor,
  type LockfileEntry,
  type LockfileHandle,
  lockPath,
  sha256,
} from "./lockfile.ts";

export interface WriteOptions {
  force: boolean;
}

/** One resolved item, paired with the specifier it was actually reached by (for the lockfile key). */
export interface ToInstall {
  fetched: FetchedItem;
  specifier: string;
}

/**
 * Throws `CliError`, before anything is written, when two items of the batch write the same file,
 * or (without `force`) when a file already exists and is not ours or was modified since install.
 */
export function assertNoConflicts(
  toInstall: readonly ToInstall[],
  lockfile: LockfileHandle,
  cwd: string,
  force: boolean,
): void {
  const conflicts: string[] = [];
  const claimed = new Map<string, string>();
  for (const { fetched } of toInstall) {
    const { item } = fetched;
    if (item.type === "feature") continue; // installs an npm package, writes no files
    const root = resolveItemRoot(item, cwd);
    for (const file of item.files) {
      const fullPath = join(root, file.path);
      const owner = claimed.get(fullPath);
      if (owner !== undefined && owner !== item.name) {
        throw new CliError(
          `"${owner}" and "${item.name}" both write ${relative(cwd, fullPath)}, install them separately.`,
        );
      }
      claimed.set(fullPath, item.name);
      if (force || !existsSync(fullPath)) continue;
      const existing = lockfile.findByPath(fullPath);
      if (existing === undefined || existing.hash !== hashFile(fullPath)) {
        conflicts.push(relative(cwd, fullPath));
      }
    }
  }
  if (conflicts.length > 0) {
    throw new CliError(
      "These files already exist and were not installed by consify add (or were modified since " +
        `install), pass --force to overwrite:\n${conflicts.map((c) => `  ${c}`).join("\n")}`,
    );
  }
}

function buildEntry(fetched: FetchedItem, writtenFiles: LockfileEntry["files"]): LockfileEntry {
  const { item, sourceUrl } = fetched;
  return {
    name: item.name,
    type: item.type,
    source: sourceUrl,
    installedAt: new Date().toISOString(),
    files: writtenFiles,
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
    ...(item.type === "feature" ? { packageName: item.packageName } : {}),
  };
}

/**
 * Writes every item of `toInstall` (dependencies first) and records it in `lockfile` in memory; the
 * caller persists the lockfile. A `feature` item writes no files, its package is installed by
 * `add.ts`, but it still gets a lockfile entry so `consify list` shows it.
 */
export function writeItems(
  toInstall: readonly ToInstall[],
  lockfile: LockfileHandle,
  options: WriteOptions,
  cwd: string,
): void {
  assertNoConflicts(toInstall, lockfile, cwd, options.force);

  for (const { fetched, specifier } of toInstall) {
    const { item } = fetched;

    if (item.type === "feature") {
      console.log(
        color.dim(
          "\nAdd it to features in docs.config.ts to enable it:\n\n" +
            `  import { ${item.exportName} } from "${item.packageName}";\n` +
            `  features: [..., ${item.exportName}()],`,
        ),
      );
      lockfile.set(itemKeyFor(specifier), buildEntry(fetched, []));
      continue;
    }

    const root = resolveItemRoot(item, cwd);
    const writtenFiles: LockfileEntry["files"] = [];
    for (const file of item.files) {
      const fullPath = join(root, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content);
      console.log(`${color.green("wrote")} ${relative(cwd, fullPath)}`);
      writtenFiles.push({ path: lockPath(cwd, fullPath), hash: sha256(file.content) });
    }

    lockfile.set(itemKeyFor(specifier), buildEntry(fetched, writtenFiles));
  }
}
