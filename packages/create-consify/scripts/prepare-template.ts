// Fills `template/` with the files every new project starts from: the starter app (without the files
// that depend on the answers) and the consify-docs skill. Run before packing or testing.
//
//   bun run scripts/prepare-template.ts
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
cpSync(join(repo, "skills", "consify-docs"), join(template, ".claude", "skills", "consify-docs"), {
  recursive: true,
});
for (const file of ["LICENSE"]) {
  if (existsSync(join(repo, file))) cpSync(join(repo, file), join(root, file));
}

// the dependencies of a new project come from the starter, and consify from the package itself
const manifest = JSON.parse(readFileSync(join(starter, "package.json"), "utf8"));
const core = JSON.parse(readFileSync(join(repo, "packages", "core", "package.json"), "utf8"));
const { consify: _, ...dependencies } = manifest.dependencies as Record<string, string>;
writeFileSync(
  join(template, "package.template.json"),
  `${JSON.stringify({ consifyVersion: core.version, dependencies, devDependencies: manifest.devDependencies }, null, 2)}\n`,
);

console.log(`template ready in ${template}`);
