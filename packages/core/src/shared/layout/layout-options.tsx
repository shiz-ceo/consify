import { uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { enabledFeatures } from "../../features/index.ts";
import type { Docsivi } from "../instance.ts";
import { resolveHref } from "../links.ts";
import { getMessages } from "../messages.ts";
import { defaultDocsPath } from "../versions.ts";

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
      ...enabledFeatures(config).flatMap((feature) => {
        const link = feature.nav?.(config, lang);
        return link ? [{ type: "main" as const, ...link }] : [];
      }),
      ...config.nav.map((item) => ({
        type: "main" as const,
        text: item.title,
        url: resolveHref(config, lang, item.url),
        ...(item.external ? { external: true } : {}),
      })),
    ],
  };
}

/**
 * Options for the docs layout. The navigation is a bar on top of the page, the same as on the home
 * and API pages, so the header does not change when a reader moves between them.
 */
export function docsLayoutOptions(docsivi: Docsivi, lang: string) {
  const options = baseOptions(docsivi, lang);
  return { ...options, nav: { ...options.nav, mode: "top" as const } };
}
