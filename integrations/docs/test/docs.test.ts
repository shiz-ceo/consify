import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineConfig, type EntryPage, linkCatalog } from "@consify/core";
import { createLoadContext, siteAddresses } from "@consify/core/node";
import { docs } from "../src/index.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-docs-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

/** `write("en", "docs/guide.mdx")` writes `content/en/docs/guide.mdx` with a title. */
function write(lang: string, file: string, text = `---\ntitle: ${file}\n---\n\nText.\n`) {
  const path = join(cwd, "content", lang, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const site = { name: "D", url: "https://d.example" };
const config = (feature: ReturnType<typeof docs>, fallback?: "notice" | "hide" | "show") =>
  defineConfig({
    site,
    i18n: { languages: ["en", "ru"], ...(fallback ? { fallback } : {}) },
    features: [feature],
  });

const urls = async (c: ReturnType<typeof config>, id = "docs") =>
  (await siteAddresses(c, cwd)).filter((a) => a.feature.id === id).map((a) => a.url);

describe("docs()", () => {
  test("wrong options stop with their name", () => {
    expect(() => docs({ versions: { list: [{ id: "v1" }, { id: "v1" }] } })).toThrow(/docs\(\)/);
  });

  test("offers a translated link and llms.txt", () => {
    const c = config(docs());
    expect(linkCatalog(c, "ru").map((l) => [l.id, l.title, l.url])).toEqual([
      ["docs", "Документация", "/ru/docs"],
      ["docs:llms", "llms.txt", "/ru/docs/llms.txt"],
    ]);
  });

  test("a page for every file, search, llms.txt and a social image of each", async () => {
    write("en", "docs/index.mdx");
    write("en", "docs/guide/setup.mdx");
    expect(await urls(config(docs()))).toEqual(
      expect.arrayContaining([
        "/en/docs",
        "/en/docs/guide/setup",
        "/en/docs/llms.txt",
        "/en/docs/og/index.png",
        "/en/docs/og/guide/setup.png",
        // untranslated pages are shown in the default language
        "/ru/docs/guide/setup",
      ]),
    );
  });

  test("with fallback hide, an untranslated page does not exist in the other language", async () => {
    write("en", "docs/guide.mdx");
    const all = await urls(config(docs(), "hide"));
    expect(all).toContain("/en/docs/guide");
    expect(all).not.toContain("/ru/docs/guide");
  });

  test("a versioned section opens its default version", async () => {
    write("en", "docs/v2/index.mdx");
    const c = config(docs({ versions: { list: [{ id: "v2", status: "latest" }] } }));
    const addresses = await siteAddresses(c, cwd);
    expect(addresses.find((a) => a.url === "/en/docs")?.kind).toBe("redirect");
    expect(addresses.find((a) => a.url === "/en/docs/v2")?.kind).toBe("page");
  });

  test("a second section has its own addresses and content folder", async () => {
    write("en", "guides/start.mdx");
    const c = defineConfig({ site, features: [docs(), docs({ id: "guides", title: "Guides" })] });
    expect(await urls(c, "guides")).toContain("/en/guides/start");
    expect(linkCatalog(c, "en").find((l) => l.id === "guides")?.title).toBe("Guides");
  });
});

describe("a docs page", () => {
  const load = async (c: ReturnType<typeof config>, lang: string, slug: string) => {
    const feature = c.features[0] as ReturnType<typeof docs>;
    const context = createLoadContext({ config: c, feature, lang, cwd, params: { "*": slug } });
    const entry = (await context.content.entry(slug)) as EntryPage;
    const page = feature.pages["/*"];
    if (page?.kind !== "page" || !page.load) throw new Error("no page");
    return page.load({ ...context, entry }) as Promise<Record<string, unknown> & EntryPage>;
  };

  test("has its text, table of contents, sidebar and edit link", async () => {
    write("en", "docs/guide.mdx", "---\ntitle: Guide\n---\n\n## First\n\nText.\n");
    write("en", "docs/meta.json", '{"pages":["guide"]}');
    const c = defineConfig({ site: { ...site, github: { repo: "a/b" } }, features: [docs()] });
    const data = await load(c, "en", "guide");
    expect(data.data.title).toBe("Guide");
    expect(data.toc.map((t) => t.title)).toEqual(["First"]);
    expect(data.code).toContain("First");
    expect(JSON.stringify(data.tree)).toContain("/en/docs/guide");
    expect(data.editUrl).toBe("https://github.com/a/b/blob/main/content/en/docs/guide.mdx");
  });

  test("shown without a translation, it says so and points to the original", async () => {
    write("en", "docs/guide.mdx");
    const data = await load(config(docs()), "ru", "guide");
    expect(data.fallback).toBe(true);
    expect(data.original).toBe("/en/docs/guide");
    expect(data.alternates).toEqual({ en: "/en/docs/guide" });
  });

  test("a page of a deprecated version points to the latest one", async () => {
    write("en", "docs/v1/index.mdx");
    const c = config(
      docs({
        versions: {
          list: [
            { id: "v2", status: "latest" },
            { id: "v1", status: "deprecated" },
          ],
        },
      }),
    );
    const data = await load(c, "en", "v1");
    expect(data.deprecated).toEqual({ version: "v1", latest: { label: "v2", url: "/en/docs/v2" } });
  });

  test("puts the snippets of its version in place, in the language of the page", async () => {
    const versions = { list: [{ id: "v1" }] };
    write(
      "ru",
      "docs/v1/guide.mdx",
      '---\ntitle: Guide\n---\n\n<Snippet id="db" title="db.ts" />\n',
    );
    const file = (path: string, text: string) => {
      mkdirSync(dirname(join(cwd, path)), { recursive: true });
      writeFileSync(join(cwd, path), text);
    };
    file("snippets/v1/db.ts", "const db = open(); // open it\n");
    file("snippets/v1/ru/db.ts", "const db = open(); // открыть\n");
    const feature = docs({ versions, snippets: true });
    expect(feature.content?.snippets?.dir).toBe("snippets");
    expect(feature.content?.snippets?.version("v1/guide.mdx")).toBe("v1");
    expect(feature.content?.snippets?.version("intro.mdx")).toBe("");
    expect(docs({ snippets: { dir: "./shared/" } }).content?.snippets?.dir).toBe("shared");
    expect(docs().content?.snippets).toBeUndefined();
    const data = await load(config(feature), "ru", "v1/guide");
    expect(data.code).toContain("открыть");
  });
});
