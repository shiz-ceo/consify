import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { deferredPaths } from "../src/build/router/prerender.ts";
import { defineConfig } from "../src/config/index.ts";
import { rssText, searchResponse } from "../src/content/collection.ts";
import { bundledSource, createContent } from "../src/content/files.ts";
import { siteAddresses } from "../src/feature/addresses.ts";
import { defineFeature, page } from "../src/feature/define.ts";
import { createLoadContext } from "../src/feature/load-context.ts";
import { fillUrl, keyParams, routePattern } from "../src/feature/paths.ts";
import { linkCatalog } from "../src/shared/catalog.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-feature-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function write(path: string, text: string) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
}

const View = () => null;
const site = { name: "D" };

describe("defineFeature", () => {
  test("a page is a component or an object, an address starts with /", () => {
    const feature = defineFeature({
      id: "shop",
      pages: { "/": View, "/:item": page({ load: () => 1, component: View }) },
    });
    expect(feature.pages["/"]).toEqual({ kind: "page", component: View });
    expect(feature.pages["/:item"]?.kind).toBe("page");
    expect(feature.path).toBe("shop");
    expect(feature.folder).toBe("shop");
    expect(() => defineFeature({ id: "shop", pages: { item: View } })).toThrow(/start with "\/"/);
    expect(() => defineFeature({ id: "Shop" })).toThrow(/lowercase/);
  });

  test("a feature with content gets a search", () => {
    expect(defineFeature({ id: "a", content: {} }).search?.useSearch).toBeDefined();
    expect(defineFeature({ id: "a", content: { search: false } }).search).toBeUndefined();
    expect(defineFeature({ id: "a" }).search).toBeUndefined();
  });

  test("two features with one address are refused", () => {
    const a = defineFeature({ id: "a", path: "x" });
    const b = defineFeature({ id: "b", path: "x" });
    expect(() => defineConfig({ site, features: [a, b] })).toThrow(/same address/);
  });
});

describe("addresses", () => {
  test("the pattern and the URL of a page", () => {
    expect(routePattern({ path: "shop" }, "/:item")).toBe(":lang/shop/:item");
    expect(routePattern({ path: "" }, "/")).toBe(":lang");
    expect(keyParams("/a/:b/*")).toEqual(["b", "*"]);
    expect(fillUrl({ path: "docs" }, "/*", "en", { "*": "v2/guide" })).toBe("/en/docs/v2/guide");
    expect(() => fillUrl({ path: "shop" }, "/:item", "en")).toThrow(/needs the parameter/);
  });

  test("every page and file in every language, a page with parameters as often as its paths say", async () => {
    const shop = defineFeature({
      id: "shop",
      pages: {
        "/": View,
        "/:item": page({ paths: ({ lang }) => [{ item: `${lang}-1` }], component: View }),
        "/old": { redirect: ({ lang }) => `/${lang}/shop` },
      },
      files: { "/feed.json": () => ({}) },
    });
    const config = defineConfig({ site, i18n: { languages: ["en", "ru"] }, features: [shop] });
    const found = (await siteAddresses(config, cwd)).filter((a) => a.feature.id === "shop");
    expect(found.map((a) => `${a.kind} ${a.url}`)).toEqual([
      "page /en/shop",
      "page /en/shop/en-1",
      "redirect /en/shop/old",
      "file /en/shop/feed.json",
      "page /ru/shop",
      "page /ru/shop/ru-1",
      "redirect /ru/shop/old",
      "file /ru/shop/feed.json",
    ]);
  });
});

