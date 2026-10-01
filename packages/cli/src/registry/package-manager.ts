// Detects and runs the project's package manager for the npm packages of registry items.
// (`create-consify` has its own user-agent-only detection: it runs before any lockfile exists.)
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "../cli/errors.ts";

export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

function fromUserAgent(userAgent: string | undefined): PackageManager | undefined {
  const name = userAgent?.split(" ")[0]?.split("/")[0];
  return name === "bun" || name === "pnpm" || name === "yarn" || name === "npm" ? name : undefined;
}

/**
 * The lockfile of the project decides (`npx consify add` in a Bun project still means `bun add`),
 * then `npm_config_user_agent`, then npm.
 */
export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) return "bun";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  return fromUserAgent(process.env.npm_config_user_agent) ?? "npm";
}

/**
 * `child_process.spawnSync` and not `Bun.spawnSync`: the CLI also runs under plain Node. On Windows
 * npm, pnpm and yarn are `.cmd` files, which only start through a shell (Node refuses to spawn
 * `.cmd` directly since the CVE-2024-27980 fix). The arguments are validated package specs
 * (`schema.ts`: no cmd.exe metacharacters except `^`, the escape character, which is doubled here).
 */
export async function installPackages(packages: readonly string[], cwd: string): Promise<void> {
  const pm = detectPackageManager(cwd);
  const addCommand = pm === "npm" ? ["install", ...packages] : ["add", ...packages];
  const windows = process.platform === "win32";
  const args = windows ? addCommand.map((arg) => arg.replaceAll("^", "^^")) : addCommand;
  const result = spawnSync(pm, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
    shell: windows,
  });
  if (result.status !== 0) {
    throw new CliError(`${pm} ${addCommand.join(" ")} failed:\n${result.stderr ?? result.error}`);
  }
}
