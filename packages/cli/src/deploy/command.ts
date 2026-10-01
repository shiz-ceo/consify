import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { DocsConfig } from "@consify/core";
import { loadConfig } from "@consify/core/node";
import type { Command } from "commander";
import { color } from "../colors.ts";
import { slugify } from "./slug.ts";
import { deployTargets, findTarget } from "./targets-list.ts";
import type { DeployContext, DeployTarget } from "./types.ts";

export interface DeployOptions {
  /** A target id, `list` or `check`; none runs the wizard in a terminal and lists otherwise. */
  target?: string | undefined;
  name?: string | undefined;
  domain?: string | undefined;
  path?: string | undefined;
  port?: string | number | undefined;
  socket?: string | undefined;
  ci?: boolean | undefined;
  force?: boolean | undefined;
}

/** The context a target writes its files for, from checked options. Throws on a wrong value. */
function contextFromOptions(
  options: DeployOptions,
  config: Readonly<DocsConfig>,
  cwd: string,
): DeployContext {
  const port = options.port === undefined ? undefined : Number(options.port);
  if (port !== undefined && !(Number.isInteger(port) && port > 0 && port < 65536)) {
    throw new Error(`--port must be a port number, not "${options.port}"`);
  }
  if (options.domain !== undefined && !/^[a-z0-9.-]+$/i.test(options.domain)) {
    throw new Error(
      `--domain must be a host name such as docs.example.com, not "${options.domain}"`,
    );
  }
  const { path } = options;
  if (path !== undefined && (!/^\/[\w./-]*$/.test(path) || path.includes(".."))) {
    throw new Error(`--path must be an address such as /docs, not "${path}"`);
  }
  return {
    config,
    cwd,
    slug: slugify(options.name ?? config.site.name),
    domain: options.domain,
    path: options.path,
    port,
    socket: options.socket,
    ci: options.ci ?? false,
  };
}

function list(): number {
  console.log(color.bold("Targets `consify deploy <target>` knows:\n"));
  const width = Math.max(...deployTargets.map((target) => target.id.length));
  for (const target of deployTargets) {
    console.log(`  ${target.id.padEnd(width)}  ${target.description}`);
  }
  console.log("\nEach one prints what to configure on the host after it writes its files.");
  return 0;
}

/** `consify deploy check`: whether the current config fits the deploy.mode a static host needs. */
async function check(cwd: string): Promise<number> {
  const config = await loadConfig(cwd);
  const problems: string[] = [];
  if (config.deploy.mode === "static" && !config.site.url) {
    problems.push(
      "site.url is not set: the sitemap, canonical links and Open Graph tags need an absolute address.",
    );
  }
  const fitting = deployTargets.filter((target) => target.modes.includes(config.deploy.mode));
  console.log(
    `deploy.mode is "${config.deploy.mode}": ${fitting.map((target) => target.id).join(", ")} can serve it.`,
  );
  if (problems.length === 0) {
    console.log(`${color.green("✓")} Nothing obviously wrong for a deploy.`);
    return 0;
  }
  for (const problem of problems) console.log(`${color.red("✗")} ${problem}`);
  return 1;
}

/** Writes a target's files (honoring `force`, or an interactive overwrite prompt) and its notes. */
async function writeTarget(
  target: DeployTarget,
  ctx: DeployContext,
  force: boolean,
  confirmOverwrite?: (paths: string[]) => Promise<boolean>,
): Promise<number> {
  if (target.modes.length === 1 && !target.modes.includes(ctx.config.deploy.mode)) {
    console.error(
      color.red(
        `${target.label} only serves ${target.modes[0]} builds; set deploy.mode: "${target.modes[0]}" in docs.config.ts first (or pick a different target).`,
      ),
    );
    return 1;
  }

  const files = target.write(ctx);
  let effectiveForce = force;

  let blocked = files.filter((file) => !effectiveForce && existsSync(join(ctx.cwd, file.path)));
  if (blocked.length > 0 && confirmOverwrite) {
    effectiveForce = await confirmOverwrite(blocked.map((file) => file.path));
    if (effectiveForce) blocked = [];
  }
  if (blocked.length > 0) {
    console.error(
      color.red(
        `These files already exist, pass --force to replace them:\n${blocked.map((f) => `  ${f.path}`).join("\n")}`,
      ),
    );
    return 1;
  }

  for (const file of files) {
    const full = join(ctx.cwd, file.path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content);
    console.log(`${color.green("wrote")} ${file.path}`);
  }

  console.log(color.bold("\nNext:"));
  for (const note of target.notes(ctx)) console.log(`${color.cyan("-")} ${note}`);
  return 0;
}

