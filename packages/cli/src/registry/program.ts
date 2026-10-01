import type { Command } from "commander";
import { z } from "zod";
import { runAction } from "../cli/errors.ts";
import { runAddCommand } from "./add.ts";
import { registerListCommand } from "./list.ts";
import { runRemoveCommand } from "./remove.ts";
import { registerRegistrySourceCommands } from "./sources.ts";

const addOptionsSchema = z.object({
  specifier: z.string(),
  force: z.boolean().default(false),
});

const removeOptionsSchema = z.object({
  specifier: z.string(),
  force: z.boolean().default(false),
});

/**
 * Registers every registry-related command: `consify add`/`consify remove`/`consify list`, and the
 * `consify registry` group (`add-source`/`remove-source`/`list-sources`/`list`, the last one being
 * an alias of the top-level `consify list` — grouped under `registry` too for discoverability via
 * `consify registry --help`).
 */
export function registerRegistryCommands(program: Command): void {
  program
    .command("add <specifier>")
    .description('Install a registry item ("@namespace/name", a bare name, or a full URL)')
    .option("--force", "overwrite a locally-modified or foreign file")
    .action(async (specifier: string, rawOptions: Record<string, unknown>) => {
      const options = addOptionsSchema.parse({ ...rawOptions, specifier });
      process.exitCode = await runAction(() => runAddCommand(options, process.cwd()));
    });

  program
    .command("remove <specifier>")
    .description("Uninstall a registry item")
    .option("--force", "delete even if locally modified, and even if something depends on it")
    .action(async (specifier: string, rawOptions: Record<string, unknown>) => {
      const options = removeOptionsSchema.parse({ ...rawOptions, specifier });
      process.exitCode = await runAction(() => runRemoveCommand(options, process.cwd()));
    });

  const registry = program.command("registry").description("Manage registries and installed items");
  registerRegistrySourceCommands(registry);
  registerListCommand(program, registry);
}
