import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const openDelay = 200;
const closeDelay = 100;

interface Shown {
  anchor: HTMLElement;
  html: string;
}

/**
 * The popups of the Twoslash hovers of a page (`<button data-tw="3">` in its code blocks), one list
 * of HTML. Only one popup is shown at a time, so there is one element for it, not one for each
 * hover. It opens after a short delay on pointer hover, at once on focus or a tap, and closes on
 * leaving, on Escape, and on a click outside.
 */
export function TwoslashPopups({ data }: { data: string }) {
  const popups = useMemo(() => data.split("\u0001"), [data]);
  const [shown, setShown] = useState<Shown | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    let openTimer: number | undefined;
    let closeTimer: number | undefined;
    let current: HTMLElement | null = null;
    const hover = (target: EventTarget | null) =>
      (target as Element | null)?.closest?.<HTMLElement>("button[data-tw]") ?? null;
    const inside = (target: EventTarget | null) =>
      !!(target as Element | null)?.closest?.(".fd-twoslash-popover");

    const close = () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
      current?.setAttribute("aria-expanded", "false");
      current = null;
      setShown(null);
      setPlace(null);
    };
    const open = (anchor: HTMLElement) => {
      window.clearTimeout(closeTimer);
      if (current === anchor) return;
      current?.setAttribute("aria-expanded", "false");
      current = anchor;
      anchor.setAttribute("aria-expanded", "true");
      setPlace(null);
      setShown({ anchor, html: popups[Number(anchor.dataset.tw)] ?? "" });
    };
    const later = () => {
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(close, closeDelay);
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (inside(event.target)) return window.clearTimeout(closeTimer);
      const anchor = hover(event.target);
      if (!anchor) return;
      window.clearTimeout(closeTimer);
      // once a popup is open, the next one is shown without the delay
      if (current) open(anchor);
      else openTimer = window.setTimeout(() => open(anchor), openDelay);
    };
    const onOut = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (!hover(event.target) && !inside(event.target)) return;
      window.clearTimeout(openTimer);
      if (current) later();
    };
    const onFocus = (event: FocusEvent) => {
      const anchor = hover(event.target);
      if (anchor) open(anchor);
    };
    const onBlur = (event: FocusEvent) => {
      if (hover(event.target) && !inside(event.relatedTarget)) later();
    };
    const onClick = (event: MouseEvent) => {
      const anchor = hover(event.target);
      if (anchor) return current === anchor ? close() : open(anchor);
      if (!inside(event.target)) close();
    };
    // the page scrolling closes the popup, the popup scrolling (a long type) does not
    const onScroll = (event: Event) => {
      if (!inside(event.target)) close();
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
  }, [popups]);

  // under the hover, in the middle of it; above it when there is no room below, inside the window
  useLayoutEffect(() => {
    if (!shown || !box.current) return;
    const anchor = shown.anchor.getBoundingClientRect();
    const { width, height } = box.current.getBoundingClientRect();
    const below = anchor.bottom + 4;
    const top =
      below + height > window.innerHeight && anchor.top > height + 8
        ? anchor.top - height - 4
        : below;
    const left = Math.min(
      Math.max(8, anchor.left + anchor.width / 2 - width / 2),
      Math.max(8, window.innerWidth - width - 8),
    );
    setPlace({ top, left });
  }, [shown]);

  if (!shown) return null;
  return createPortal(
    <div
      ref={box}
      role="dialog"
      className="fd-twoslash-popover"
      data-open=""
      style={{
        position: "fixed",
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        zIndex: 50,
        visibility: place ? "visible" : "hidden",
      }}
      // the popup is HTML made at build time from the highlighted code of the page itself
      dangerouslySetInnerHTML={{ __html: shown.html }}
    />,
    document.body,
  );
}
