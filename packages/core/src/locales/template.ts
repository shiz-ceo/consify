import { existsSync } from "node:fs";
import { join } from "node:path";
import { uiTranslations } from "fumadocs-ui/i18n";
import type { DocsConfig } from "../config/index.ts";
import { builtinLocales } from "./index.ts";

/** The English text of a Fumadocs widget string: the key without its place in parentheses. */
export function englishUi(key: string): string {
  return key.replace(/(?:\([^()]*\))+$/, "");
}

/** The name of a language in that language (`Deutsch`), when the runtime knows it. */
function nativeName(lang: string): string {
  try {
    const name = new Intl.DisplayNames([lang], { type: "language" }).of(lang);
    return name && name !== lang ? name : lang;
  } catch {
    return lang;
  }
}

const string = (value: string) => JSON.stringify(value);

/**
 * The source of `custom/locales/<lang>.ts`: every string of consify and of the features, with the
 * text the site has today as the value (the built-in translation when there is one, else English),
 * to be translated.
 */
export function renderLocaleTemplate(config: Readonly<DocsConfig>, lang: string): string {
  const builtin = builtinLocales[lang];
  const own = (strings: Record<string, string> | undefined, key: string) => strings?.[key];

  const groups: {
    title: string;
    english: Record<string, string>;
    current?: Record<string, string>;
  }[] = [
    {
      title: "@consify/core",
      english: builtinLocales.en?.messages ?? {},
      ...(builtin?.messages ? { current: builtin.messages } : {}),
    },
    ...config.features.flatMap((feature) =>
      feature.messages?.en
        ? [
            {
              title: feature.id,
              english: feature.messages.en,
              ...(feature.messages[lang] ? { current: feature.messages[lang] } : {}),
            },
          ]
        : [],
    ),
    ...config.mdx.plugins.flatMap((plugin) =>
      plugin.messages?.en
        ? [
            {
              title: `plugin ${plugin.name}`,
              english: plugin.messages.en,
              ...(plugin.messages[lang] ? { current: plugin.messages[lang] } : {}),
            },
          ]
        : [],
    ),
  ];

  const messages = groups
    .map((group) => {
      const lines = Object.entries(group.english).map(
        ([key, value]) => `    ${key}: ${string(own(group.current, key) ?? value)},`,
      );
      return `    // ${group.title}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const ui = (uiTranslations().keys as readonly string[])
    .filter((key) => key !== "displayName")
    .map((key) => {
      const current = (builtin?.ui as Record<string, string> | undefined)?.[key];
      return `    ${string(key)}: ${string(current ?? englishUi(key))},`;
    })
    .join("\n");

  return `import { defineLocale } from "@consify/core";

/**
 * The strings of the interface in ${lang}. The values are the current text (English until
 * translated). Delete a line to keep the built-in text. \`i18n.messages\` in docs.config.ts wins
 * over this file.
 */
export default defineLocale({
  // the name of the language in the language switcher
  label: ${string(builtin?.label ?? nativeName(lang))},

  messages: {
${messages}
  },

  // the widgets of Fumadocs: sidebar, search, table of contents, theme switcher
  ui: {
${ui}
  },
});
`;
}

/**
 * The languages of the site that have no strings: no built-in pack and no file in
 * `custom/locales`. Their interface is in English.
 */
export function missingLocales(config: Readonly<DocsConfig>, cwd: string): string[] {
  return config.i18n.languages.filter(
    (lang) =>
      builtinLocales[lang] === undefined &&
      !["ts", "js", "json"].some((ext) =>
        existsSync(join(cwd, "custom/locales", `${lang}.${ext}`)),
      ),
  );
}

const warned = new Set<string>();

/** Prints, once per language, that the interface is not translated and how to do it. */
export function warnMissingLocales(config: Readonly<DocsConfig>, cwd: string): void {
  for (const lang of missingLocales(config, cwd)) {
    if (warned.has(lang)) continue;
    warned.add(lang);
    console.warn(
      `[consify] "${lang}" has no strings for the interface (404 page, footer, buttons): it is shown in English. ` +
        `Run \`consify locale ${lang}\` to make custom/locales/${lang}.ts and translate it.`,
    );
  }
}
