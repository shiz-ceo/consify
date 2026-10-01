// Runs the end-to-end tests (Playwright) on production builds of the demo site: first the server
// build (desktop and phone), then the static build.
//
//   bun run e2e                     everything
//   bun run e2e -- --grep search    extra arguments go to Playwright
//   bun run e2e --skip-build        use the builds that are there
//
// Playwright needs a browser once: `bunx playwright install chromium` (CI: `--with-deps`).
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--skip-build");
const skipBuild = process.argv.includes("--skip-build");

function run(cwd: string, env: Record<string, string>, ...command: string[]): void {
  console.log(`\n$ ${command.join(" ")}`);
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode ?? 1);
}

const e2e = join(root, "e2e");

if (!skipBuild) run(root, {}, "bun", "run", "build:demo");
run(e2e, {}, "bunx", "playwright", "test", ...args);

if (!skipBuild) run(root, { DEMO_STATIC: "1" }, "bun", "run", "build:demo");
run(e2e, { E2E_MODE: "static" }, "bunx", "playwright", "test", "--project=desktop", ...args);
