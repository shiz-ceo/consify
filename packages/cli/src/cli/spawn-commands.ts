// `consify dev | build | typegen`: run the React Router CLI that ships with consify, so a project
// does not have to depend on `@react-router/dev` itself. `consify start` serves a server build; it
// gains one consify-specific option (`--socket`) on top of forwarding everything else to
// `@react-router/serve` unexamined.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
import { hasAnchors, runAnchorsCheck } from "../anchors.ts";
import { hasSnippets, runSnippetsCheck } from "../snippets.ts";
import { resolvePackageJson } from "./resolve-package.ts";

/** Resolves `pkg`'s bin script, preferring the project's own installed `consify`, then this package. */
function bin(cwd: string, pkg: string, name: string): string {
  const manifestPath = resolvePackageJson(cwd, pkg);
  if (!manifestPath) throw new Error(`consify: could not resolve "${pkg}" from ${cwd}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const rel = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[name];
  if (!rel) throw new Error(`consify: "${pkg}" has no "${name}" bin entry`);
  return join(dirname(manifestPath), rel);
}

function spawnAndForward(command: string, args: readonly string[], then?: () => void): void {
  const child = spawn(process.execPath, [command, ...args], { stdio: "inherit" });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else {
      process.exitCode = code ?? 0;
      if (code === 0) then?.();
    }
  });
}

/**
 * React Router writes a `.data` file next to every pre-rendered file that is not a page: a social
 * image, a feed, the compiled text of a page. Nothing asks for it (only a link to a page does), and
 * it repeats the file in full. A page has `x.data` next to the folder `x/`, so only a `.data` next to
 * a file is removed. Returns how many.
 */
export function pruneResourceData(dir: string): number {
  let removed = 0;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".data")) continue;
    const file = join(entry.parentPath, entry.name);
    try {
      if (!statSync(file.slice(0, -".data".length)).isFile()) continue;
    } catch {
      continue;
    }
    rmSync(file);
    removed++;
  }
  return removed;
}

/**
 * A static host shows `404.html` for an address it has no file for (GitHub Pages, Cloudflare Pages,
 * Netlify), and without it its own plain page. The site has no such file, but it has the page that
 * runs the site in the browser for any address (`__spa-fallback.html`), which shows the 404 of the
 * site when no page matches: the same file is `404.html`. Returns whether it was made.
 */
export function addNotFoundPage(dir: string): boolean {
  const fallback = join(dir, "__spa-fallback.html");
  const page = join(dir, "404.html");
  if (!existsSync(fallback) || existsSync(page)) return false;
  copyFileSync(fallback, page);
  return true;
}

/** `dev`, `build`, `typegen`: forward every argument to `@react-router/dev`'s own CLI, unexamined. */
export function registerSpawnCommands(program: Command): void {
  for (const sub of ["dev", "build", "typegen"] as const) {
    program
      .command(sub)
      .description(`Runs @react-router/dev's "${sub}" (every argument forwards to it unexamined)`)
      .allowUnknownOption(true)
      .argument("[args...]", "forwarded to @react-router/dev")
      .action(async (args: string[]) => {
        const cwd = process.cwd();
        // the ids of the headings and their registry, and the snippets, are checked before a build:
        // a wrong anchor or a missing snippet stops it
        const own = ["--no-anchors-check", "--no-snippets-check"];
        const rest = args.filter((arg) => !own.includes(arg));
        const steps = [
          { flag: "--no-anchors-check", what: "anchors", on: hasAnchors, run: runAnchorsCheck },
          { flag: "--no-snippets-check", what: "snippets", on: hasSnippets, run: runSnippetsCheck },
        ];
        for (const step of sub === "build" ? steps : []) {
          if (args.includes(step.flag) || !(await step.on(cwd))) continue;
          const code = await step.run(cwd, true);
          if (code !== 0) {
            console.error(
              `The build is stopped: fix the ${step.what}, or build with ${step.flag}.`,
            );
            process.exitCode = code;
            return;
          }
        }
        spawnAndForward(bin(cwd, "@react-router/dev", "react-router"), [sub, ...rest], () => {
          // a static build: `build/client` is the whole site
          if (sub === "build") {
            try {
              pruneResourceData(join(cwd, "build", "client"));
              addNotFoundPage(join(cwd, "build", "client"));
            } catch {
              // no `build/client`: nothing to clean
            }
          }
        });
      });
  }
}

/** `start [--socket <path>]`: serves a server build, either via @react-router/serve or a Unix socket. */
export function registerStartCommand(program: Command): void {
  program
    .command("start")
    .description("Serve a server build (build/server/index.js)")
    .option("--socket <path>", "Unix socket instead of a TCP port")
    .allowUnknownOption(true) // anything else forwards to @react-router/serve unexamined
    .argument("[args...]", "forwarded to @react-router/serve")
    .action(async (args: string[], options: { socket?: string }) => {
      const socketPath = options.socket ?? process.env.SOCKET_PATH;
      if (socketPath) {
        const buildPathArg = args.find((a) => !a.startsWith("--"));
        const { runServeSocketCommand } = await import("../serve-socket.ts");
        process.exitCode = await runServeSocketCommand(
          buildPathArg ?? "./build/server/index.js",
          socketPath,
          process.cwd(),
        );
        return;
      }
      spawnAndForward(bin(process.cwd(), "@react-router/serve", "react-router-serve"), [
        "./build/server/index.js",
        ...args,
      ]);
    });
}
