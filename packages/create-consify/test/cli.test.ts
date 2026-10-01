import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectPackageManager,
  parseArgs,
  runCommand,
  scaffold,
  syncSkills,
  templateDir,
} from "../src/cli.js";
import {
  parseLanguages,
  renderConfig,
  renderLocaleStub,
  renderPackageJson,
  toPackageName,
} from "../src/template.js";

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
  test("a language without built-in strings gets a pack to fill in", () => {
    const stub = renderLocaleStub({ lang: "de", label: "Deutsch" });
    expect(stub).toContain('import { defineLocale } from "@consify/core"');
    expect(stub).toContain('label: "Deutsch"');
    expect(stub).toContain("consify locale de");
  });

  test("the config lists the docs as a feature", () => {
    const config = renderConfig({ siteName: "Site", languages: ["en"] });
    expect(config).toContain('import { docs } from "@consify/docs"');
    expect(config).toContain("features: [docs()]");
  });

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
        consifyVersion: "1.0.0",
        dependencies: { react: "19.3.0" },
        devDependencies: { vite: "8.3.0" },
      }),
    );
    expect(json.scripts.dev).toBe("consify dev");
    expect(json.dependencies["@consify/core"]).toBe("^1.0.0");
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

  test.skipIf(!existsSync(templateDir))(
    "adds a language pack for a language without strings",
    () => {
      scaffold({
        target: join(target, "de-site"),
        siteName: "Site",
        languages: ["en", "de"],
        pm: "bun",
      });
      expect(existsSync(join(target, "de-site/custom/locales/de.ts"))).toBe(true);
      expect(existsSync(join(target, "de-site/custom/locales/en.ts"))).toBe(false);
    },
  );

  test.skipIf(!existsSync(templateDir))("writes a project from the template", () => {
    scaffold({
      target: join(target, "site"),
      siteName: "Site",
      languages: ["en", "ru"],
      pm: "bun",
    });
    const site = join(target, "site");
    expect(existsSync(join(site, "custom/locales/ru.ts"))).toBe(false);
    for (const file of [
      "docs.config.ts",
      "package.json",
      "README.md",
      "vite.config.ts",
      "react-router.config.ts",
      "tsconfig.json",
      ".gitignore",
      "content/en/docs/index.mdx",
      "consify.registries.json",
      ".npmrc",
    ]) {
      expect(existsSync(join(site, file))).toBe(true);
    }
    expect(existsSync(join(site, "package.template.json"))).toBe(false);
    expect(existsSync(join(site, "_gitignore"))).toBe(false);
    expect(readFileSync(join(site, "package.json"), "utf8")).toContain('"@consify/core": "^');
    expect(readFileSync(join(site, "package.json"), "utf8")).toContain('"@consify/cli": "^');
  });

  test.skipIf(!existsSync(templateDir))(
    "seeds .npmrc so @consify/* resolves from GitHub Packages",
    () => {
      scaffold({ target: join(target, "site"), siteName: "Site", languages: ["en"], pm: "bun" });
      expect(readFileSync(join(target, "site", ".npmrc"), "utf8")).toBe(
        "@consify:registry=https://npm.pkg.github.com\n",
      );
    },
  );

  test.skipIf(!existsSync(templateDir))(
    "seeds consify.registries.json with the one official registry",
    () => {
      scaffold({ target: join(target, "site"), siteName: "Site", languages: ["en"], pm: "bun" });
      const registries = JSON.parse(
        readFileSync(join(target, "site", "consify.registries.json"), "utf8"),
      );
      expect(registries).toEqual({
        registries: {
          "@shiz-ceo": { url: "https://consify.shiz-ceo.ru/r/{name}.json", default: true },
        },
      });
    },
  );

  test.skipIf(!existsSync(templateDir))(
    "does not write .claude itself — consify skill sync does that after install",
    () => {
      scaffold({ target: join(target, "site"), siteName: "Site", languages: ["en"], pm: "npm" });
      expect(existsSync(join(target, "site", ".claude"))).toBe(false);
    },
  );
});

describe("syncSkills", () => {
  let target: string;
  let spawnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    target = realpathSync(mkdtempSync(join(tmpdir(), "create-consify-sync-")));
    writeFileSync(join(target, "package.json"), JSON.stringify({ name: "site" }));

    // The bin lives on @consify/cli, not @consify/core — a project only ever depends on
    // @consify/core for its config types, so resolving the bin against the wrong package is
    // exactly the bug this test guards against (it resolved fine but manifest.bin was undefined).
    const cliDir = join(target, "node_modules/@consify/cli");
    mkdirSync(join(cliDir, "bin"), { recursive: true });
    writeFileSync(
      join(cliDir, "package.json"),
      JSON.stringify({ name: "@consify/cli", bin: { consify: "./bin/consify" } }),
    );
    writeFileSync(join(cliDir, "bin/consify"), "#!/usr/bin/env node\n");

    spawnSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
      status: 0,
    } as ReturnType<typeof childProcess.spawnSync>);
  });
  afterEach(() => {
    mock.restore();
    rmSync(target, { recursive: true, force: true });
  });

  test("resolves the bin from @consify/cli and runs skill sync", () => {
    expect(syncSkills(target)).toBe(true);
    expect(spawnSpy).toHaveBeenCalledWith(
      process.execPath,
      [join(target, "node_modules/@consify/cli/bin/consify"), "skill", "sync"],
      expect.objectContaining({ cwd: target }),
    );
  });

  test("returns false without throwing when @consify/cli isn't installed", () => {
    rmSync(join(target, "node_modules"), { recursive: true, force: true });
    expect(syncSkills(target)).toBe(false);
    expect(spawnSpy).not.toHaveBeenCalled();
  });
});
