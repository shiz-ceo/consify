import type { DocsConfig } from "../config/index.ts";
import { localized } from "../shared/localized.ts";
import { createTranslate } from "./translate.ts";
import type { Feature, FeatureText } from "./types.ts";

/** A text of a feature (`title`, `description`) in a language. */
export function featureText(
  config: Readonly<DocsConfig>,
  lang: string,
  text: FeatureText | undefined,
  feature?: Pick<Feature, "messages">,
): string | undefined {
  if (typeof text === "function") return text({ lang, t: createTranslate(config, lang, feature) });
  return localized(config, lang, text);
}
