import type { Translations } from "fumadocs-ui/i18n";

/** The keys of the strings of the Fumadocs widgets (sidebar, search, table of contents, theme switcher …). */
export type UiKey = Exclude<keyof Translations, "displayName">;

/**
 * A language pack: the strings of the interface in one language.
 *
 * A project adds one as `custom/locales/<language>.ts` (or `.json`, with the same fields).
 */
export interface Locale {
  /** The name of the language in the language switcher, in that language. `i18n.labels` wins. */
  label?: string;
  /**
   * Strings of consify and of its features (`notFound`, the blog's `backToBlog` …). Run
   * `consify locale <language>` to get a file with every key.
   */
  messages?: Record<string, string>;
  /**
   * Strings of the Fumadocs widgets, keyed by their English text with the place in parentheses,
   * for example `"On this page(table of contents)"`. The template lists them all.
   */
  ui?: Partial<Record<UiKey, string>>;
}

/**
 * Describes a language pack. It returns its argument; the function is there for the types.
 *
 * @example
 * // custom/locales/de.ts
 * export default defineLocale({
 *   label: "Deutsch",
 *   messages: { notFound: "Diese Seite wurde nicht gefunden." },
 * });
 */
export function defineLocale(locale: Locale): Locale {
  return locale;
}
