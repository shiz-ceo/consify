import { uiTranslations } from "fumadocs-ui/i18n";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/notebook";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { localeLabel, localeUi } from "../../locales/registry.ts";
import type { Consify } from "../instance.ts";
import { headerItems, isMenu, type ResolvedLink } from "../nav.ts";
import { hasSearch } from "../search.ts";
import type { LayoutLink } from "../slots.ts";
import { SearchField } from "../ui/search-field.tsx";
import { SocialIcon } from "./social-icons.tsx";

/**
 * The translations of the Fumadocs widgets and the names of the languages for the switcher: the
 * strings of the language packs (`ui`, `label`), `i18n.labels` first for the names.
 */
export function createTranslations({ config, i18n }: Consify) {
  const names = Object.fromEntries(
    config.i18n.languages.map((code) => [
      code,
      { ...localeUi(config, code), displayName: localeLabel(config, code) },
    ]),
  );
  return i18n.translations().extend(uiTranslations()).add(names);
}

/** The text of a drop-down item: the title, and under it a few words about the place. */
function MenuText({ title, description }: { title: string; description?: string | undefined }) {
  return (
    <span className="flex max-w-64 flex-col items-start gap-0.5">
      <span className="font-medium text-fd-foreground">{title}</span>
      {description ? <span className="text-xs leading-snug">{description}</span> : null}
    </span>
  );
}

function toLayoutLink(link: ResolvedLink): LayoutLink {
  return {
    text: link.title,
    url: link.url,
    external: link.external,
    ...(link.description ? { description: link.description } : {}),
  };
}

/** The links of the header: `header.links`, else the main place of every feature. */
export function headerLinks({ config }: Consify, lang: string): LayoutLink[] {
  return headerItems(config, lang).map((item): LayoutLink => {
    if (!isMenu(item)) return toLayoutLink(item);
    const items = item.items.map(toLayoutLink);
    return {
      text: item.title,
      url: items[0]?.url ?? `/${lang}`,
      external: false,
      ...(item.description ? { description: item.description } : {}),
      items,
    };
  });
}

/**
 * The header is the one of Fumadocs with two places for the project: `Header` replaces the links in
 * the middle (the mobile menu keeps the default links, so navigation never disappears) and
 * `HeaderEnd` adds to the right side. The name of the site on the left and the controls (search,
 * language, theme, the sidebar button of the API page) are always there.
 */
export function baseOptions(consify: Consify, lang: string): BaseLayoutProps {
  const { config, slots } = consify;
  const github = config.site.github;
  const links = headerLinks(consify, lang);
  const slotProps = { consify, lang, links };
  const where = slots.Header ? { on: "menu" as const } : {};
  const main = links.map((link) =>
    link.items
      ? {
          type: "menu" as const,
          text: link.text,
          items: link.items.map((item) => ({
            text: <MenuText title={item.text} description={item.description} />,
            ...(item.description ? { description: item.description } : {}),
            url: item.url,
            ...(item.external ? { external: true } : {}),
          })),
          ...where,
        }
      : {
          type: "main" as const,
          text: link.text,
          url: link.url,
          ...(link.external ? { external: true } : {}),
          ...where,
        },
  );

  return {
    nav: { title: config.site.name, url: `/${lang}` },
    // the search is a field in the sidebar (`SearchField`), not part of the header
    slots: { searchTrigger: false as const },
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
      // the link to the repository: an icon with a name for screen readers (the icon of Fumadocs has none)
      ...(github
        ? [
            {
              type: "icon" as const,
              label: "GitHub",
              text: "GitHub",
              url: `https://github.com/${github.repo}`,
              external: true,
              icon: <SocialIcon type="github" />,
              secondary: true,
            },
          ]
        : []),
    ],
  };
}

/**
 * Options for the docs layout. The navigation is a bar on top of the page, the same as on the home
 * and API pages, so the header does not change when a reader moves between them. `withSidebar` is
 * for a page that has a sidebar of its own: the search is a field at the top of it.
 */
export function docsLayoutOptions(
  consify: Consify,
  lang: string,
  page?: string,
  withSidebar = false,
): Omit<DocsLayoutProps, "tree" | "children"> {
  const options = baseOptions(consify, lang);
  const search =
    withSidebar && hasSearch(consify, page) ? { sidebar: { banner: <SearchField /> } } : {};
  return { ...options, nav: { ...options.nav, mode: "top" as const }, ...search };
}
