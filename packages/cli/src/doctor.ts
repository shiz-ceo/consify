import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "@consify/core/node";
import type { Command } from "commander";
import { color } from "./colors.ts";

/** The `@consify/*` packages: `consify doctor` compares their versions, `consify --version` prints them. */
export const consifyPackageFamily = [
  "@consify/core",
  "@consify/docs",
  "@consify/blog",
  "@consify/api-reference",
  "@consify/cli",
  "@consify/create",
] as const;

interface Check {
  label: string;
  ok: boolean;
  detail?: string | undefined;
}

function versionOf(cwd: string, name: string): string | undefined {
  try {
    const require = createRequire(pathToFileURL(join(cwd, "package.json")).href);
    const manifest = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), "utf8")) as {
      version: string;
    };
    return manifest.version;
  } catch {
    return undefined;
  }
}

function nodeVersionCheck(): Check {
  const major = Number(process.versions.node.split(".")[0]);
  const ok = major >= 22;
  return {
    label: `Node.js ${process.versions.node}`,
    ok,
    detail: ok ? undefined : "consify needs Node >= 22. Upgrade Node.",
  };
}

function versionsCheck(cwd: string): Check {
  const versions = consifyPackageFamily
    .map((name) => [name, versionOf(cwd, name)] as const)
    .filter(
      (entry): entry is readonly [(typeof consifyPackageFamily)[number], string] =>
        entry[1] !== undefined,
    );
  const distinct = new Set(versions.map(([, version]) => version));
  return {
    label: `installed packages (${versions.map(([name, version]) => `${name}@${version}`).join(", ") || "none"})`,
    ok: distinct.size <= 1,
    detail:
      distinct.size > 1
        ? `these should all be the same version: bun update ${versions.map(([name]) => name).join(" ")}`
        : undefined,
  };
}

async function configCheck(cwd: string): Promise<Check> {
  try {
    await loadConfig(cwd);
    return { label: "docs.config.ts", ok: true };
  } catch (error) {
    return { label: "docs.config.ts", ok: false, detail: (error as Error).message };
  }
}

/** `consify doctor`: Node version, matching package versions, a valid config. Returns the exit code. */
export async function runDoctor(cwd: string): Promise<number> {
  const checks = [nodeVersionCheck(), versionsCheck(cwd), await configCheck(cwd)];
  for (const check of checks) {
    console.log(`${check.ok ? color.green("✓") : color.red("✗")} ${check.label}`);
    if (!check.ok && check.detail) console.log(color.dim(`  ${check.detail}`));
  }
  return checks.every((check) => check.ok) ? 0 : 1;
}

/** Registers `doctor` on the root program. Called once by cli/program.ts. */
export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Check the Node version, package versions and the config")
    .action(async () => {
      process.exitCode = await runDoctor(process.cwd());
    });
}
