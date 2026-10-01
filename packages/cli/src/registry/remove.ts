import { existsSync, rmSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import { CliError } from "../cli/errors.ts";
import { color } from "../colors.ts";
import { hashFile, itemKeyFor, readLockfile, writeLockfile } from "./lockfile.ts";

export interface RemoveOptions {
  specifier: string;
  force: boolean;
}

export async function runRemoveCommand(options: RemoveOptions, cwd: string): Promise<number> {
  const lockfile = readLockfile(cwd);
  const key = itemKeyFor(options.specifier);
  const entry = lockfile.items[key];
  if (!entry) {
    throw new CliError(
      `"${options.specifier}" is not installed (nothing in consify.registry-lock.json).`,
    );
  }

  // dependents check: does any OTHER installed item list this specifier in its own registryDependencies?
  const dependents = Object.entries(lockfile.items)
    .filter(
      ([otherKey, other]) =>
        otherKey !== key && other.registryDependencies.includes(options.specifier),
    )
    .map(([, other]) => other.name);
  if (dependents.length > 0 && !options.force) {
    throw new CliError(
      `"${options.specifier}" is a dependency of: ${dependents.join(", ")}. ` +
        "Pass --force to remove it anyway (this may break them).",
    );
  }

  // the lockfile is a file of the project anyone can edit: check every path before deleting any
  const targets = entry.files.map((file) => {
    const fullPath = join(cwd, file.path);
    const inside = relative(cwd, fullPath);
    if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
      throw new CliError(
        `consify.registry-lock.json lists a path outside the project: ${file.path}`,
      );
    }
    return { file, fullPath };
  });

  const modified: string[] = [];
  const removed: string[] = [];
  for (const { file, fullPath } of targets) {
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
      `${color.yellow("kept")} (modified since install, pass --force to remove anyway):\n${modified
        .map((m) => `  ${m}`)
        .join("\n")}`,
    );
  }
  for (const path of removed) console.log(`${color.red("removed")} ${path}`);

  lockfile.delete(key);
  writeLockfile(cwd, lockfile);
  if (entry.packageName) {
    console.log(
      `\nRemoved ${options.specifier} from consify.registry-lock.json. The npm package itself was ` +
        `not removed — uninstall ${entry.packageName} yourself if you no longer need it.`,
    );
  } else {
    console.log(
      `\nRemoved ${options.specifier}. npm dependencies it added were NOT removed automatically.`,
    );
  }
  return 0;
}
