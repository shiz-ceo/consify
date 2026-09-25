import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  parseLanguages,
  renderConfig,
  renderPackageJson,
  renderReadme,
  toPackageName,
} from "./template.js";

const here = dirname(fileURLToPath(import.meta.url));
export const templateDir = join(here, "..", "template");

const help = `create-consify: create a documentation site with consify

Usage: create-consify [folder] [options]

Options:
  --name <text>          name of the site (default: the folder name)
  --languages <list>     languages, the first is the main one (default: en), e.g. en,ru
  --pm <bun|npm|pnpm|yarn>   package manager (default: the one that ran this command)
  --no-install           do not install dependencies
  --no-skill             do not add the consify-docs skill for Claude
  --git                  run "git init"
  -y, --yes              do not ask questions, use the defaults
  -h, --help             show this help
`;

/** @param {string[]} argv */
export function parseArgs(argv) {
  const options = {
    dir: undefined,
    name: undefined,
    languages: undefined,
    pm: undefined,
    install: true,
    skill: true,
    git: false,
    yes: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "-y" || arg === "--yes") options.yes = true;
    else if (arg === "--no-install") options.install = false;
    else if (arg === "--no-skill") options.skill = false;
    else if (arg === "--git") options.git = true;
    else if (arg === "--name") options.name = value();
    else if (arg === "--languages") options.languages = value();
    else if (arg === "--pm") options.pm = value();
    else if (arg?.startsWith("-")) throw new Error(`Unknown option ${arg}\n\n${help}`);
    else if (options.dir === undefined) options.dir = arg;
    else throw new Error(`Unexpected argument ${arg}`);
  }
  return options;
}

/** The package manager named in `npm_config_user_agent`, or npm. @param {string | undefined} userAgent */
export function detectPackageManager(userAgent) {
  const name = userAgent?.split(" ")[0]?.split("/")[0];
  return name === "bun" || name === "pnpm" || name === "yarn" ? name : "npm";
}

/** How to run a package script with a package manager. */
export function runCommand(pm, script) {
  if (pm === "npm") return script === "start" ? "npm start" : `npm run ${script}`;
  return `${pm} run ${script}`;
}

/** Whether a folder has nothing in it (or does not exist). @param {string} dir */
function isEmpty(dir) {
  return !existsSync(dir) || readdirSync(dir).filter((name) => name !== ".git").length === 0;
}

/**
 * Writes the project into `target`.
 * @param {{ target: string, siteName: string, languages: string[], pm: string, skill: boolean }} options
 */
export function scaffold({ target, siteName, languages, pm, skill }) {
  if (!existsSync(templateDir)) {
    throw new Error(
      "The template is missing. Run `bun run prepare-template` in packages/create-consify.",
    );
  }
  mkdirSync(target, { recursive: true });
  cpSync(templateDir, target, { recursive: true });

  // npm never packs a file called .gitignore, so the template keeps it as _gitignore
  if (existsSync(join(target, "_gitignore"))) {
    renameSync(join(target, "_gitignore"), join(target, ".gitignore"));
  }
  if (!skill) rmSync(join(target, ".claude"), { recursive: true, force: true });

  const template = JSON.parse(readFileSync(join(templateDir, "package.template.json"), "utf8"));
  rmSync(join(target, "package.template.json"));
  writeFileSync(join(target, "docs.config.ts"), renderConfig({ siteName, languages }));
  writeFileSync(
    join(target, "package.json"),
    renderPackageJson({
      name: toPackageName(siteName),
      consifyVersion: template.consifyVersion,
      dependencies: template.dependencies,
      devDependencies: template.devDependencies,
    }),
  );
  writeFileSync(
    join(target, "README.md"),
    renderReadme({ siteName, run: (script) => runCommand(pm, script) }),
  );
}

/** Asks a question and returns the answer, or `fallback` when the answer is empty. */
async function ask(rl, question, fallback) {
  const answer = (await rl.question(`${question} (${fallback}) `)).trim();
  return answer || fallback;
}

/** @param {string[]} argv */
export async function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(help);
    return;
  }

  const interactive = !options.yes && process.stdin.isTTY;
  const rl = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : undefined;
  try {
    const dir =
      options.dir ?? (rl ? await ask(rl, "Folder of the project?", "my-docs") : "my-docs");
    const target = resolve(process.cwd(), dir);
    const folderName = target.split(/[\\/]/).pop() ?? "my-docs";
    if (!isEmpty(target)) throw new Error(`${dir} is not empty. Choose another folder.`);

    const siteName =
      options.name ?? (rl ? await ask(rl, "Name of the site?", folderName) : folderName);
    const languages = parseLanguages(
      options.languages ??
        (rl ? await ask(rl, "Languages, the first is the main one?", "en") : "en"),
    );
    const pm = options.pm ?? detectPackageManager(process.env.npm_config_user_agent);
    if (!["bun", "npm", "pnpm", "yarn"].includes(pm))
      throw new Error(`Unknown package manager ${pm}`);

    let install = options.install;
    if (rl && install) {
      install = /^(y|yes|)$/i.test(
        (await ask(rl, `Install dependencies with ${pm}? (yes/no)`, "yes")).trim(),
      );
    }

    scaffold({ target, siteName, languages, pm, skill: options.skill });
    console.log(`\nCreated ${siteName} in ${target}`);

    if (options.git) spawnSync("git", ["init"], { cwd: target, stdio: "ignore" });
    if (install) {
      console.log(`\nInstalling dependencies with ${pm}...`);
      const result = spawnSync(pm, ["install"], { cwd: target, stdio: "inherit" });
      if (result.status !== 0) console.warn(`\n${pm} install failed. Run it yourself in ${dir}.`);
      else install = true;
    }

    console.log(
      `\nNext:\n  cd ${dir}\n${install ? "" : `  ${pm} install\n`}  ${runCommand(pm, "dev")}\n`,
    );
  } finally {
    rl?.close();
  }
}
