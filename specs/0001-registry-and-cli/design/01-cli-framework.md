# Component: the CLI framework (commander + zod migration)

## Purpose

Replace every hand-rolled `args.includes("--force")` / `args.indexOf("--name")` pattern across the
CLI with commander for parsing and zod for validation, **without changing the observable behavior
of any currently-valid command invocation**, and without requiring every existing test file to
change.

## New dependency

Add `commander` to `packages/core/package.json` `dependencies` (zod is already there, `4.6.5`).
Pin a major version explicitly (`"commander": "^14.0.0"` — the current major as of this RFC; the
implementer should check `npm view commander version` at implementation time and use whatever the
current major is, since commander does occasionally ship breaking changes between majors).

## Files

- `packages/core/src/build/cli/program.ts` — builds and returns the root `Command`.
- `packages/core/src/build/cli/legacy-run.ts` — the compatibility wrapper factory.
- `packages/core/src/build/cli/spinner.ts` — the animated spinner.
- `packages/core/src/build/cli/errors.ts` — `CliError` and shared error-to-exit-code handling.
- `packages/core/bin/consify` — rewritten to build the program and run it (see below).

## The core pattern: one command definition, two ways to run it

Every command module (e.g. `packages/core/src/build/deploy/command.ts`) exports **three** things
instead of the current one:

```ts
// packages/core/src/build/deploy/command.ts (shape, not full content — see the existing file for
// what deployTargets/writeTarget/etc. already do; only the entry points change)
import { Command } from "commander";
import { z } from "zod";
import { makeLegacyRunner } from "../cli/legacy-run.ts";

/** What `deploy <target>` accepts, after commander has parsed strings into this shape. */
const deployOptionsSchema = z.object({
  target: z.string().optional(), // positional; undefined means "run the wizard or list"
  name: z.string().optional(),
  domain: z.string().optional(),
  path: z.string().optional(),
  port: z.coerce.number().int().positive().optional(),
  socket: z.string().optional(),
  ci: z.boolean().default(false),
  force: z.boolean().default(false),
});
export type DeployOptions = z.infer<typeof deployOptionsSchema>;

/** Registers `deploy` on the root program. Called once by cli/program.ts. */
export function registerDeployCommand(program: Command): void {
  program
    .command("deploy [target]")
    .description("Write the files a hosting target needs, or list/check them")
    .option("--name <slug>", "URL/filename-safe name for the site")
    .option("--domain <host>", "domain for a generated nginx server block")
    .option("--path <prefix>", "share an existing domain instead of a server block of its own")
    .option("--port <number>", "TCP port for a self-hosted server build")
    .option("--socket <path>", "Unix socket instead of a TCP port")
    .option("--ci", "also write a GitHub Actions workflow")
    .option("--force", "overwrite files the target already wrote")
    .action(async (target: string | undefined, rawOptions: Record<string, unknown>, cmd: Command) => {
      const options = deployOptionsSchema.parse({ ...rawOptions, target });
      process.exitCode = await runDeployLogic(options, process.cwd());
    });
}

/** The actual logic, unchanged in substance from what today's runDeployCommand body does. */
async function runDeployLogic(options: DeployOptions, cwd: string): Promise<number> {
  // ... existing list()/check()/writeTarget()/wizard() logic, reading from `options` instead of
  // re-parsing `args` by hand. This is a mechanical refactor of the existing function bodies.
}

/**
 * Backward-compatible entry point: everything that imports `runDeployCommand` from `consify/node`
 * today (tests, `bin/consify`'s old dispatch, any external code) keeps working unchanged.
 */
export const runDeployCommand = makeLegacyRunner("deploy", registerDeployCommand);
```

This shape (a `registerXCommand(program)` function + a schema + a `runXLogic` + a
`makeLegacyRunner`-produced `runXCommand`) is **repeated identically** for every existing command:

