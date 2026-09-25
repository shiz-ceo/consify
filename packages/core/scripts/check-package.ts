// Checks that the package works when installed the way a user gets it: builds it, packs it, makes a
// project outside the repository with create-consify, installs the tarball into it, then builds and
// type-checks that project. It needs network access for the install.
//
//   bun run scripts/check-package.ts
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

function run(cwd: string, ...command: string[]): void {
  console.log(`\n$ ${command.join(" ")}   (${cwd})`);
  const result = Bun.spawnSync(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) {
    console.error(`failed: ${command.join(" ")}`);
    process.exit(1);
  }
}

run(root, "bun", "run", "scripts/build.ts");
run(join(root, "out"), "bun", "pm", "pack");
const tarball = readdirSync(join(root, "out")).find((name) => name.endsWith(".tgz"));
if (!tarball) throw new Error("no tarball was made");

// the project is made the way a user makes it, with the generator
run(join(root, "..", "create-consify"), "bun", "run", "prepare-template");
const workspace = mkdtempSync(join(tmpdir(), "consify-package-"));
const project = join(workspace, "site");
try {
  run(
    workspace,
    "bun",
    join(root, "..", "create-consify", "bin", "create-consify.js"),
    "site",
    "--yes",
    "--languages",
    "en,ru",
    "--no-install",
  );
  // the version that the generator asks for is not published yet: use the tarball instead
  const manifestPath = join(project, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.dependencies.consify = `file:${join(root, "out", tarball)}`;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  run(project, "bun", "install");
  run(project, "bun", "run", "build");
  run(project, "bun", "run", "typecheck");
  console.log("\nthe installed package builds and type-checks in a project made by create-consify");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
