// What the card of a link says: the address the link goes to, and the text for it. No React here, so
// the rules can be tested; `LinkPreviews` draws it.
import type { PagePreview, Previews } from "./previews.ts";

/** The entry a link goes to (its address without the `basePath` and the slash at the end) and the heading. */
export interface PreviewKey {
  path: string;
  hash: string;
}

/**
 * Where `href` goes, if it is a page of this site: `{ path: "/en/docs/guide", hash: "setup" }`.
 * `null` for another site, a file, a mail address and anything else that is not an address of a page.
 */
export function previewKey(
  href: string,
  at: { origin: string; pathname: string },
  basePath: string,
): PreviewKey | null {
  let url: URL;
  try {
    url = new URL(href, `${at.origin}${at.pathname}`);
  } catch {
    return null;
  }
  if (url.origin !== at.origin || (url.protocol !== "http:" && url.protocol !== "https:"))
    return null;
  let path: string;
  let hash: string;
  try {
    path = decodeURIComponent(url.pathname);
    hash = decodeURIComponent(url.hash.slice(1));
  } catch {
    return null;
  }
  if (basePath) {
    if (path !== basePath && !path.startsWith(`${basePath}/`)) return null;
    path = path.slice(basePath.length);
  }
  return { path: path.replace(/\/+$/, "") || "/", hash };
}

/** What the card shows: a title, a text under it, and the page the text is from (for a heading). */
export interface Card {
  title: string;
  text: string;
  page: string;
}

/**
 * The card for a link to `key`, or `null` when there is nothing to say: the address is not an
 * entry, or the link goes to the page it is on.
 */
export function cardFor(previews: Previews, key: PreviewKey, here: string): Card | null {
  const page: PagePreview | undefined = previews[key.path];
  if (!page) return null;
  const section = key.hash ? page.s?.[key.hash] : undefined;
  if (section?.[0]) return { title: section[0], text: section[1], page: page.t };
  // a link to the page it is on, without a heading, has nothing new to show
  if (key.path === here.replace(/\/+$/, "")) return null;
  return page.t ? { title: page.t, text: page.d ?? "", page: "" } : null;
}
