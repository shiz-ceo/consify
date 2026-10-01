// Checks that the packages work when installed the way a user gets them: builds every package,
// packs it, makes a project outside the repository with create-consify, installs the tarballs into
// it together with the blog and the API reference (the docs come with the generator), then builds and type-checks that project. It
// needs network access for the install.
//
//   bun run scripts/check-package.ts
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const packages = join(root, "packages");
const integrations = join(root, "integrations");

function run(cwd: string, ...command: string[]): void {
  console.log(`\n$ ${command.join(" ")}   (${cwd})`);
  const result = Bun.spawnSync(command, { cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) {
    console.error(`failed: ${command.join(" ")}`);
    process.exit(1);
  }
}

// the packages that are published built, each becomes a tarball — core/cli live in packages/, the
// defineFeature-based integrations (docs/blog/api-reference) live in integrations/
const built = [
  { dir: "core", root: packages },
  { dir: "cli", root: packages },
  { dir: "docs", root: integrations },
  { dir: "blog", root: integrations },
  { dir: "api-reference", root: integrations },
];
const tarballs: Record<string, string> = {};
for (const { dir, root: packageRoot } of built) {
  const cwd = join(packageRoot, dir);
  run(cwd, "bun", "run", "build");
  const out = join(cwd, "out");
  run(out, "bun", "pm", "pack");
  const tarball = readdirSync(out).find((name) => name.endsWith(".tgz"));
  if (!tarball) throw new Error(`no tarball was made for ${dir}`);
  const name = (JSON.parse(readFileSync(join(out, "package.json"), "utf8")) as { name: string })
    .name;
  tarballs[name] = join(out, tarball);
}

// the project is made the way a user makes it, with the generator
run(join(packages, "create-consify"), "bun", "run", "prepare-template");
const workspace = mkdtempSync(join(tmpdir(), "consify-package-"));
const project = join(workspace, "site");
try {
  run(
    workspace,
    "bun",
    join(packages, "create-consify", "bin", "create-consify.js"),
    "site",
    "--yes",
    "--languages",
    "en,ru",
    "--no-install",
  );

  // the versions that the generator asks for are not published yet: use the tarballs instead
  const manifestPath = join(project, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [name, tarball] of Object.entries(tarballs)) {
    manifest.dependencies[name] = `file:${tarball}`;
  }
  // packed packages do not see each other's version: keep one copy of the core (each manager has its own field)
  manifest.overrides = {
    "@consify/core": `file:${tarballs["@consify/core"]}`,
    "@consify/cli": `file:${tarballs["@consify/cli"]}`,
  };
  manifest.pnpm = {
    overrides: {
      "@consify/core": `file:${tarballs["@consify/core"]}`,
      "@consify/cli": `file:${tarballs["@consify/cli"]}`,
    },
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // the three features, with something to show, so the build runs their code too
  writeFileSync(
    join(project, "docs.config.ts"),
    `import { defineConfig } from "@consify/core";
import { apiReference } from "@consify/api-reference";
import { blog } from "@consify/blog";
import { docs } from "@consify/docs";

export default defineConfig({
  site: { name: "Check" },
  i18n: { defaultLanguage: "en", languages: ["en", "ru"] },
  features: [
    docs(),
    blog({ authors: { me: { name: "Me" } } }),
    apiReference({ input: "./openapi.json" }),
  ],
});
`,
  );
  writeFileSync(
    join(project, "openapi.json"),
    JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Check", version: "1.0.0" },
      paths: { "/ping": { get: { responses: { "200": { description: "pong" } } } } },
    }),
  );
  mkdirSync(join(project, "content/en/blog"), { recursive: true });
  writeFileSync(
    join(project, "content/en/blog/hello.mdx"),
    "---\ntitle: Hello\ndescription: The first post\ndate: 2020-01-01\nauthors: [me]\n---\n\nHi.\n",
  );

  // the package manager the project is installed with: Bun by default, `npm` or `pnpm` to check those
  const manager = process.env.CONSIFY_CHECK_MANAGER ?? "bun";
  run(project, manager, "install");
  run(project, manager, "run", "build");
  run(project, manager, "run", "typecheck");
  console.log("\nthe installed packages build and type-check in a project made by create-consify");
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
