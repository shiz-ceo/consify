import type { DocsConfig } from "../config/index.ts";
import type { Feature } from "../feature/types.ts";
import { builtinLocales, type CoreMessageKey, coreMessageKeys } from "../locales/index.ts";
import { projectLocale } from "../locales/registry.ts";

export { coreMessageKeys };
export type MessageKey = CoreMessageKey;
export type CoreMessages = Record<MessageKey, string>;
/**
 * The strings of consify, plus those of the features when `T` names them. Features bring their
 * own strings: `getMessages<BlogMessages>(config, lang)`.
 */
export type Messages<T extends Record<string, string> = Record<never, string>> = CoreMessages & T;

/**
 * The type of the strings of a feature, from its `messages` object: every key of the English
 * strings (the reference language, the one every feature ships complete) as a `string`.
 *
 * @example
 * export const blogMessages = { en: { blog: "Blog" }, ru: { blog: "Блог" } } as const;
 * export type BlogMessages = MessagesOf<typeof blogMessages>; // { blog: string }
 */
export type MessagesOf<Strings extends { en: Readonly<Record<string, string>> }> = Record<
  keyof Strings["en"],
  string
>;

/** Every string key the features bring. */
export function featureMessageKeys(features: readonly Feature[]): string[] {
  return features.flatMap((feature) =>
    Object.values(feature.messages ?? {}).flatMap((strings) => Object.keys(strings)),
  );
}

/**
 * The strings for a language, the last source wins:
 * 1. English (consify and the features),
 * 2. the language's own strings of consify and the features,
 * 3. `messages` of plugins,
 * 4. the strings of `feature`, when the strings are read for one (two features may use the same key),
 * 5. the project's language pack (`custom/locales/<lang>`),
 * 6. `i18n.messages` in `docs.config.ts`.
 * A language that nothing knows falls back to English.
 *
 * @param config The site config.
 * @param lang The language to read the strings in.
 * @param feature Pass a feature to prefer its own strings over those of other features.
 * @example
 * const t = getMessages<{ backToBlog: string }>(config, "ru", blogFeature);
 * t.backToBlog; // the Russian string, else the English one
 */
export function getMessages<T extends Record<string, string> = Record<never, string>>(
  config: Readonly<DocsConfig>,
  lang: string,
  feature?: Pick<Feature, "messages">,
): Messages<T> {
  const layers = (code: string) => [
    builtinLocales[code]?.messages,
    ...config.features.map((feature) => feature.messages[code]),
  ];
  return Object.assign(
    {},
    ...layers("en"),
    ...(lang === "en" ? [] : layers(lang)),
    ...config.mdx.plugins.map((plugin) => plugin.messages?.en),
    ...(lang === "en" ? [] : config.mdx.plugins.map((plugin) => plugin.messages?.[lang])),
    feature?.messages.en,
    lang === "en" ? undefined : feature?.messages[lang],
    projectLocale(config, "en")?.messages,
    lang === "en" ? undefined : projectLocale(config, lang)?.messages,
    config.i18n.messages[lang],
  ) as Messages<T>;
}

/**
 * Fills `{name}` placeholders of a UI string. A placeholder without a value is left as it is.
 *
 * @example
 * format("Read in {language}", { language: "English" }); // "Read in English"
 */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
