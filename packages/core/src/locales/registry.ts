import type { DocsConfig } from "../config/index.ts";
import type { Locale } from "./define.ts";
import { builtinLocales } from "./index.ts";

/**
 * The language packs of the project (`custom/locales`), found by the Vite glob of the generated
 * `.consify/instance.ts`. They are kept by config, because the strings are read with the config in
 * hand (`getMessages(config, lang)`), on the server and in the browser alike.
 */
const projectLocales = new WeakMap<object, Readonly<Record<string, Locale>>>();

export function registerLocales(
  config: Readonly<DocsConfig>,
  locales: Readonly<Record<string, Locale>>,
): void {
  projectLocales.set(config, locales);
}

/** The pack of the project for a language, if it has one. */
export function projectLocale(config: Readonly<DocsConfig>, lang: string): Locale | undefined {
  return projectLocales.get(config)?.[lang];
}

/**
 * Turns the result of `import.meta.glob("/custom/locales/*.{ts,json}", { eager: true })` into packs:
 * the file name is the language, the default export is the pack.
 */
export function localesFromGlob(modules: Record<string, unknown>): Record<string, Locale> {
  const locales: Record<string, Locale> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const lang = /([^/]+)\.(?:ts|js|json)$/.exec(path)?.[1];
    const locale = (mod as { default?: unknown } | null)?.default;
    if (lang && typeof locale === "object" && locale !== null) locales[lang] = locale as Locale;
  }
  return locales;
}

/** The name of a language, as the language switcher shows it: `i18n.labels`, the project's pack, the built-in one, the code. */
export function localeLabel(config: Readonly<DocsConfig>, lang: string): string {
  return (
    config.i18n.labels[lang] ??
    projectLocale(config, lang)?.label ??
    builtinLocales[lang]?.label ??
    lang
  );
}

/** The strings of the Fumadocs widgets for a language: the built-in ones, then the project's. */
export function localeUi(config: Readonly<DocsConfig>, lang: string): Record<string, string> {
  return {
    ...builtinLocales[lang]?.ui,
    ...projectLocale(config, lang)?.ui,
  } as Record<string, string>;
}
