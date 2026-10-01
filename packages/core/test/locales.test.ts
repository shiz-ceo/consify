import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uiTranslations } from "fumadocs-ui/i18n";
import { defineConfig } from "../src/config/index.ts";
import { defineFeature } from "../src/feature/define.ts";
import { builtinLocales, defineLocale } from "../src/locales/index.ts";
import {
  localeLabel,
  localesFromGlob,
  localeUi,
  registerLocales,
} from "../src/locales/registry.ts";
import { englishUi, missingLocales, renderLocaleTemplate } from "../src/locales/template.ts";
import { getMessages } from "../src/shared/messages.ts";

const site = { name: "D" };
const feature = defineFeature({
  id: "shop",
  messages: { en: { cart: "Cart", pay: "Pay" }, ru: { cart: "Корзина" } },
});

describe("built-in languages", () => {
  test("English and Russian ship with consify, Russian also translates the Fumadocs widgets", () => {
    expect(Object.keys(builtinLocales)).toEqual(["en", "ru"]);
    expect(builtinLocales.ru?.ui?.["On this page(table of contents)"]).toBe("На этой странице");
  });

  test("Russian has every Fumadocs string and every string of consify", () => {
    const keys = (uiTranslations().keys as readonly string[]).filter((k) => k !== "displayName");
    expect(keys.filter((key) => !(key in (builtinLocales.ru?.ui ?? {})))).toEqual([]);
    const english = Object.keys(builtinLocales.en?.messages ?? {});
    expect(english.filter((key) => !(key in (builtinLocales.ru?.messages ?? {})))).toEqual([]);
  });
});

describe("the order of the strings", () => {
  const config = defineConfig({
    site,
    i18n: {
      languages: ["en", "ru", "de"],
      messages: { ru: { notFound: "из конфига" } },
    },
    mdx: {
      plugins: [
        { name: "p", messages: { en: { hint: "Hint" }, ru: { hint: "Подсказка", pay: "Плати" } } },
      ],
    },
    features: [feature],
  });
  registerLocales(config, {
    ru: defineLocale({ messages: { notFound: "из файла", backToHome: "домой", pay: "Оплатить" } }),
    de: defineLocale({ label: "Deutsch", messages: { notFound: "Nicht gefunden" } }),
  });

  test("English, then the language, then plugins, then the project's file, then the config", () => {
    const ru = getMessages<{ cart: string; pay: string; hint: string }>(config, "ru");
    expect(ru.notFound).toBe("из конфига");
    expect(ru.backToHome).toBe("домой");
    expect(ru.footerSections).toBe("Разделы");
    expect(ru.cart).toBe("Корзина");
    expect(ru.pay).toBe("Оплатить");
    expect(ru.hint).toBe("Подсказка");
  });

  test("a language without strings falls back to English key by key", () => {
    const de = getMessages<{ cart: string }>(config, "de");
    expect(de.notFound).toBe("Nicht gefunden");
    expect(de.footerSections).toBe("Explore");
    expect(de.cart).toBe("Cart");
  });

  test("the config accepts the keys of plugins and features, and rejects the rest", () => {
    expect(() =>
      defineConfig({ site, features: [feature], i18n: { messages: { en: { pay: "x" } } } }),
    ).not.toThrow();
    expect(() =>
      defineConfig({
        site,
        mdx: { plugins: [{ name: "p", messages: { en: { hint: "h" } } }] },
        i18n: { messages: { en: { hint: "x" } } },
      }),
    ).not.toThrow();
    expect(() => defineConfig({ site, i18n: { messages: { en: { nope: "x" } } } })).toThrow(
      /unknown message "nope"/,
    );
  });

  test("the name of a language: config, the project's pack, the built-in one, the code", () => {
    const named = defineConfig({
      site,
      i18n: { languages: ["en", "ru", "de", "fr"], labels: { ru: "RU" } },
    });
    registerLocales(named, { de: defineLocale({ label: "Deutsch" }) });
    expect(localeLabel(named, "ru")).toBe("RU");
    expect(localeLabel(named, "de")).toBe("Deutsch");
    expect(localeLabel(named, "en")).toBe("English");
    expect(localeLabel(named, "fr")).toBe("fr");
  });

  test("the widgets get the built-in strings and the project's on top", () => {
    const ui = defineConfig({ site, i18n: { languages: ["en", "ru"] } });
    registerLocales(ui, {
      ru: defineLocale({ ui: { "Search(search trigger)": "Найти" } }),
    });
    expect(localeUi(ui, "ru")["Search(search trigger)"]).toBe("Найти");
    expect(localeUi(ui, "ru")["Next Page(pagination)"]).toBe("Следующая страница");
    expect(localeUi(ui, "en")).toEqual({});
  });
});

describe("localesFromGlob", () => {
  test("the file name is the language and the default export is the pack", () => {
    const pack = defineLocale({ label: "Deutsch" });
    expect(
      localesFromGlob({
        "/custom/locales/de.ts": { default: pack },
        "/custom/locales/pt-BR.json": { default: { label: "Português" } },
        "/custom/locales/empty.ts": {},
      }),
    ).toEqual({ de: pack, "pt-BR": { label: "Português" } });
  });
});

describe("the template and the command", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-locale-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("englishUi drops the place in parentheses", () => {
    expect(englishUi("On this page(table of contents)")).toBe("On this page");
    expect(englishUi("Close Sidebar(sidebar)(aria-label)")).toBe("Close Sidebar");
    expect(englishUi("Read {url}, I want to ask questions about it.(page actions)")).toBe(
      "Read {url}, I want to ask questions about it.",
    );
  });

  test("lists every string of consify, of the features and of the widgets", () => {
    const config = defineConfig({ site, features: [feature] });
    const source = renderLocaleTemplate(config, "de");
    expect(source).toContain('import { defineLocale } from "@consify/core"');
    expect(source).toContain('label: "Deutsch"');
    expect(source).toContain('notFound: "This page could not be found."');
    expect(source).toContain("// shop");
    expect(source).toContain('cart: "Cart"');
    expect(source).toContain('"On this page(table of contents)": "On this page"');
  });

  test("for a built-in language it starts from the current translation", () => {
    const source = renderLocaleTemplate(defineConfig({ site, features: [feature] }), "ru");
    expect(source).toContain('notFound: "Такой страницы не существует."');
    expect(source).toContain('cart: "Корзина"');
    expect(source).toContain('pay: "Pay"');
  });

  test("the template is valid TypeScript that defines a pack", async () => {
    const source = renderLocaleTemplate(defineConfig({ site }), "de").replace(
      'from "@consify/core"',
      `from ${JSON.stringify(join(import.meta.dir, "../src/locales/index.ts"))}`,
    );
    const file = join(cwd, "de.ts");
    writeFileSync(file, source);
    const pack = (await import(file)).default;
    expect(pack.label).toBe("Deutsch");
    expect(pack.messages.notFound).toBeString();
    expect(Object.keys(pack.ui).length).toBeGreaterThan(30);
  });

  test("a language with neither a built-in pack nor a file is reported", () => {
    const config = defineConfig({ site, i18n: { languages: ["en", "ru", "de", "fr"] } });
    expect(missingLocales(config, cwd)).toEqual(["de", "fr"]);
    mkdirSync(join(cwd, "custom/locales"), { recursive: true });
    writeFileSync(join(cwd, "custom/locales/de.ts"), "export default {};");
    expect(missingLocales(config, cwd)).toEqual(["fr"]);
  });
});
