import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { completeMetaPages } from "../src/shared/fallback.ts";

describe("fallback pages", () => {
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
      page("en/guide/index.mdx"),
      page("en/guide/one.mdx"),
      page("en/guide/layout.mdx"),
      page("ru/guide/one.mdx"),
      meta("en/guide/meta.json", ["index", "one", "layout"]),
      meta("ru/guide/meta.json", ["index", "one"]),
    ] as never);
    const ru = result.find((f) => f.path === "ru/guide/meta.json");
    expect(ru?.data.pages).toEqual(["index", "one", "layout"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('does not list "layout"');
    // the default list is untouched
    expect(result.find((f) => f.path === "en/guide/meta.json")?.data.pages).toEqual([
      "index",
      "one",
      "layout",
    ]);
  });

  test("leaves complete lists, lists with the rest marker and meta without pages alone", () => {
    const { result, warnings } = run([
      page("en/a/one.mdx"),
      page("en/a/two.mdx"),
      meta("ru/a/meta.json", ["one", "two"]),
      page("en/b/one.mdx"),
      page("en/b/two.mdx"),
      meta("ru/b/meta.json", ["one", "..."]),
      page("en/c/one.mdx"),
      meta("ru/c/meta.json", undefined),
    ] as never);
    expect(result.find((f) => f.path === "ru/a/meta.json")?.data.pages).toEqual(["one", "two"]);
    expect(result.find((f) => f.path === "ru/b/meta.json")?.data.pages).toEqual(["one", "..."]);
    expect(result.find((f) => f.path === "ru/c/meta.json")?.data.pages).toBeUndefined();
    expect(warnings).toHaveLength(0);
  });

  test("sees folders too and ignores separators and the index page", () => {
    const { result } = run([
      page("en/index.mdx"),
      page("en/guides/one.mdx"),
      page("en/intro.mdx"),
      meta("ru/meta.json", ["index", "---Learn---", "intro"]),
    ] as never);
    expect(result.find((f) => f.path === "ru/meta.json")?.data.pages).toEqual([
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
      { type: "page", path: "en/v2/index.mdx", data: {} },
      {
        type: "meta",
        path: "en/v2/meta.json",
        data: { title: "v2", root: "version", icon: "Rocket", pages: ["index"] },
      },
      {
        type: "meta",
        path: "ru/v2/meta.json",
        data: { title: "v2 (актуальная)", pages: ["index"] },
      },
    ];
    const result = completeMetaPages({ files }, ["en", "ru"], "en", () => {});
    const ru = result.files.find((f) => f.path === "ru/v2/meta.json")?.data as Record<
      string,
      unknown
    >;
    expect(ru.root).toBe("version");
    expect(ru.icon).toBe("Rocket");
    expect(ru.title).toBe("v2 (актуальная)");
  });

  test("does not override a value the translation sets itself", () => {
    const files = [
      { type: "meta", path: "en/meta.json", data: { icon: "A" } },
      { type: "meta", path: "ru/meta.json", data: { icon: "B" } },
    ];
    const result = completeMetaPages({ files }, ["en", "ru"], "en", () => {});
    expect((result.files[1]?.data as { icon: string }).icon).toBe("B");
  });
});
