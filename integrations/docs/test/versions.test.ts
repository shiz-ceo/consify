import { describe, expect, test } from "bun:test";
import { defineConfig, format, getMessages, resolveHref } from "@consify/core";
import { type DocsMessages, docs } from "../src/index.ts";
import { deprecationOf, versionFromSlug, versionsSchema } from "../src/versions.ts";

const site = { name: "D" };
const versions = (input: unknown) => versionsSchema.parse(input);

const versioned = docs({
  versions: {
    list: [
      { id: "v2", status: "latest" },
      { id: "v1", label: "1.x", status: "deprecated" },
    ],
  },
});
const versionedConfig = defineConfig({
  site,
  i18n: { languages: ["en", "ru"], messages: { ru: { documentation: "Доки" } } },
  features: [versioned],
});
const plainConfig = defineConfig({ site, features: [docs()] });
const latestAndDeprecated = versions({
  list: [
    { id: "v2", status: "latest" },
    { id: "v1", label: "1.x", status: "deprecated" },
  ],
});

describe("version options", () => {
  test("default is the latest version, else the first", () => {
    expect(
      versions({
        list: [
          { id: "v1", status: "deprecated" },
          { id: "v2", status: "latest" },
        ],
      }).default,
    ).toBe("v2");
    expect(versions({ list: [{ id: "v1" }, { id: "v2" }] }).default).toBe("v1");
    expect(versions({}).default).toBeUndefined();
  });

  test("rejects duplicates, several latest, an unknown default and bad ids", () => {
    expect(() => versions({ list: [{ id: "v1" }, { id: "v1" }] })).toThrow(/unique/);
    expect(() =>
      versions({
        list: [
          { id: "a", status: "latest" },
          { id: "b", status: "latest" },
        ],
      }),
    ).toThrow(/only one version/);
    expect(() => versions({ list: [{ id: "v1" }], default: "v9" })).toThrow(/not in the list/);
    expect(() => versions({ list: [{ id: "v 1" }] })).toThrow();
  });
});

describe("versions", () => {
  test("versionFromSlug reads the first segment", () => {
    const v = latestAndDeprecated;
    expect(versionFromSlug(v, ["v1", "guide"])?.id).toBe("v1");
    expect(versionFromSlug(v, ["other"])).toBeUndefined();
    expect(versionFromSlug(v, undefined)).toBeUndefined();
  });

  test("deprecationOf returns the latest version to link to", () => {
    const v = latestAndDeprecated;
    const result = deprecationOf(v, ["v1", "guide"]);
    expect(result?.version.id).toBe("v1");
    expect(result?.latest?.id).toBe("v2");
    expect(deprecationOf(v, ["v2"])).toBeUndefined();
    expect(deprecationOf(versions({}), ["v1"])).toBeUndefined();
  });
});

describe("messages of the docs", () => {
  test("built-in per language, config override, English fallback", () => {
    const ru = getMessages<DocsMessages>(versionedConfig, "ru");
    expect(ru.documentation).toBe("Доки");
    expect(ru.goToLatest).toContain("Перейти");
    expect(getMessages<DocsMessages>(versionedConfig, "en").documentation).toBe("Documentation");
    expect(getMessages<DocsMessages>(plainConfig, "de").documentation).toBe("Documentation");
  });

  test("format replaces known placeholders only", () => {
    expect(format("Go to {latest} {x}", { latest: "v2" })).toBe("Go to v2 {x}");
  });
});

describe("resolveHref", () => {
  test("prefixes the language (`/docs` then redirects to the default version), external links stay", () => {
    expect(resolveHref(versionedConfig, "ru", "/docs")).toBe("/ru/docs");
    expect(resolveHref(versionedConfig, "ru", "/ru/docs/v2")).toBe("/ru/docs/v2");
    expect(resolveHref(plainConfig, "en", "/docs")).toBe("/en/docs");
    expect(resolveHref(versionedConfig, "en", "/docs/v2/changelog")).toBe("/en/docs/v2/changelog");
    expect(resolveHref(versionedConfig, "en", "https://example.com/x")).toBe(
      "https://example.com/x",
    );
    expect(resolveHref(versionedConfig, "en", "//cdn.example.com")).toBe("//cdn.example.com");
    expect(resolveHref(versionedConfig, "en", "#top")).toBe("#top");
  });
});
