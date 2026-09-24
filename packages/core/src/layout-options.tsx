import { uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import type { Docsivi } from "./instance.ts";
import { getMessages } from "./messages.ts";
import { defaultDocsPath } from "./versions.ts";

/** Display names for the language switcher: config labels first, the language code as fallback. */
export function createTranslations({ config, i18n }: Docsivi) {
  const names = Object.fromEntries(
    config.i18n.languages.map((code) => [code, { displayName: config.i18n.labels[code] ?? code }]),
  );
  return i18n.translations().extend(uiTranslations()).add(names);
}

export function baseOptions({ config }: Docsivi, lang: string): BaseLayoutProps {
  const github = config.site.github;
  return {
    nav: { title: config.site.name, url: `/${lang}` },
    ...(github ? { githubUrl: `https://github.com/${github.repo}` } : {}),
    links: [
      {
        type: "main",
        text: getMessages(config, lang).documentation,
        url: defaultDocsPath(config, lang) ?? `/${lang}/docs`,
      },
      ...(config.openapi
        ? [{ type: "main" as const, text: config.openapi.title, url: `/${lang}/api` }]
        : []),
      ...config.nav.map((item) => ({
        type: "main" as const,
        text: item.title,
        url: item.url,
        ...(item.external ? { external: true } : {}),
      })),
    ],
  };
}