describe("content", () => {
  const notes = defineFeature({
    id: "notes",
    content: {
      schema: z.object({
        title: z.string(),
        date: z.coerce.date().optional(),
        draft: z.boolean().default(false),
      }),
      filter: (entry) => !entry.data.draft,
      og: true,
      llms: true,
      rss: true,
    },
    pages: { "/*": { entry: true, component: View } },
  });
  const config = defineConfig({ site, i18n: { languages: ["en", "ru"] }, features: [notes] });
  const content = (lang: string, c = config) =>
    createContent({ config: c, cwd, feature: notes, lang });

  test("reads the files of a language, with the default language for what is not translated", async () => {
    write("content/en/notes/a.md", "---\ntitle: A\n---\nText");
    write("content/en/notes/sub/index.mdx", "---\ntitle: Sub\n---\n# Sub");
    write("content/ru/notes/a.md", "---\ntitle: А\n---\nТекст");
    expect((await content("ru").list()).map((f) => `${f.lang} ${f.slug}`)).toEqual([
      "ru a",
      "en sub",
    ]);
    expect(await content("ru").read("a.md")).toContain("Текст");
    expect(await content("ru").frontmatter<{ title: string }>("sub/index.mdx")).toEqual({
      title: "Sub",
    });
    const hidden = defineConfig({
      site,
      i18n: { languages: ["en", "ru"], fallback: "hide" },
      features: [notes],
    });
    expect((await content("ru", hidden).list()).map((f) => f.slug)).toEqual(["a"]);
    expect(() => content("en").read("../../secret")).toThrow(/outside/);
  });

  test("entries: checked, filtered, with their addresses; a wrong one names its file", async () => {
    write("content/en/notes/a.md", "---\ntitle: A\n---\nOne two three");
    write("content/en/notes/b.md", "---\ntitle: B\ndraft: true\n---\n");
    const entries = await content("en").entries();
    expect(entries.map((e) => [e.slug, e.url, e.data.title, e.readingTime])).toEqual([
      ["a", "/en/notes/a", "A", 1],
    ]);
    write("content/en/notes/c.md", "---\ntitle: 3\n---\n");
    const other = defineConfig({ site, features: [notes] });
    await expect(content("en", other).entries()).rejects.toThrow(
      /content\/en\/notes\/c\.md: title/,
    );
  });

  test("an entry has its compiled text, headings, translations and original", async () => {
    write("content/en/notes/a.mdx", "---\ntitle: A\n---\n## Hello\n\nText with **bold**.");
    const entry = await content("ru").entry("a");
    expect(entry?.fallback).toBe(true);
    expect(entry?.original).toBe("/en/notes/a");
    expect(entry?.alternates).toEqual({ en: "/en/notes/a" });
    expect(entry?.toc.map((t) => t.title)).toEqual(["Hello"]);
    expect(entry?.code).toContain("bold");
    expect(await content("en").entry("nope")).toBeUndefined();
  });

  test("a built server reads the same content from its bundle, with no folder on the disk", async () => {
    const source = bundledSource({
      "/content/en/notes/a.md": async () => "---\ntitle: A\n---\nText",
      "/content/ru/notes/b.md": async () => "---\ntitle: Б\n---\n",
    });
    const ru = createContent({ config, cwd, feature: notes, lang: "ru", source });
    expect((await ru.list()).map((f) => `${f.lang} ${f.path}`)).toEqual(["en a.md", "ru b.md"]);
    expect((await ru.entries()).map((e) => [e.slug, e.fallback])).toEqual([
      ["a", true],
      ["b", false],
    ]);
    expect((await ru.entry("a"))?.code).toContain("Text");
  });

  test("an RSS feed of the entries", async () => {
    write("content/en/notes/a.md", "---\ntitle: A & B\ndate: 2026-01-02\n---\n");
    const xml = await rssText(
      notes,
      content("en"),
      config,
      "en",
      "D: Notes",
      (p) => `https://d.example${p}`,
    );
    expect(xml).toContain("<title>A &amp; B</title>");
    expect(xml).toContain("<link>https://d.example/en/notes/a</link>");
    expect(xml).toContain("<pubDate>Fri, 02 Jan 2026");
    expect((await siteAddresses(config, cwd)).map((a) => a.url)).toContain("/en/notes/rss.xml");
  });

  test("a page per entry, its social image, search and llms.txt", async () => {
    write("content/en/notes/index.mdx", "---\ntitle: Home\n---\n");
    write("content/en/notes/a.mdx", "---\ntitle: A\n---\n");
    const urls = (await siteAddresses(config, cwd)).map((a) => a.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        "/en/notes",
        "/en/notes/a",
        "/en/notes/og/index.png",
        "/en/notes/og/a.png",
        "/en/notes/llms.txt",
        "/ru/notes/a",
      ]),
    );
    // a server answers the search; a static site downloads the index as a file
    expect(urls).not.toContain("/en/notes/search.json");
    const built = defineConfig({ ...config, deploy: { mode: "static" } });
    expect((await siteAddresses(built, cwd)).map((a) => a.url)).toContain("/en/notes/search.json");
  });

  test("a static site writes the search index of each language after the pre-render", async () => {
    write("content/en/notes/a.mdx", "---\ntitle: A\n---\n");
    expect(await deferredPaths(config, cwd)).toEqual([]);
    const built = defineConfig({ ...config, deploy: { mode: "static" } });
    expect((await deferredPaths(built, cwd)).sort()).toEqual([
      "/en/notes/search.json",
      "/ru/notes/search.json",
    ]);
  });

  test("the search index of a language has the pages of that language only", async () => {
    write("content/en/notes/a.mdx", "---\ntitle: Apple\n---\n\nRed fruit.\n");
    write("content/ru/notes/a.mdx", "---\ntitle: Яблоко\n---\n\nКрасный фрукт.\n");
    const built = defineConfig({ ...config, deploy: { mode: "static" } });
    const index = async (lang: string) =>
      (
        await searchResponse(
          notes,
          content(lang, built),
          built,
          lang,
          new Request(`http://localhost/${lang}/notes/search.json`),
        )
      ).text();
    const en = await index("en");
    const ru = await index("ru");
    expect(en).toContain("/en/notes/a");
    expect(en).not.toContain("/ru/notes/a");
    expect(ru).toContain("/ru/notes/a");
    expect(ru).not.toContain("/en/notes/a");
  });
});

