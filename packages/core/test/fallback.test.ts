import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { completeMetaPages, isFallbackPage, isTranslatedPath } from "../src/shared/fallback.ts";

describe("fallback pages", () => {
  test("a translation is the file with the language code", () => {
    expect(isTranslatedPath("v2/guide.ru.mdx", "ru")).toBe(true);
    expect(isTranslatedPath("v2/guide.mdx", "ru")).toBe(false);
    expect(isTranslatedPath("v2/guide.ru.mdx", "en")).toBe(false);
  });

  test("a page shown for another language than its own is a fallback", () => {
    expect(isFallbackPage("guide.mdx", "ru", "en")).toBe(true);
    expect(isFallbackPage("guide.ru.mdx", "ru", "en")).toBe(false);
    expect(isFallbackPage("guide.mdx", "en", "en")).toBe(false);
  });

  test("the config has three modes and `notice` is the default", () => {
    expect(defineConfig({ site: { name: "D" } }).i18n.fallback).toBe("notice");
    expect(defineConfig({ site: { name: "D" }, i18n: { fallback: "hide" } }).i18n.fallback).toBe(
      "hide",
    );
    expect(() =>
      defineConfig({ site: { name: "D" }, i18n: { fallback: "maybe" } } as never),
    ).toThrow();
  });
});

describe("completeMetaPages", () => {
  const page = (path: string) => ({ type: "page", path, data: {} });
  const meta = (path: string, pages?: string[]) => ({ type: "meta", path, data: { pages } });
  const run = (files: ReturnType<typeof page>[]) => {
    const warnings: string[] = [];
    const result = completeMetaPages({ files }, ["en", "ru"], "en", (m) => warnings.push(m));
    return { result: result.files as { path: string; data: { pages?: string[] } }[], warnings };
  };

  test("adds a page that the translated list forgot, at the end, and warns", () => {
    const { result, warnings } = run([
      page("guide/index.mdx"),
      page("guide/one.mdx"),
      page("guide/layout.mdx"),
      page("guide/one.ru.mdx"),
      meta("guide/meta.json", ["index", "one", "layout"]),
      meta("guide/meta.ru.json", ["index", "one"]),
    ] as never);
    const ru = result.find((f) => f.path === "guide/meta.ru.json");
    expect(ru?.data.pages).toEqual(["index", "one", "layout"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('does not list "layout"');
    // the default list is untouched
    expect(result.find((f) => f.path === "guide/meta.json")?.data.pages).toEqual([
      "index",
      "one",
      "layout",
    ]);
  });

  test("leaves complete lists, lists with the rest marker and meta without pages alone", () => {
    const { result, warnings } = run([
      page("a/one.mdx"),
      page("a/two.mdx"),
      meta("a/meta.ru.json", ["one", "two"]),
      page("b/one.mdx"),
      page("b/two.mdx"),
      meta("b/meta.ru.json", ["one", "..."]),
      page("c/one.mdx"),
      meta("c/meta.ru.json", undefined),
    ] as never);
    expect(result.find((f) => f.path === "a/meta.ru.json")?.data.pages).toEqual(["one", "two"]);
    expect(result.find((f) => f.path === "b/meta.ru.json")?.data.pages).toEqual(["one", "..."]);
    expect(result.find((f) => f.path === "c/meta.ru.json")?.data.pages).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  test("sees folders too and ignores separators and the index page", () => {
    const { result } = run([
      page("index.mdx"),
      page("guides/one.mdx"),
      page("intro.mdx"),
      meta("meta.ru.json", ["index", "---Learn---", "intro"]),
    ] as never);
    expect(result.find((f) => f.path === "meta.ru.json")?.data.pages).toEqual([
      "index",
      "---Learn---",
      "intro",
      "guides",
    ]);
  });
});

describe("meta of a translation", () => {
  test("keeps what is not text from the default meta.json (the version root, the icon)", () => {
    const files = [
      { type: "page", path: "v2/index.mdx", data: {} },
      {
        type: "meta",
        path: "v2/meta.json",
        data: { title: "v2", root: "version", icon: "Rocket", pages: ["index"] },
      },
      {
        type: "meta",
        path: "v2/meta.ru.json",
        data: { title: "v2 (актуальная)", pages: ["index"] },
      },
    ];
    const result = completeMetaPages({ files }, ["en", "ru"], "en", () => {});
    const ru = result.files.find((f) => f.path === "v2/meta.ru.json")?.data as Record<
      string,
      unknown
    >;
    expect(ru.root).toBe("version");
    expect(ru.icon).toBe("Rocket");
    expect(ru.title).toBe("v2 (актуальная)");
  });

  test("does not override a value the translation sets itself", () => {
    const files = [
      { type: "meta", path: "meta.json", data: { icon: "A" } },
      { type: "meta", path: "meta.ru.json", data: { icon: "B" } },
    ];
    const result = completeMetaPages({ files }, ["en", "ru"], "en", () => {});
    expect((result.files[1]?.data as { icon: string }).icon).toBe("B");
  });
});
