import type { DocsConfig } from "../config/index.ts";
import { linkCatalog } from "./catalog.ts";

/** An address on another site: `https://…` or `//…`. */
export const isExternalUrl = (url: string) => /^(?:https?:)?\/\//.test(url);

/**
 * Turns a link written in `docs.config.ts` into a URL of the current language: the id of a place a
 * feature offers (`blog`, `blog:rss`) becomes its address, `/x` becomes `/{lang}/x` (`/ru/x` is
 * kept), absolute URLs and anchors are kept.
 */
export function resolveHref(config: Readonly<DocsConfig>, lang: string, href: string): string {
  const place = linkCatalog(config, lang).find((found) => found.id === href);
  if (place) return place.url;
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  // an address that already names a language is left as it is
  const first = href.split(/[/?#]/)[1] ?? "";
  return config.i18n.languages.includes(first) ? href : `/${lang}${href}`;
}
