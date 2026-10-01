// Fills `template/` with the files every new project starts from: the starter app (without the files
// that depend on the answers). Skills are not baked in here — `create-consify` runs
// `consify skill sync` after install instead, so a project always gets the skills of the consify
// packages it uses. Run before packing or testing.
//
//   bun run scripts/prepare-template.ts
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const repo = join(root, "..", "..");
const starter = join(repo, "apps", "starter");
const template = join(root, "template");

rmSync(template, { recursive: true, force: true });
mkdirSync(template, { recursive: true });

for (const name of [
  "vite.config.ts",
  "react-router.config.ts",
  "tsconfig.json",
  "content",
  "custom",
]) {
  cpSync(join(starter, name), join(template, name), { recursive: true });
}
// npm does not pack a file called .gitignore
cpSync(join(starter, ".gitignore"), join(template, "_gitignore"));
for (const file of ["LICENSE"]) {
  if (existsSync(join(repo, file))) cpSync(join(repo, file), join(root, file));
}

// the dependencies of a new project come from the starter, and consify from the package itself
const manifest = JSON.parse(readFileSync(join(starter, "package.json"), "utf8"));
const core = JSON.parse(readFileSync(join(repo, "packages", "core", "package.json"), "utf8"));
const { "@consify/core": _core, ...listed } = manifest.dependencies as Record<string, string>;
// the packages of the repository are `workspace:*` in the starter, a new project asks for their versions
const versions = new Map<string, string>(
  ["packages", "integrations"].flatMap((group) =>
    readdirSync(join(repo, group))
      .map((dir) => join(repo, group, dir, "package.json"))
      .filter((path) => existsSync(path))
      .map((path) => {
        const pkg = JSON.parse(readFileSync(path, "utf8")) as { name: string; version: string };
        return [pkg.name, pkg.version] as [string, string];
      }),
  ),
);

const dependencies = Object.fromEntries(
  Object.entries(listed).map(([name, range]) => {
    if (!range.startsWith("workspace:")) return [name, range];
    const version = versions.get(name);
    if (!version) throw new Error(`${name} is not a package of the repository`);
    return [name, `^${version}`];
  }),
);
writeFileSync(
  join(template, "package.template.json"),
  `${JSON.stringify({ consifyVersion: core.version, dependencies, devDependencies: manifest.devDependencies }, null, 2)}\n`,
);

console.log(`template ready in ${template}`);
