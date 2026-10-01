import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineConfig } from "@consify/core";
import { languageFiles, languageStatus, runLangAdd, runLangStatus } from "../src/lang-command.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-lang-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

const write = (file: string, text = "---\ntitle: T\n---\n") => {
  const path = join(cwd, "content", file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const config = (languages: string[]) =>
  defineConfig({ site: { name: "D" }, i18n: { defaultLanguage: "en", languages } });

function project() {
  for (const file of [
    "en/home.mdx",
    "en/docs/index.mdx",
    "en/docs/guide.mdx",
    "en/docs/meta.json",
    "en/blog/a.mdx",
    "en/blog/b.mdx",
    "ru/home.mdx",
    "ru/docs/guide.mdx",
    "ru/docs/meta.json",
    "ru/docs/extra.mdx",
    "ru/blog/a.mdx",
  ]) {
    write(file, file.endsWith(".json") ? '{"title":"T"}' : undefined);
  }
  writeFileSync(
    join(cwd, "docs.config.mjs"),
    `export default { i18n: { defaultLanguage: "en", languages: ["en", "ru", "de"] }, features: [], mdx: { plugins: [] } };`,
  );
}

describe("language folders", () => {
  test("lists the pages and menus of a language, relative to its folder", () => {
    project();
    expect(languageFiles(cwd, "ru")).toEqual([
      "blog/a.mdx",
      "docs/extra.mdx",
      "docs/guide.mdx",
      "docs/meta.json",
      "home.mdx",
    ]);
    expect(languageFiles(cwd, "de")).toEqual([]);
  });

  test("counts what each language has compared with the default one", () => {
    project();
    const [en, ru, de] = languageStatus(cwd, config(["en", "ru", "de"]));
    // the front page first, then the folders of the features in their order (none here: by name)
    expect(Object.keys(en?.pages ?? {})).toEqual(["home", "blog", "docs"]);
    expect(en?.pages).toEqual({
      home: { done: 1, total: 1 },
      docs: { done: 2, total: 2 },
      blog: { done: 2, total: 2 },
    });
    expect(ru?.pages).toEqual({
      home: { done: 1, total: 1 },
      docs: { done: 1, total: 2 },
      blog: { done: 1, total: 2 },
    });
    expect(ru?.menus).toEqual({ done: 1, total: 1 });
    expect(ru?.missing).toEqual(["blog/b.mdx", "docs/index.mdx"]);
    expect(ru?.orphans).toEqual(["docs/extra.mdx"]);
    expect(de?.pages.docs).toEqual({ done: 0, total: 2 });
  });
});

describe("consify lang", () => {
  const silent = async <T>(run: () => Promise<T>): Promise<{ result: T; out: string }> => {
    const log = console.log;
    const error = console.error;
    let out = "";
    console.log = (...parts: unknown[]) => void (out += `${parts.join(" ")}\n`);
    console.error = (...parts: unknown[]) => void (out += `${parts.join(" ")}\n`);
    try {
      return { result: await run(), out };
    } finally {
      console.log = log;
      console.error = error;
    }
  };

  test("status prints a table, the orphans, and with --missing the files to translate", async () => {
    project();
    const { result, out } = await silent(() => runLangStatus({ missing: true }, cwd));
    expect(result).toBe(0);
    expect(out).toContain("en (default)");
    expect(out).toMatch(/ru\s+1\/1\s+1\/2\s+1\/2\s+1\/1/);
    expect(out).toContain("built in");
    expect(out).toContain("de");
    expect(out).toContain("none (English)");
    expect(out).toContain("docs/extra.mdx");
    expect(out).toContain("content/ru/docs/index.mdx");
  });

  test("status of one language, and an unknown one", async () => {
    project();
    expect((await silent(() => runLangStatus({ language: "ru" }, cwd))).out).not.toContain(
      "en (default)",
    );
    expect((await silent(() => runLangStatus({ language: "xx" }, cwd))).result).toBe(1);
  });

  test("add prepares the menus and the interface strings, and does nothing twice", async () => {
    project();
    const { result } = await silent(() => runLangAdd({ language: "de" }, cwd));
    expect(result).toBe(0);
    expect(existsSync(join(cwd, "content/de/docs/meta.json"))).toBe(true);
    // pages are not copied unless asked
    expect(existsSync(join(cwd, "content/de/docs/guide.mdx"))).toBe(false);
    expect(readFileSync(join(cwd, "custom/locales/de.ts"), "utf8")).toContain("defineLocale");
    writeFileSync(join(cwd, "content/de/docs/meta.json"), '{"title":"Dokumentation"}');
    await silent(() => runLangAdd({ language: "de" }, cwd));
    expect(readFileSync(join(cwd, "content/de/docs/meta.json"), "utf8")).toContain("Dokumentation");
  });

  test("add --copy copies the pages of the default language too", async () => {
    project();
    await silent(() => runLangAdd({ language: "de", copy: true }, cwd));
    expect(existsSync(join(cwd, "content/de/docs/guide.mdx"))).toBe(true);
    expect(existsSync(join(cwd, "content/de/blog/b.mdx"))).toBe(true);
    expect(existsSync(join(cwd, "content/de/home.mdx"))).toBe(true);
  });

  test("add refuses the default language and a bad code", async () => {
    project();
    expect((await silent(() => runLangAdd({ language: "en" }, cwd))).result).toBe(1);
    expect((await silent(() => runLangAdd({ language: "Not A Code" }, cwd))).result).toBe(1);
  });
});
