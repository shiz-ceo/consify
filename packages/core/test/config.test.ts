import { describe, expect, test } from "bun:test";
import { DocsConfigError, defineConfig, parseDocsConfig } from "../src/config/index.ts";

const minimal = { site: { name: "Docs" } };

describe("defineConfig", () => {
  test("applies defaults to a minimal config", () => {
    const config = defineConfig(minimal);
    expect(config.i18n).toEqual({
      defaultLanguage: "en",
      languages: ["en"],
      fallback: "notice",
      labels: {},
      messages: {},
    });
    expect(config.features).toEqual([]);
    expect(config.mdx).toMatchObject({ math: true, components: {}, plugins: [] });
    expect(config.mdx.twoslash).toEqual({ cache: true });
    expect(config.theme.colors).toEqual({ light: {}, dark: {} });
  });

  test("keeps user values and lets MDX switches be turned off", () => {
    const config = defineConfig({ ...minimal, mdx: { math: false, twoslash: false } });
    expect(config.mdx.math).toBe(false);
    expect(config.mdx.twoslash).toBe(false);
  });

  test("result is frozen", () => {
    const config = defineConfig(minimal);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.i18n.languages)).toBe(true);
  });
});

describe("validation errors", () => {
  test("missing site name gives a readable path", () => {
    expect(() => parseDocsConfig({ site: {} })).toThrow(/at site\.name/);
  });

  test("unknown keys are rejected", () => {
    expect(() => parseDocsConfig({ ...minimal, themee: {} })).toThrow(/Unrecognized key: "themee"/);
  });

  test("error is a DocsConfigError with issues", () => {
    try {
      parseDocsConfig({});
      throw new Error("should not reach");
    } catch (error) {
      expect(error).toBeInstanceOf(DocsConfigError);
      expect((error as DocsConfigError).issues.length).toBeGreaterThan(0);
      expect((error as Error).message).toStartWith("Invalid docs.config:");
    }
  });

  test("default language must be listed", () => {
    expect(() =>
      parseDocsConfig({ ...minimal, i18n: { defaultLanguage: "de", languages: ["en", "ru"] } }),
    ).toThrow(/defaultLanguage "de" must be one of: en, ru/);
  });

  test("duplicate languages and labels for unknown languages are rejected", () => {
    expect(() => parseDocsConfig({ ...minimal, i18n: { languages: ["en", "en"] } })).toThrow(
      /unique/,
    );
    expect(() =>
      parseDocsConfig({ ...minimal, i18n: { languages: ["en"], labels: { ru: "Русский" } } }),
    ).toThrow(/unknown language "ru"/);
  });

  test("invalid github repo", () => {
    expect(() => parseDocsConfig({ site: { name: "D", github: { repo: "nope" } } })).toThrow(
      /owner\/name/,
    );
  });

  test("component names must be capitalized", () => {
    expect(() =>
      parseDocsConfig({ ...minimal, mdx: { components: { callout: () => null } } }),
    ).toThrow(/capital letter/);
  });

  test("duplicate plugin names are rejected", () => {
    expect(() =>
      parseDocsConfig({ ...minimal, mdx: { plugins: [{ name: "a" }, { name: "a" }] } }),
    ).toThrow(/duplicate plugin name "a"/);
  });
});

describe("plugins", () => {
  test("accepts every documented field", () => {
    const config = parseDocsConfig({
      ...minimal,
      mdx: {
        plugins: [
          { name: "p", remark: [() => {}], rehype: [() => {}], shiki: { langs: ["rust"] } },
        ],
      },
    });
    expect(config.mdx.plugins[0]?.name).toBe("p");
  });

  test("unknown plugin fields (typos) are rejected", () => {
    expect(() =>
      parseDocsConfig({ ...minimal, mdx: { plugins: [{ name: "p", rehyp: [] }] } }),
    ).toThrow(/Unrecognized key: "rehyp"/);
  });
});

describe("footer", () => {
  test("is not set by default and can be turned off", () => {
    expect(defineConfig(minimal).footer).toBeUndefined();
    expect(defineConfig({ ...minimal, footer: false }).footer).toBe(false);
  });

  test("accepts columns, social icons and per-language texts", () => {
    const config = defineConfig({
      ...minimal,
      footer: {
        description: { en: "Hello" },
        columns: [{ title: "Product", links: [{ title: { en: "Docs" }, url: "/docs" }] }],
        social: [{ type: "github", url: "https://github.com/x/y" }],
      },
    });
    expect(config.footer).toMatchObject({ social: [{ type: "github" }] });
  });

  test("rejects an unknown social network", () => {
    expect(() =>
      defineConfig({ ...minimal, footer: { social: [{ type: "myspace", url: "x" }] } } as never),
    ).toThrow(DocsConfigError);
  });

  test("rejects a column without links", () => {
    expect(() =>
      defineConfig({ ...minimal, footer: { columns: [{ title: "Empty", links: [] }] } }),
    ).toThrow(DocsConfigError);
  });
});
