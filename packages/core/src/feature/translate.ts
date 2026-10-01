import type { DocsConfig } from "../config/index.ts";
import { format, getMessages } from "../shared/messages.ts";
import type { Feature, Translate } from "./types.ts";

/**
 * `t` of a language: the strings of `feature` first, then of consify and the other features,
 * overridden by the project (`custom/locales`, `i18n.messages`). An unknown key is shown as is.
 */
export function createTranslate<Key extends string = string>(
  config: Readonly<DocsConfig>,
  lang: string,
  feature?: Pick<Feature, "messages">,
): Translate<Key> {
  const messages = getMessages(config, lang, feature) as Record<string, string>;
  return (key, values) => {
    const text = messages[key] ?? key;
    return values ? format(text, values) : text;
  };
}
