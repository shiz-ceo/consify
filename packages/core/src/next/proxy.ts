import { defineI18n } from "fumadocs-core/i18n";
import { createI18nMiddleware } from "fumadocs-core/i18n/middleware";
import type { DocsConfig } from "../config/index.ts";

/** Redirects `/` and unprefixed paths to the visitor's language. Use as the default export of `proxy.ts`. */
export function createProxy(config: Readonly<DocsConfig>) {
  return createI18nMiddleware(
    defineI18n({
      defaultLanguage: config.i18n.defaultLanguage,
      languages: config.i18n.languages,
    }),
  );
}
