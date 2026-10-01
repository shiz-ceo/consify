import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { runAction } from "../cli/errors.ts";
import { color } from "../colors.ts";
import { hashFile, readLockfile } from "./lockfile.ts";

/** `consify list` / `consify registry list`: what's installed from a registry, per the lockfile. */
export function runListCommand(cwd: string): number {
  const lockfile = readLockfile(cwd);
  const entries = Object.entries(lockfile.items);
  if (entries.length === 0) {
    console.log("Nothing installed from a registry yet. See `consify add --help`.");
    return 0;
  }
  const nameWidth = Math.max(...entries.map(([key]) => key.length));
  const typeWidth = Math.max(...entries.map(([, entry]) => entry.type.length));
  for (const [key, entry] of entries) {
    const missing = entry.files.some((f) => !existsSync(join(cwd, f.path)));
    const modified = !missing && entry.files.some((f) => hashFile(join(cwd, f.path)) !== f.hash);
    const flag = missing ? color.red("missing files") : modified ? color.yellow("modified") : "";
    console.log(
      `  ${key.padEnd(nameWidth)}  ${entry.type.padEnd(typeWidth)}  ${entry.source}  ${flag}`.trimEnd(),
    );
  }
  return 0;
}

/** Registers `consify list` and `consify registry list` (an alias for the same command). */
export function registerListCommand(program: Command, registry: Command): void {
  const action = async () => {
    process.exitCode = await runAction(async () => runListCommand(process.cwd()));
  };
  program.command("list").description("List what consify add has installed").action(action);
  registry
    .command("list")
    .description("List what consify add has installed (same as `consify list`)")
    .action(action);
}
