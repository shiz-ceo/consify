// Builds the package in the current folder for publishing into `out/` (run it from a package, as
// `bun run build`):
//
//   out/
//   ├─ package.json    the same as ../package.json, with `exports` pointing at `dist/`
//   ├─ dist/           compiled JavaScript, declarations, stylesheets
//   ├─ bin/            when the package has commands
//   ├─ skills/         the skills for Claude the package ships (`consify skill sync` finds them)
//   ├─ README.md
//   └─ LICENSE
//
// In the repository the package is used from its TypeScript sources (`src/`), which is fast to work
// with. Node cannot run TypeScript that sits in `node_modules`, and the config files of a project
// are loaded by Node, so what is published has to be JavaScript.
//
//   bun run build                   build into out/
//   cd out && bun pm pack           make the tarball
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const out = join(root, "out");
const source = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<
  string,
  unknown
>;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. compile
const compile = Bun.spawnSync(["bunx", "tsc", "-p", "tsconfig.build.json"], {
  cwd: root,
  stdout: "inherit",
  stderr: "inherit",
});
if (compile.exitCode !== 0) {
  console.error("tsc failed");
  process.exit(1);
}

// 2. what tsc does not emit: stylesheets and hand-written declaration files
function copyMatching(dir: string, test: (path: string, name: string) => boolean): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      copyMatching(path, test);
    } else if (test(path, name)) {
      const target = join(out, "dist", path.slice(join(root, "src").length + 1));
      mkdirSync(dirname(target), { recursive: true });
      cpSync(path, target);
    }
  }
}
copyMatching(join(root, "src"), (_path, name) => name.endsWith(".css") || name.endsWith(".d.ts"));

// 2b. the skills of the package
const hasSkills = existsSync(join(root, "skills"));
if (hasSkills) cpSync(join(root, "skills"), join(out, "skills"), { recursive: true });

// 3. package.json for the published package
function published(target: string): unknown {
  const dist = target.replace(/^\.\/src\//, "./dist/");
  if (dist.endsWith(".d.ts")) return { types: dist };
  if (/\.(tsx?)$/.test(dist)) {
    const base = dist.replace(/\.tsx?$/, "");
    return { types: `${base}.d.ts`, default: `${base}.js` };
  }
  return dist; // stylesheets and the like
}

const exports: Record<string, unknown> = {};
for (const [key, target] of Object.entries(source.exports as Record<string, string>)) {
  exports[key] = key === "./package.json" ? target : published(target);
}

const hasBin = existsSync(join(root, "bin"));
const manifest = {
  ...source,
  exports,
  files: [
    "dist",
    ...(hasBin ? ["bin"] : []),
    ...(hasSkills ? ["skills"] : []),
    "README.md",
    "LICENSE",
    "CHANGELOG.md",
  ],
};
delete (manifest as Record<string, unknown>).scripts;
delete (manifest as Record<string, unknown>).devDependencies;
delete (manifest as Record<string, unknown>).private;
writeFileSync(join(out, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

// 4. the rest — CHANGELOG.md is the repository's one file, shared by every package (consify-upgrade
// reads it from whichever `consify-*` package the project has installed)
if (hasBin) cpSync(join(root, "bin"), join(out, "bin"), { recursive: true });
for (const file of ["README.md", "LICENSE", "CHANGELOG.md"]) {
  const path = [join(root, file), join(root, "..", "..", file)].find((p) => existsSync(p));
  if (path) cpSync(path, join(out, file));
}

console.log(`built ${out}`);
