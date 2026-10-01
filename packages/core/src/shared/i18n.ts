import { defineI18n } from "fumadocs-core/i18n";
import type { DocsConfig } from "../config/index.ts";

/**
 * The languages of the site for Fumadocs: the language is the first folder of a file
 * (`ru/v2/guide.mdx`), and with `i18n.fallback: "hide"` a page without a translation does not exist
 * in that language.
 */
export function fumadocsI18n(config: Readonly<DocsConfig>) {
  return defineI18n({
    defaultLanguage: config.i18n.defaultLanguage,
    languages: config.i18n.languages,
    parser: "dir",
    ...(config.i18n.fallback === "hide" ? { fallbackLanguage: null } : {}),
  });
}
