import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A card that opens when the pointer is over (or the keyboard is on) something in the text of a page:
// the popup of a Twoslash hover, the card of a link. The things are many and the card is one, so
// there is one card, one set of listeners on the document, and nothing per thing.

/** What the card is for: the element it opens next to, and what it shows. */
export interface HoverTarget<T> {
  anchor: HTMLElement;
  data: T;
}

export interface HoverCardOptions<T> {
  /**
   * The thing under an event target, or `null`. It may be a promise (a card whose data is still on
   * its way): the card opens when the data is there and the pointer has not left.
   */
  pick(target: Element): HoverTarget<T> | null | Promise<HoverTarget<T> | null>;
  openDelay: number;
  closeDelay: number;
  /** A click on the anchor opens or closes the card (a button); otherwise it closes it (a link). */
  toggleOnClick: boolean;
  /** For a link: the id of the card, `aria-describedby` of the anchor while it is open. */
  describedBy?: string;
}

/** The card (its box) marks itself, so the pointer on it is not "away from the anchor". */
export const hoverCardAttribute = "data-hover-card";

const insideCard = (target: EventTarget | null) =>
  !!(target as Element | null)?.closest?.(`[${hoverCardAttribute}]`);

/**
 * What is open now (`null` for nothing). Opens after `openDelay` on pointer hover, at once on
 * focus, closes `closeDelay` after leaving the anchor and the card, on Escape, on the scroll of the
 * page (not of the card) and on a click outside. A touch does not hover.
 */
export function useHoverCard<T>(options: HoverCardOptions<T>): HoverTarget<T> | null {
  const [shown, setShown] = useState<HoverTarget<T> | null>(null);
  const latest = useRef(options);
  latest.current = options;

  useEffect(() => {
    let openTimer: number | undefined;
    let closeTimer: number | undefined;
    let current: HTMLElement | null = null;
    // every hover has its number: a card that comes late is dropped when the pointer has moved on
    let hovering = 0;

    const mark = (anchor: HTMLElement, open: boolean) => {
      const { describedBy } = latest.current;
      if (describedBy) {
        if (open) anchor.setAttribute("aria-describedby", describedBy);
        else anchor.removeAttribute("aria-describedby");
      } else anchor.setAttribute("aria-expanded", String(open));
    };
    const close = () => {
      hovering++;
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
      if (current) mark(current, false);
      current = null;
      setShown(null);
    };
    const open = (target: HoverTarget<T>) => {
      window.clearTimeout(closeTimer);
      if (current === target.anchor) return;
      if (current) mark(current, false);
      current = target.anchor;
      mark(target.anchor, true);
      setShown(target);
    };
    const later = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(close, latest.current.closeDelay);
    };
    /** Opens what is under `target`: now or after the delay. */
    const show = (target: EventTarget | null, delay: number) => {
      const found = (target as Element | null)?.closest
        ? latest.current.pick(target as Element)
        : null;
      if (!found) return;
      const number = ++hovering;
      Promise.resolve(found).then((picked) => {
        if (!picked || number !== hovering) return;
        window.clearTimeout(closeTimer);
        // once a card is open, the next one is shown without the delay
        if (current || delay === 0) open(picked);
        else openTimer = window.setTimeout(() => open(picked), delay);
      });
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (insideCard(event.target)) return window.clearTimeout(closeTimer);
      show(event.target, latest.current.openDelay);
    };
    const onOut = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      hovering++;
      window.clearTimeout(openTimer);
      if (current) later();
    };
    const onFocus = (event: FocusEvent) => show(event.target, 0);
    const onBlur = (event: FocusEvent) => {
      if (current && !insideCard(event.relatedTarget)) later();
    };
    const onClick = (event: MouseEvent) => {
      const clicked = (event.target as Element | null)?.closest?.("a, button");
      if (insideCard(event.target)) return;
      if (latest.current.toggleOnClick && clicked && clicked === current) return close();
      if (latest.current.toggleOnClick && clicked) return show(event.target, 0);
      close();
    };
    // the page scrolling closes the card, the card scrolling (a long one) does not
    const onScroll = (event: Event) => {
      if (!insideCard(event.target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", close);
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, []);

  return shown;
}

export interface HoverBoxProps {
  anchor: HTMLElement;
  className: string;
  role: string;
  id?: string;
  /** What the card says as HTML made at build time, or as elements. */
  html?: string;
  children?: ReactNode;
  /** Opens above the anchor when there is room (below by default). */
  prefer?: "above" | "below";
  /** Tells the side and where the anchor is (`data-side`, `--hover-arrow-x`) for an arrow in CSS. */
  arrow?: boolean;
}

/**
 * The card: under the anchor, in the middle of it; above it when there is no room below, and
 * inside the window. It is measured before it is shown, so it does not jump.
 */
export function HoverBox({
  anchor,
  className,
  role,
  id,
  html,
  children,
  prefer = "below",
  arrow = false,
}: HoverBoxProps) {
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{
    top: number;
    left: number;
    side: "above" | "below";
    arrowX: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!box.current) return;
    const at = anchor.getBoundingClientRect();
    const { width, height } = box.current.getBoundingClientRect();
    const gap = arrow ? 10 : 4;
    const roomBelow = window.innerHeight - at.bottom - gap;
    const roomAbove = at.top - gap;
    const above =
      prefer === "above"
        ? roomAbove >= height || roomAbove > roomBelow
        : roomBelow < height && roomAbove > roomBelow;
    const top = above ? at.top - height - gap : at.bottom + gap;
    const left = Math.min(
      Math.max(8, at.left + at.width / 2 - width / 2),
      Math.max(8, window.innerWidth - width - 8),
    );
    // the arrow points at the middle of the anchor, but stays inside the rounded corners of the card
    const arrowX = Math.min(Math.max(14, at.left + at.width / 2 - left), Math.max(14, width - 14));
    setPlace({ top, left, side: above ? "above" : "below", arrowX });
  }, [anchor, html, children, prefer, arrow]);

  const props = {
    ref: box,
    role,
    id,
    className,
    "data-open": "",
    [hoverCardAttribute]: "",
    ...(arrow && place ? { "data-side": place.side } : {}),
    style: {
      position: "fixed" as const,
      top: place?.top ?? 0,
      left: place?.left ?? 0,
      zIndex: 50,
      visibility: place ? ("visible" as const) : ("hidden" as const),
      ...(arrow && place ? { "--hover-arrow-x": `${place.arrowX}px` } : {}),
    },
  };
  return createPortal(
    html === undefined ? (
      <div {...props}>{children}</div>
    ) : (
      // the popup is HTML made at build time from the highlighted code of the page itself
      <div {...props} dangerouslySetInnerHTML={{ __html: html }} />
    ),
    document.body,
  );
}
