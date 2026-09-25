import { uiTranslations } from "fumadocs-ui/i18n";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { enabledFeatures } from "../../features/index.ts";
import type { PageId } from "../feature.ts";
import type { Docsivi } from "../instance.ts";
import { resolveHref } from "../links.ts";
import type { LayoutLink } from "../slots.ts";

/** Display names for the language switcher: config labels first, the language code as fallback. */
export function createTranslations({ config, i18n }: Docsivi) {
  const names = Object.fromEntries(
    config.i18n.languages.map((code) => [code, { displayName: config.i18n.labels[code] ?? code }]),
  );
  return i18n.translations().extend(uiTranslations()).add(names);
}

/** The links of the header by default: the sections that are on, then `nav` from the config. */
export function headerLinks({ config }: Docsivi, lang: string): LayoutLink[] {
  return [
    ...enabledFeatures(config).flatMap((feature) => {
      const link = feature.nav?.(config, lang);
      return link ? [{ text: link.text, url: link.url, external: false }] : [];
    }),
    ...config.nav.map((item) => ({
      text: item.title,
      url: resolveHref(config, lang, item.url),
      external: item.external ?? false,
    })),
  ];
}

/**
 * The header is the one of Fumadocs with two places for the project: `Header` replaces the links in
 * the middle (the mobile menu keeps the default links, so navigation never disappears) and
 * `HeaderEnd` adds to the right side. The name of the site on the left and the controls (search,
 * language, theme, the sidebar button of the API page) are always there.
 */
export function baseOptions(docsivi: Docsivi, lang: string, page?: PageId): BaseLayoutProps {
  const { config, slots } = docsivi;
  const github = config.site.github;
  const links = headerLinks(docsivi, lang);
  const slotProps = { docsivi, lang, links };
  const main = links.map((link) => ({
    type: "main" as const,
    text: link.text,
    url: link.url,
    ...(link.external ? { external: true } : {}),
    ...(slots.Header ? { on: "menu" as const } : {}),
  }));

  return {
    nav: { title: config.site.name, url: `/${lang}` },
    // `header.hideSearchOn` in the config: sections whose pages have no search in the header
    ...(page && config.header?.hideSearchOn.includes(page)
      ? { searchToggle: { enabled: false } }
      : {}),
    ...(github ? { githubUrl: `https://github.com/${github.repo}` } : {}),
    links: [
      ...main,
      ...(slots.Header
        ? [
            {
              type: "custom" as const,
              on: "nav" as const,
              children: <slots.Header {...slotProps} />,
            },
          ]
        : []),
      ...(slots.HeaderEnd
        ? [
            {
              type: "custom" as const,
              on: "nav" as const,
              secondary: true,
              children: <slots.HeaderEnd {...slotProps} />,
            },
          ]
        : []),
    ],
  };
}

/**
 * Options for the docs layout. The navigation is a bar on top of the page, the same as on the home
 * and API pages, so the header does not change when a reader moves between them.
 */
export function docsLayoutOptions(docsivi: Docsivi, lang: string, page?: PageId) {
  const options = baseOptions(docsivi, lang, page);
  return { ...options, nav: { ...options.nav, mode: "top" as const } };
}
