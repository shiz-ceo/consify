import type { DocsConfig } from "../config/index.ts";

/** A text that is either one string or one string per language: the one for `lang`, else the default language, else any. */
export function localized(
  config: Readonly<DocsConfig>,
  lang: string,
  value: string | Readonly<Record<string, string>> | undefined,
): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  return value[lang] ?? value[config.i18n.defaultLanguage] ?? Object.values(value)[0];
}
