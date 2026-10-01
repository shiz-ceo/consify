// `consify dev | build | typegen`: run the React Router CLI that ships with consify, so a project
// does not have to depend on `@react-router/dev` itself. `consify start` serves a server build; it
// gains one consify-specific option (`--socket`) on top of forwarding everything else to
// `@react-router/serve` unexamined.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";
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

function spawnAndForward(command: string, args: readonly string[]): void {
  const child = spawn(process.execPath, [command, ...args], { stdio: "inherit" });
  child.on("exit", (code, signal) =>
    signal ? process.kill(process.pid, signal) : (process.exitCode = code ?? 0),
  );
}

/** `dev`, `build`, `typegen`: forward every argument to `@react-router/dev`'s own CLI, unexamined. */
export function registerSpawnCommands(program: Command): void {
  for (const sub of ["dev", "build", "typegen"] as const) {
    program
      .command(sub)
      .description(`Runs @react-router/dev's "${sub}" (every argument forwards to it unexamined)`)
      .allowUnknownOption(true)
      .argument("[args...]", "forwarded to @react-router/dev")
      .action((args: string[]) => {
        spawnAndForward(bin(process.cwd(), "@react-router/dev", "react-router"), [sub, ...args]);
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
