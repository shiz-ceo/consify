import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { resolveHref } from "../src/links.ts";
import { format, getMessages } from "../src/messages.ts";
import { defaultDocsPath, deprecationOf, versionFromSlug } from "../src/versions.ts";

const versioned = defineConfig({
  site: { name: "D" },
  i18n: { languages: ["en", "ru"], messages: { ru: { documentation: "Доки" } } },
  versions: {
    list: [
      { id: "v2", status: "latest" },
      { id: "v1", label: "1.x", status: "deprecated" },
    ],
  },
});
const plain = defineConfig({ site: { name: "D" } });

describe("versions", () => {
  test("versionFromSlug reads the first segment", () => {
    expect(versionFromSlug(versioned, ["v1", "guide"])?.id).toBe("v1");
    expect(versionFromSlug(versioned, ["other"])).toBeUndefined();
    expect(versionFromSlug(versioned, undefined)).toBeUndefined();
  });

  test("defaultDocsPath points to the default version or is undefined", () => {
    expect(defaultDocsPath(versioned, "ru")).toBe("/ru/docs/v2");
    expect(defaultDocsPath(plain, "en")).toBeUndefined();
  });

  test("deprecationOf returns the latest version to link to", () => {
    const result = deprecationOf(versioned, ["v1", "guide"]);
    expect(result?.version.id).toBe("v1");
    expect(result?.latest?.id).toBe("v2");
    expect(deprecationOf(versioned, ["v2"])).toBeUndefined();
    expect(deprecationOf(plain, ["v1"])).toBeUndefined();
  });
});

describe("messages", () => {
  test("built-in per language, config override, English fallback", () => {
    expect(getMessages(versioned, "ru").documentation).toBe("Доки");
    expect(getMessages(versioned, "ru").goToLatest).toContain("Перейти");
    expect(getMessages(versioned, "en").documentation).toBe("Documentation");
    expect(getMessages(plain, "de").documentation).toBe("Documentation");
  });

  test("format replaces known placeholders only", () => {
    expect(format("Go to {latest} {x}", { latest: "v2" })).toBe("Go to v2 {x}");
  });

  test("unknown message language or key is rejected", () => {
    expect(() =>
      defineConfig({ site: { name: "D" }, i18n: { languages: ["en"], messages: { fr: {} } } }),
    ).toThrow(/messages for unknown language "fr"/);
    expect(() =>
      defineConfig({
        site: { name: "D" },
        // @ts-expect-error unknown key
        i18n: { languages: ["en"], messages: { en: { nope: "x" } } },
      }),
    ).toThrow();
  });
});

describe("resolveHref", () => {
  test("prefixes the language, `/docs` opens the default version, external links stay", () => {
    expect(resolveHref(versioned, "ru", "/docs")).toBe("/ru/docs/v2");
    expect(resolveHref(plain, "en", "/docs")).toBe("/en/docs");
    expect(resolveHref(versioned, "en", "/docs/v2/changelog")).toBe("/en/docs/v2/changelog");
    expect(resolveHref(versioned, "en", "https://example.com/x")).toBe("https://example.com/x");
    expect(resolveHref(versioned, "en", "//cdn.example.com")).toBe("//cdn.example.com");
    expect(resolveHref(versioned, "en", "#top")).toBe("#top");
  });
});
