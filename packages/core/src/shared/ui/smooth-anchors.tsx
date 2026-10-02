import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * Smooth scrolling to a heading when a link to it on the same page is clicked: a heading anchor, a
 * link of the table of contents.
 *
 * The router makes the jump, as it does for any change of the address. A click that the browser
 * handles on its own (`<a href="#id">`) is a navigation for the router too, and it puts the page back
 * where it was saved, which stops a smooth scroll before it starts: the heading was reached by the
 * second click. So the click goes to the router, which then scrolls to the heading itself. The page
 * is asked to scroll smoothly only for that moment, not always: `scroll-behavior: smooth` on the
 * page would also slow down every scroll that other code makes. People who asked for less motion get
 * the plain jump.
 */
export function SmoothAnchors() {
  const navigate = useNavigate();

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;

    const calm = () => {
      window.clearTimeout(timer);
      document.documentElement.style.removeProperty("scroll-behavior");
    };
    const onClick = (event: MouseEvent) => {
      if (motion.matches || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
      if (!link || !link.hash || link.target === "_blank" || link.hasAttribute("download")) return;
      // a link to a heading of this page, not to another page
      if (link.origin !== location.origin || link.pathname !== location.pathname) return;
      let target: HTMLElement | null = null;
      try {
        target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      } catch {
        return;
      }
      if (!target) return;

      event.preventDefault();
      document.documentElement.style.setProperty("scroll-behavior", "smooth");
      window.clearTimeout(timer);
      timer = window.setTimeout(calm, 1200);
      window.addEventListener("scrollend", calm, { once: true });
      // the same address with the heading: the router scrolls to it once it has rendered
      navigate({ hash: link.hash });
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scrollend", calm);
      calm();
    };
  }, [navigate]);

  return null;
}