| Existing file | Existing export | New `register*Command` | New options schema |
| --- | --- | --- | --- |
| `build/deploy/command.ts` | `runDeployCommand` | `registerDeployCommand` | `deployOptionsSchema` |
| `build/doctor.ts` | `runDoctorCommand` | `registerDoctorCommand` | `doctorOptionsSchema` (empty object — doctor takes no flags today, kept for symmetry and future-proofing) |
| `build/docs-command.ts` | `runDocsCommand` | `registerDocsCommand` | `docsCheckOptionsSchema` (`languages`, `strict`) — registered as `docs check` subcommand |
| `build/skill-command.ts` | `runSkillCommand` | `registerSkillCommand` | `skillSyncOptionsSchema` (`force`) — registered as `skill sync` / `skill list` subcommands |
| `build/lang-command.ts` | `runLangCommand` | `registerLangCommand` | `langAddOptionsSchema` (`language`, `copy`), `langStatusOptionsSchema` (`language?`, `missing`) — two subcommands, `lang add` / `lang status` |
| `build/links-command.ts` | `runLinksCommand` | `registerLinksCommand` | `linksOptionsSchema` (`language?`) |
| `locales/template.ts` | `runLocaleCommand` | `registerLocaleCommand` | `localeOptionsSchema` (`language`, `force`) |
| `build/serve-socket.ts` | (not previously a standalone CLI command — invoked ad hoc from `bin/consify`'s `start` branch) | folded into `registerStartCommand` in `bin/consify`'s own program setup (see below) | `startOptionsSchema` (`socket?`) |

Every one of these is a **mechanical** refactor: the body of `list()`/`check()`/`add()`/`status()`/
etc. inside each file does not change its logic, only where its inputs come from (a validated
`options` object instead of hand-parsed `args`).

## `makeLegacyRunner`

```ts
// packages/core/src/build/cli/legacy-run.ts
import { Command, CommanderError } from "commander";

/**
 * Wraps a `register*Command` function into the `(args, cwd) => Promise<number>` shape every
 * existing caller (tests, `consify/node` consumers) already uses. Builds a throwaway root Command
 * containing only the one subcommand, so parsing `["deploy", "--name", "x"]` behaves exactly as it
 * would inside the real program, in isolation.
 */
export function makeLegacyRunner(
  commandName: string,
  register: (program: Command) => void,
): (args: readonly string[], cwd: string) => Promise<number> {
  return async (args: readonly string[], cwd: string): Promise<number> => {
    const program = new Command();
    program.exitOverride(); // throw CommanderError instead of process.exit on --help/parse errors
    program.configureOutput({
      // commander writes usage/error text itself; route it through console.error so legacy
      // callers that assert on printed output (several existing tests do) keep seeing it
      writeErr: (str) => process.stderr.write(str),
    });
    register(program);
    // legacy callers pass args *without* a leading command name for some commands (e.g.
    // runLinksCommand(["ru"], cwd) — no "links" prefix) and *with* it for others
    // (runDeployCommand(["deploy", "--name", "x"], cwd) does NOT include "deploy" either — see the
    // exact calling convention note below). We always parse as the single subcommand's own args.
    const previousCwd = process.cwd();
    if (cwd !== previousCwd) process.chdir(cwd); // options schemas call process.cwd() internally
    try {
      await program.parseAsync([commandName, ...args], { from: "user" });
      return process.exitCode ?? 0;
    } catch (error) {
      if (error instanceof CommanderError) {
        // commander already printed its own message via configureOutput above
        return error.exitCode === 0 ? 0 : 1;
      }
      throw error; // a real bug in the action handler — do not swallow it
    } finally {
      process.exitCode = undefined;
      if (cwd !== previousCwd) process.chdir(previousCwd);
    }
  };
}
```

**Important calling-convention detail, verified against the current code before writing this**:
today's `runDeployCommand(args, cwd)` is called with `args` that do **not** include the word
`"deploy"` (e.g. `runDeployCommand(["docker", "--name", "docs"], cwd)` — the first element is the
*target*, not the command name — see `packages/core/test/deploy.test.ts`). The wrapper above must
therefore prepend the command's own name (`commandName`) before `args`, not assume `args[0]` already
is it. The table above reflects this: `makeLegacyRunner("deploy", registerDeployCommand)` is called
as `runDeployCommand(["docker", "--name", "docs"], cwd)`, and internally becomes
`program.parseAsync(["deploy", "docker", "--name", "docs"], { from: "user" })`.

Cross-check every existing test file's exact call shape before wiring each command's wrapper —
`packages/core/test/deploy.test.ts`, `packages/core/test/skill.test.ts`,
`packages/core/test/docs-check.test.ts`, `packages/core/test/lang.test.ts`,
`packages/core/test/links.test.ts`, `packages/core/test/locales.test.ts` are the ones that
exercise these entry points directly and must keep passing unmodified — this is a hard acceptance
criterion for Phase 1/2 of `tasks.md`, not a nice-to-have.

### Subcommands-of-subcommands (`lang add`, `lang status`, `docs check`, `skill sync`, `skill list`)

commander supports nested commands natively (`program.command("lang").command("add ...")` or, more
idiomatically, `program.command("lang add <language>")` directly on the root program using a space
in the command string — either works; use the flatter `program.command("lang add <language>")` form
throughout for consistency, since it avoids an extra intermediate `Command` object per group and
matches how the existing code already treats `lang add`/`lang status` as effectively two unrelated
commands that happen to share a prefix).

## `bin/consify` after the migration

```js
#!/usr/bin/env node
import { buildProgram } from "consify/node"; // cli/program.ts's export, re-exported from node.ts
await buildProgram().parseAsync(process.argv);
```

That is the **entire file** (modulo the `#!/usr/bin/env node` shebang and, if it turns out simpler
in practice, keeping the file as `.js` rather than moving the whole entry point into the TS-built
package — the file is trivial either way and stays a plain Node ESM `.js` file, not compiled, exactly
as it is today, since `bin/` is copied verbatim by `scripts/build-package.ts` and never passes
through `tsc`).

`cli/program.ts` owns everything the old `bin/consify` used to do by hand:

```ts
// packages/core/src/build/cli/program.ts
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { registerDeployCommand } from "../deploy/command.ts";
import { registerDoctorCommand } from "../doctor.ts";
import { registerDocsCommand } from "../docs-command.ts";
import { registerLangCommand } from "../lang-command.ts";
import { registerLinksCommand } from "../links-command.ts";
import { registerLocaleCommand } from "../../locales/template.ts";
import { registerSkillCommand } from "../skill-command.ts";
import { registerStartCommand, registerSpawnCommands } from "./spawn-commands.ts"; // dev/build/typegen/start
import { registerRegistryCommands } from "../registry/program.ts"; // add/remove/list/registry ...

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("consify")
    .description("The consify CLI")
    // commander's built-in --version only prints one string; consify's --version prints every
    // installed consify-* package, so this is handled as a custom eager option instead of
    // .version(), which cannot express "print N lines, one per installed package"
    .option("-v, --version", "print the version of every installed consify-* package")
    .hook("preAction", () => {}); // placeholder if global pre-action behavior is needed later

  program.on("option:version", () => {
    for (const pkg of ["consify", "consify-docs", "consify-blog", "consify-api-reference", "create-consify"]) {
      try {
        const manifest = JSON.parse(readFileSync(createRequire(import.meta.url).resolve(`${pkg}/package.json`), "utf8"));
        console.log(`${pkg} ${manifest.version}`);
      } catch {
        // not installed in this project, say nothing about it — exact behavior of today's code
      }
    }
    process.exit(0);
  });

  registerSpawnCommands(program); // dev, build, typegen (and start, see below)
  registerDeployCommand(program);
  registerDoctorCommand(program);
  registerDocsCommand(program);
  registerLangCommand(program);
  registerLinksCommand(program);
  registerLocaleCommand(program);
  registerSkillCommand(program);
  registerRegistryCommands(program); // add, remove, list, registry add-source/remove-source/list-sources/list

  return program;
}
```

`registerSpawnCommands` (a new small file, `packages/core/src/build/cli/spawn-commands.ts`) replaces
today's `spawnCommands` object in `bin/consify` with commander `.command(...).allowUnknownOption()`
definitions that spawn the same child processes (`@react-router/dev`'s `react-router` binary,
`@react-router/serve`'s binary) with the same argument-forwarding behavior as today — these three
(`dev`, `build`, `typegen`) pass every remaining argument straight through unexamined (commander's
`.allowUnknownOption(true)` plus `.argument("[args...]")` captures them for forwarding), since
consify does not interpret their flags at all today and must not start doing so now.

`start` is the one spawn command that gains real commander-level option parsing, because it already
has consify-specific behavior (`--socket`) layered on top of the spawn:

```ts
// inside cli/spawn-commands.ts
program
  .command("start")
  .description("Serve a server build (build/server/index.js)")
  .option("--socket <path>", "Unix socket instead of a TCP port")
  .allowUnknownOption(true) // anything else forwards to @react-router/serve unexamined
  .action(async (options: { socket?: string }, cmd: Command) => {
    const socketPath = options.socket ?? process.env.SOCKET_PATH;
    const passthrough = cmd.args.filter((a) => a !== "start"); // remaining, unrecognized args
    if (socketPath) {
      const buildPathArg = passthrough.find((a) => !a.startsWith("--"));
      const { runServeSocketCommand } = await import("../serve-socket.ts");
      process.exitCode = await runServeSocketCommand(buildPathArg ?? "./build/server/index.js", socketPath, process.cwd());
      return;
    }
    // existing spawn-to-@react-router/serve behavior, unchanged
  });
```

This preserves the exact existing `--socket`/`SOCKET_PATH` semantics documented in
`apps/docs/content/en/docs/v0/deployment.mdx` and `reference/cli.mdx`, just expressed as a real
commander option instead of `args.indexOf("--socket")`.

## `cli/spinner.ts`

```ts
// packages/core/src/build/cli/spinner.ts
const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const frameIntervalMs = 80;

export interface Spinner {
  /** Updates the message without restarting the animation. */
  update(message: string): void;
  /** Stops the spinner, clears its line, and prints `finalMessage` (a checkmark line) if given. */
  succeed(finalMessage?: string): void;
  /** Stops the spinner, clears its line, and prints `finalMessage` (an X line) if given. */
  fail(finalMessage?: string): void;
}

const animated = process.stdout.isTTY === true && !process.env.NO_COLOR;

/** Starts a spinner with `message`. No-op animation (prints one static line) outside a real TTY. */
export function spinner(message: string): Spinner {
  if (!animated) {
    console.log(message);
    return {
      update: (m) => console.log(m),
      succeed: (m) => console.log(m ?? message),
      fail: (m) => console.log(m ?? message),
    };
  }
  let current = message;
  let frame = 0;
  const render = () => {
    process.stdout.write(`\r${frames[frame % frames.length]} ${current}`);
    frame++;
  };
  render();
  const timer = setInterval(render, frameIntervalMs);
  const stop = (symbol: string, finalMessage?: string) => {
    clearInterval(timer);
    process.stdout.write(`\r\x1b[K${symbol} ${finalMessage ?? current}\n`); // \x1b[K clears the line
  };
  return {
    update: (m) => {
      current = m;
    },
    succeed: (m) => stop("\x1b[32m✓\x1b[0m", m),
    fail: (m) => stop("\x1b[31m✗\x1b[0m", m),
  };
}
```

Used only by `registry/add.ts` and `registry/fetch.ts` (see `design/04-and-remove.md`), for exactly
two situations: an in-flight HTTP fetch, and an in-flight package-manager install subprocess. No
other command is changed to use it — see the RFC's rationale in the main document.

## `cli/errors.ts`

```ts
// packages/core/src/build/cli/errors.ts
/** Thrown by registry code for an expected, user-facing failure (bad specifier, 404, auth
 *  missing, schema validation failed, etc.) — caught at the top of each action handler and printed
 *  as a plain error line + exit 1, instead of a stack trace. */
export class CliError extends Error {}

/** Wraps an action body: prints `error.message` and sets exit code 1 for a CliError, re-throws
 *  anything else (a real bug should still produce a stack trace, not be swallowed). */
export async function runAction(body: () => Promise<number>): Promise<number> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}
```

Every registry command's `.action()` wraps its body in `runAction(...)`; existing commands are not
required to adopt `CliError`/`runAction` (they already have their own established
`console.error(...); return 1` pattern per command, which stays as-is — introducing `CliError` there
too is a nice-to-have cleanup, not required by this RFC, and is listed as an optional task in
`tasks.md` rather than a mandatory one, to keep the migration's diff focused on parsing, not on
rewriting error handling that already works).

## Zod ↔ commander boundary rules (apply to every command, not just new ones)

1. commander's `.option()` third argument (default value) is **never** used for anything zod's
   `.default()` can express instead — one source of truth for defaults, always the zod schema, so
   `--help`'s printed default (commander reads it from its own option definition) and the schema's
   actual default cannot drift apart silently. Concretely: when a default matters for `--help`'s
   output, pass it to `.option()` too, but always in a form that matches the zod schema's `.default()`
   literally (a code comment or a single shared constant both read from, implementer's choice per
   command, documented inline).
2. Every numeric flag (`--port`) uses `z.coerce.number()` — commander gives strings for everything
   unless a custom parser is attached to `.option()`; the schema does the coercion, not a commander
   parser function, so validation errors (a non-numeric `--port` value) go through one consistent
   zod error path (see next point) rather than commander's own type-coercion error format.
3. A zod validation failure inside an `.action()` handler is caught and re-thrown as a `CliError`
   with a message built from `z.prettifyError(result.error)` (the same helper
   `parseFeatureOptions` in `packages/core/src/shared/feature.ts` already uses for the config
   schema) — so a bad flag value produces the same quality of error message users already get for a
   bad `docs.config.ts`.
4. Booleans are always `z.boolean().default(false)` for a bare `--flag` (commander gives `true` when
   present, `undefined` when absent — never `false` explicitly for a no-argument flag — so the zod
   default is what actually produces `false`, not commander).
