import type { DocsConfig } from "../config/index.ts";
import type { LinkOption } from "../feature/types.ts";
import { linkCatalog } from "./catalog.ts";
import { isExternalUrl, resolveHref } from "./links.ts";
import { localized } from "./localized.ts";

/** A text or one text per language. */
export type Text = string | Readonly<Record<string, string>>;

/** A link the site chose: a place of a feature (by id, with its title and description replaceable) or an address. */
export type LeafLinkItem =
  | string
  | { id: string; title?: Text | undefined; description?: Text | undefined }
  | { title: Text; description?: Text | undefined; url: string; external?: boolean | undefined };

/** A drop-down menu of links (the header only). */
export interface MenuLinkItem {
  title: Text;
  description?: Text | undefined;
  items: readonly LeafLinkItem[];
}

export type LinkItem = LeafLinkItem | MenuLinkItem;

export interface ResolvedLink {
  title: string;
  description?: string;
  url: string;
  external: boolean;
}

export interface ResolvedMenu {
  title: string;
  description?: string;
  items: ResolvedLink[];
}

export type ResolvedItem = ResolvedLink | ResolvedMenu;

export function isMenu(item: ResolvedItem): item is ResolvedMenu {
  return "items" in item;
}

function option(config: Readonly<DocsConfig>, lang: string, id: string): LinkOption {
  const catalog = linkCatalog(config, lang);
  const found = catalog.find((candidate) => candidate.id === id);
  if (!found) {
    throw new Error(
      `consify: unknown link "${id}" (available: ${catalog.map((o) => o.id).join(", ") || "none"})`,
    );
  }
  return found;
}

/** One link of a header or a footer, ready to render. */
export function resolveLeaf(
  config: Readonly<DocsConfig>,
  lang: string,
  item: LeafLinkItem,
): ResolvedLink {
  if (typeof item === "string") {
    const found = option(config, lang, item);
    return {
      title: found.title,
      ...(found.description ? { description: found.description } : {}),
      url: found.url,
      external: found.external ?? false,
    };
  }
  if ("id" in item) {
    const found = option(config, lang, item.id);
    const title = localized(config, lang, item.title) ?? found.title;
    const description = localized(config, lang, item.description) ?? found.description;
    return {
      title,
      ...(description ? { description } : {}),
      url: found.url,
      external: found.external ?? false,
    };
  }
  const description = localized(config, lang, item.description);
  return {
    title: localized(config, lang, item.title) ?? item.url,
    ...(description ? { description } : {}),
    url: resolveHref(config, lang, item.url),
    external: item.external ?? isExternalUrl(item.url),
  };
}

/** The links the site chose, resolved for a language. */
export function resolveItems(
  config: Readonly<DocsConfig>,
  lang: string,
  items: readonly LinkItem[],
): ResolvedItem[] {
  return items.map((item): ResolvedItem => {
    if (typeof item === "object" && "items" in item) {
      const description = localized(config, lang, item.description);
      return {
        title: localized(config, lang, item.title) ?? "",
        ...(description ? { description } : {}),
        items: item.items.map((leaf) => resolveLeaf(config, lang, leaf)),
      };
    }
    return resolveLeaf(config, lang, item);
  });
}

/** What the top navigation shows: the links from `header.links`, else the main place of every feature. */
export function headerItems(config: Readonly<DocsConfig>, lang: string): ResolvedItem[] {
  if (config.header?.links) return resolveItems(config, lang, config.header.links);
  return linkCatalog(config, lang)
    .filter((found) => found.primary)
    .map((found) => resolveLeaf(config, lang, found.id));
}