describe("strings", () => {
  test("two features may use the same key: each reads its own", () => {
    const a = defineFeature({
      id: "a",
      title: ({ t }) => t("hint"),
      messages: { en: { hint: "A" } },
    });
    const b = defineFeature({
      id: "b",
      title: ({ t }) => t("hint"),
      messages: { en: { hint: "B" } },
    });
    const config = defineConfig({ site, features: [a, b] });
    expect(createLoadContext({ config, feature: a, lang: "en", cwd }).t("hint")).toBe("A");
    expect(createLoadContext({ config, feature: b, lang: "en", cwd }).t("hint")).toBe("B");
    const catalog = linkCatalog(config, "en").map((l) => l.title);
    expect(catalog).toEqual(["A", "B"]);
  });
});

describe("load", () => {
  test("gets the language, the strings, the content, and can answer 404 or redirect", async () => {
    const shop = defineFeature({ id: "shop", messages: { en: { hi: "Hi {name}" } } });
    const config = defineConfig({
      site: { name: "D", url: "https://d.example" },
      features: [shop],
    });
    const context = createLoadContext({
      config,
      feature: shop,
      lang: "en",
      cwd,
      params: { a: "1" },
    });
    expect(context.t("hi", { name: "Ada" })).toBe("Hi Ada");
    expect(context.url("/en/shop")).toBe("https://d.example/en/shop");
    expect(context.params).toEqual({ a: "1" });
    expect(() => context.notFound()).toThrow();
    write("data.json", '{"x":1}');
    expect(JSON.parse(await context.readFile("data.json"))).toEqual({ x: 1 });
    expect(() => context.readFile("../x")).toThrow(/outside/);
  });
});
