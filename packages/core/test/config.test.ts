import { describe, expect, test } from "bun:test";
import { applyDeprecations } from "../src/config/deprecations.ts";
import { DocsConfigError, defineConfig, parseDocsConfig } from "../src/config/index.ts";

const minimal = { site: { name: "Docs" } };

describe("defineConfig", () => {
  test("applies defaults to a minimal config", () => {
    const config = defineConfig(minimal);
    expect(config.i18n).toEqual({
      defaultLanguage: "en",
      languages: ["en"],
      labels: {},
      messages: {},
    });
    expect(config.versions).toEqual({ list: [], default: undefined });
    expect(config.features.twoslash).toBe(true);
    expect(config.features.search).toBe(true);
    expect(config.plugins).toEqual([]);
    expect(config.theme.colors).toEqual({ light: {}, dark: {} });
  });

  test("keeps user values and lets features be switched off", () => {
    const config = defineConfig({ ...minimal, features: { search: false } });
    expect(config.features.search).toBe(false);
    expect(config.features.toc).toBe(true);
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
    expect(() => parseDocsConfig({ ...minimal, components: { callout: () => null } })).toThrow(
      /capital letter/,
    );
  });

  test("duplicate plugin names are rejected", () => {
    expect(() => parseDocsConfig({ ...minimal, plugins: [{ name: "a" }, { name: "a" }] })).toThrow(
      /duplicate plugin name "a"/,
    );
  });
});

describe("versions", () => {
  test("default is the latest version", () => {
    const config = defineConfig({
      ...minimal,
      versions: {
        list: [
          { id: "v1", status: "deprecated" },
          { id: "v2", status: "latest" },
        ],
      },
    });
    expect(config.versions.default).toBe("v2");
  });

  test("default falls back to the first version", () => {
    const config = defineConfig({ ...minimal, versions: { list: [{ id: "v1" }, { id: "v2" }] } });
    expect(config.versions.default).toBe("v1");
  });

  test("rejects duplicates, several latest and an unknown default", () => {
    expect(() =>
      parseDocsConfig({ ...minimal, versions: { list: [{ id: "v1" }, { id: "v1" }] } }),
    ).toThrow(/unique/);
    expect(() =>
      parseDocsConfig({
        ...minimal,
        versions: {
          list: [
            { id: "a", status: "latest" },
            { id: "b", status: "latest" },
          ],
        },
      }),
    ).toThrow(/only one version/);
    expect(() =>
      parseDocsConfig({ ...minimal, versions: { list: [{ id: "v1" }], default: "v9" } }),
    ).toThrow(/"v9" is not in the list/);
  });
});

describe("deprecations", () => {
  const table = [{ path: "theme.radius", replacedBy: "theme.radii.base", since: "0.2.0" }];

  test("moves the value and warns", () => {
    const { input, warnings } = applyDeprecations({ theme: { radius: "1rem" } }, table);
    expect(input).toEqual({ theme: { radii: { base: "1rem" } } });
    expect(warnings).toEqual([
      '"theme.radius" is deprecated since docsivi 0.2.0, use "theme.radii.base" instead',
    ]);
  });

  test("does not override a value set at the new path", () => {
    const { input } = applyDeprecations(
      { theme: { radius: "1rem", radii: { base: "2rem" } } },
      table,
    );
    expect(input).toEqual({ theme: { radii: { base: "2rem" } } });
  });

  test("removed option without replacement", () => {
    const { warnings } = applyDeprecations({ old: 1 }, [
      { path: "old", since: "0.3.0", hint: "Delete it." },
    ]);
    expect(warnings).toEqual([
      '"old" is deprecated since docsivi 0.3.0 and has no replacement. Delete it.',
    ]);
  });

  test("returns the input untouched when the option is absent", () => {
    const source = { site: { name: "D" } };
    const { input, warnings } = applyDeprecations(source, table);
    expect(warnings).toEqual([]);
    expect(input).toEqual(source);
    expect(input).toBe(source);
  });

  test("leaves functions elsewhere in the config intact (no deep clone)", () => {
    const Component = () => null;
    const { input } = applyDeprecations(
      { components: { Foo: Component }, theme: { radius: "1rem" } },
      table,
    );
    expect((input.components as Record<string, unknown>).Foo).toBe(Component);
  });

  test("parseDocsConfig forwards warnings", () => {
    const seen: string[] = [];
    parseDocsConfig(minimal, { onWarning: (m) => seen.push(m) });
    expect(seen).toEqual([]);
  });
});

describe("plugins", () => {
  test("accepts every documented field", () => {
    const config = parseDocsConfig({
      ...minimal,
      plugins: [{ name: "p", remark: [() => {}], rehype: [() => {}], shiki: { langs: ["rust"] } }],
    });
    expect(config.plugins[0]?.name).toBe("p");
  });

  test("unknown plugin fields (typos) are rejected", () => {
    expect(() => parseDocsConfig({ ...minimal, plugins: [{ name: "p", rehyp: [] }] })).toThrow(
      /Unrecognized key: "rehyp"/,
    );
  });
});

describe("openapi", () => {
  test("is optional and takes a single schema or a list, title defaults to API", () => {
    expect(parseDocsConfig(minimal).openapi).toBeUndefined();
    expect(parseDocsConfig({ ...minimal, openapi: { input: "./openapi.json" } }).openapi).toEqual({
      input: "./openapi.json",
      title: "API",
    });
    const many = parseDocsConfig({
      ...minimal,
      openapi: { input: ["./a.json", "https://example.com/b.json"], title: "Reference" },
    });
    expect(many.openapi?.title).toBe("Reference");
  });

  test("an empty input or an unknown field is rejected", () => {
    expect(() => parseDocsConfig({ ...minimal, openapi: { input: [] } })).toThrow();
    expect(() => parseDocsConfig({ ...minimal, openapi: { input: "a.json", path: "x" } })).toThrow(
      /Unrecognized key: "path"/,
    );
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
