import { readFileSync } from "node:fs";
import { Command } from "commander";
import { registerAnchorsCommand } from "../anchors.ts";
import { registerCheckCommand } from "../check.ts";
import { registerDeployCommand } from "../deploy/command.ts";
import { consifyPackageFamily, registerDoctorCommand } from "../doctor.ts";
import { registerLangCommand } from "../lang-command.ts";
import { registerLinksCommand } from "../links-command.ts";
import { registerLocaleCommand } from "../locale-command.ts";
import { registerRegistryCommands } from "../registry/program.ts";
import { registerSkillCommand } from "../skill-command.ts";
import { resolvePackageJson } from "./resolve-package.ts";
import { registerSpawnCommands, registerStartCommand } from "./spawn-commands.ts";

/** Builds the root `consify` command. Called once by `bin/consify`. */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name("consify")
    .description("The consify CLI")
    // commander's built-in --version only prints one string; consify's --version prints every
    // installed @consify/* package, so this is handled as a custom eager option instead of
    // .version(), which cannot express "print N lines, one per installed package"
    .option("-v, --version", "print the version of every installed @consify/* package");

  program.on("option:version", () => {
    for (const pkg of consifyPackageFamily) {
      const manifestPath = resolvePackageJson(process.cwd(), pkg);
      if (!manifestPath) continue; // not installed in this project, say nothing about it
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string };
      console.log(`${pkg} ${manifest.version}`);
    }
    process.exit(0);
  });

  registerSpawnCommands(program); // dev, build, typegen
  registerStartCommand(program); // start [--socket <path>]
  registerDeployCommand(program);
  registerDoctorCommand(program);
  registerCheckCommand(program);
  registerAnchorsCommand(program);
  registerLangCommand(program);
  registerLinksCommand(program);
  registerLocaleCommand(program);
  registerSkillCommand(program);
  registerRegistryCommands(program); // add, remove, list, registry add-source/remove-source/list-sources/list

  return program;
}
