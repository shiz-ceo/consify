import { useId, useRef } from "react";
import { type Card, cardFor, previewKey } from "../../content/preview-card.ts";
import type { Previews } from "../../content/previews.ts";
import { HoverBox, useHoverCard } from "./hover-card.tsx";

// the cards of a site: loaded once, when the first link asks for them
const loaded = new Map<string, Promise<Previews | null>>();

function load(src: string): Promise<Previews | null> {
  let previews = loaded.get(src);
  if (!previews) {
    previews = fetch(src)
      .then((response) => (response.ok ? (response.json() as Promise<Previews>) : null))
      .catch(() => null);
    loaded.set(src, previews);
    // a failed load is tried again at the next link
    previews.then((value) => value ?? loaded.delete(src));
  }
  return previews;
}

/** A link in the text of a page that may have a card: not a heading anchor, a tile, a download or another site's. */
function linkOf(target: Element): HTMLAnchorElement | null {
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link || !link.closest("[data-link-previews]")) return null;
  if (link.hasAttribute("download") || link.target === "_blank") return null;
  if (link.closest("h1, h2, h3, h4, h5, h6, [data-card], [data-no-preview]")) return null;
  return link;
}

/**
 * The card of a link in the text of a page (inside `[data-link-previews]`): when the pointer is over
 * a link to another page of the site, or to a heading of it, a card says what is there. `src` is
 * the file of the cards of the feature, `base` the `basePath` of the site. A link to anything else
 * has no card.
 */
export function LinkPreviews({ src, base }: { src: string; base: string }) {
  const id = useId();
  const options = useRef({ src, base });
  options.current = { src, base };

  const shown = useHoverCard<Card>({
    pick: (target) => {
      const link = linkOf(target);
      if (!link) return null;
      const here = { origin: location.origin, pathname: location.pathname };
      const key = previewKey(link.href, here, options.current.base);
      if (!key) return null;
      return load(options.current.src).then((previews) => {
        const card =
          previews && cardFor(previews, key, here.pathname.replace(options.current.base, ""));
        return card ? { anchor: link, data: card } : null;
      });
    },
    openDelay: 350,
    closeDelay: 100,
    toggleOnClick: false,
    describedBy: id,
  });
  if (!shown) return null;
  const { title, text, page } = shown.data;
  return (
    <HoverBox anchor={shown.anchor} className="consify-link-preview" role="tooltip" id={id}>
      <p className="consify-link-preview-title">{title}</p>
      {text ? <p className="consify-link-preview-text">{text}</p> : null}
      {page ? <p className="consify-link-preview-page">{page}</p> : null}
    </HoverBox>
  );
}
