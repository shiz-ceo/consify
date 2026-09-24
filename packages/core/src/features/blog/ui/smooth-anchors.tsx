"use client";

import { useEffect } from "react";

/**
 * Scrolls smoothly to a heading when an in-page link (the table of contents) is clicked. It is
 * done per click instead of `scroll-behavior: smooth` on the page, which would also slow down the
 * scrolling that other code triggers, such as the table of contents following the reader.
 */
export function SmoothAnchors() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href^='#']");
      const id = link?.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (!link || !target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", `#${id}`);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
