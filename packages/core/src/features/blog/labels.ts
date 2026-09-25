import type { DocsConfig } from "../../config/index.ts";
import { localized } from "../../shared/localized.ts";

export { localized };

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