/** `consify deploy` with no target, in a real terminal: asks instead of just listing. */
async function wizard(cwd: string): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(color.bold("Which target?\n"));
    const width = Math.max(...deployTargets.map((target) => target.id.length));
    deployTargets.forEach((target, index) => {
      console.log(
        `  ${color.cyan(`${index + 1}`)}) ${target.id.padEnd(width)}  ${target.description}`,
      );
    });

    const choice = (await rl.question("\nNumber or id (blank to cancel): ")).trim();
    if (!choice) return 0;
    const target = deployTargets[Number(choice) - 1] ?? findTarget(choice);
    if (!target) {
      console.error(color.red(`Unknown target "${choice}".`));
      return 1;
    }

    const config = await loadConfig(cwd);
    // the same options the command line takes, asked one by one
    const options: Record<string, string | boolean> = {};
    for (const flag of target.flags ?? []) {
      const name = /^--(\S+)/.exec(flag)?.[1];
      if (!name) continue;
      if (flag.includes("<")) {
        const value = (await rl.question(`${flag} (blank to skip): `)).trim();
        if (value) options[name] = value;
      } else if (/^y/i.test((await rl.question(`${flag}? (y/N): `)).trim())) {
        options[name] = true;
      }
    }

    const ctx = contextFromOptions(options as DeployOptions, config, cwd);
    return await writeTarget(target, ctx, options.force === true, async (paths) => {
      const answer = await rl.question(
        `\nThese already exist:\n${paths.map((p) => `  ${p}`).join("\n")}\nOverwrite? (y/N): `,
      );
      return /^y/i.test(answer.trim());
    });
  } finally {
    rl.close();
  }
}

/** `consify deploy [target]`. Returns the exit code. */
export async function runDeploy(options: DeployOptions, cwd: string): Promise<number> {
  const { target: sub } = options;
  if (!sub) return process.stdin.isTTY ? wizard(cwd) : list();
  if (sub === "list") return list();
  if (sub === "check") return check(cwd);

  const target = findTarget(sub);
  if (!target) {
    console.error(
      color.red(`Unknown target "${sub}". Run \`consify deploy list\` to see the ones there are.`),
    );
    return 1;
  }

  const config = await loadConfig(cwd);
  let ctx: DeployContext;
  try {
    ctx = contextFromOptions(options, config, cwd);
  } catch (error) {
    console.error(color.red((error as Error).message));
    return 1;
  }
  return writeTarget(target, ctx, options.force ?? false);
}

/** Registers `deploy` on the root program. Called once by cli/program.ts. */
export function registerDeployCommand(program: Command): void {
  program
    .command("deploy [target]")
    .description(
      "Write the files a hosting target needs (or `list`/`check` them); no target opens a wizard in a terminal",
    )
    .option("--name <slug>", "URL/filename-safe name for the site")
    .option("--domain <host>", "domain for a generated nginx server block")
    .option("--path <prefix>", "share an existing domain instead of a server block of its own")
    .option("--port <number>", "TCP port for a self-hosted server build")
    .option("--socket <path>", "Unix socket instead of a TCP port")
    .option("--ci", "also write a GitHub Actions workflow")
    .option("--force", "overwrite files the target already wrote")
    .action(async (target: string | undefined, options: DeployOptions) => {
      process.exitCode = await runDeploy({ ...options, target }, process.cwd());
    });
}
