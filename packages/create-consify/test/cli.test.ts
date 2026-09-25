import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectPackageManager, parseArgs, runCommand, scaffold, templateDir } from "../src/cli.js";
import { parseLanguages, renderConfig, renderPackageJson, toPackageName } from "../src/template.js";

describe("arguments", () => {
  test("reads the folder and the options", () => {
    expect(
      parseArgs(["site", "--languages", "en,ru", "--pm", "pnpm", "--no-install", "-y"]),
    ).toMatchObject({
      dir: "site",
      languages: "en,ru",
      pm: "pnpm",
      install: false,
      yes: true,
      skill: true,
    });
  });

  test("rejects an unknown option, a missing value and a second folder", () => {
    expect(() => parseArgs(["--nope"])).toThrow("Unknown option");
    expect(() => parseArgs(["--name"])).toThrow("needs a value");
    expect(() => parseArgs(["a", "b"])).toThrow("Unexpected argument");
  });

  test("finds the package manager from the user agent", () => {
    expect(detectPackageManager("bun/1.2.0 npm/? node/v24")).toBe("bun");
    expect(detectPackageManager("pnpm/9.0.0 npm/? node/v22")).toBe("pnpm");
    expect(detectPackageManager("npm/10.0.0 node/v22")).toBe("npm");
    expect(detectPackageManager(undefined)).toBe("npm");
    expect(runCommand("npm", "dev")).toBe("npm run dev");
    expect(runCommand("bun", "dev")).toBe("bun run dev");
  });
});

describe("the files of a project", () => {
  test("languages are checked", () => {
    expect(parseLanguages("en, ru")).toEqual(["en", "ru"]);
    expect(parseLanguages("pt-BR")).toEqual(["pt-BR"]);
    expect(() => parseLanguages("")).toThrow();
    expect(() => parseLanguages("english")).toThrow("not a language code");
    expect(() => parseLanguages("en,en")).toThrow("unique");
  });

  test("the config has the main language first and names for the switcher", () => {
    const config = renderConfig({ siteName: 'My "Docs"', languages: ["ru", "en"] });
    expect(config).toContain('defaultLanguage: "ru"');
    expect(config).toContain('languages: ["ru", "en"]');
    expect(config).toContain('"ru": "Русский"');
    expect(config).toContain('name: "My \\"Docs\\""');
    expect(renderConfig({ siteName: "D", languages: ["en"] })).not.toContain("labels");
  });

  test("the package name is made from the site name", () => {
    expect(toPackageName("My Docs!")).toBe("my-docs");
    expect(toPackageName("***")).toBe("my-docs");
  });

  test("the package.json has the scripts and consify with a range", () => {
    const json = JSON.parse(
      renderPackageJson({
        name: "x",
        consifyVersion: "0.1.0",
        dependencies: { react: "19.3.0" },
        devDependencies: { vite: "8.3.0" },
      }),
    );
    expect(json.scripts.dev).toBe("consify dev");
    expect(json.dependencies.consify).toBe("^0.1.0");
    expect(json.devDependencies.vite).toBe("8.3.0");
  });
});

describe("scaffold", () => {
  let target: string;
  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), "create-consify-"));
  });
  afterEach(() => {
    rmSync(target, { recursive: true, force: true });
  });

  test.skipIf(!existsSync(templateDir))("writes a project from the template", () => {
    scaffold({
      target: join(target, "site"),
      siteName: "Site",
      languages: ["en", "ru"],
      pm: "bun",
      skill: true,
    });
    const site = join(target, "site");
    for (const file of [
      "docs.config.ts",
      "package.json",
      "README.md",
      "vite.config.ts",
      "react-router.config.ts",
      "tsconfig.json",
      ".gitignore",
      "content/docs/index.mdx",
      ".claude/skills/consify-docs/SKILL.md",
    ]) {
      expect(existsSync(join(site, file))).toBe(true);
    }
    expect(existsSync(join(site, "package.template.json"))).toBe(false);
    expect(existsSync(join(site, "_gitignore"))).toBe(false);
    expect(readFileSync(join(site, "package.json"), "utf8")).toContain('"consify": "^');
  });

  test.skipIf(!existsSync(templateDir))("leaves the skill out on request", () => {
    scaffold({
      target: join(target, "site"),
      siteName: "Site",
      languages: ["en"],
      pm: "npm",
      skill: false,
    });
    expect(existsSync(join(target, "site", ".claude"))).toBe(false);
  });
});
