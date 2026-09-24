import type { DocsConfig } from "../../config/index.ts";

/** A text that is either one string or one string per language: the one for `lang`, else the default language, else any. */
export function localized(
  config: Readonly<DocsConfig>,
  lang: string,
  value: string | Readonly<Record<string, string>> | undefined,
): string | undefined {
  if (value === undefined || typeof value === "string") return value;
  return value[lang] ?? value[config.i18n.defaultLanguage] ?? Object.values(value)[0];
}

/** Category id → label in `lang`. */
export function categoryLabels(config: Readonly<DocsConfig>, lang: string): Record<string, string> {
  return Object.fromEntries(
    (config.blog?.categories ?? []).map((c) => [c.id, localized(config, lang, c.label) ?? c.id]),
  );
}

/** Author id → name. */
export function authorNames(config: Readonly<DocsConfig>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config.blog?.authors ?? {}).map(([id, author]) => [id, author.name]),
  );
}
