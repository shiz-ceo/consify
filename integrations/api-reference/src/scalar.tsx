import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import "./scalar.css";
import { SearchField, useSidebarCollapsed } from "@consify/core/ui";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** The Scalar API reference: operations, models and the API client, in one page. Browser only. */
export default function ScalarReference({
  source,
}: {
  source: { url: string } | { content: string };
}) {
  const { resolvedTheme } = useTheme();
  useSlideContentWithSidebar();
  const searchHost = useSearchHost();
  return (
    <>
      {createPortal(<SearchField />, searchHost)}
      <ApiReferenceReact
        // Scalar reads the theme once, so it is created again when the site theme changes
        key={resolvedTheme}
        configuration={{
          ...source,
          // follow the site theme, the toggle inside Scalar would fight with it
          forceDarkModeState: resolvedTheme === "dark" ? "dark" : "light",
          hideDarkModeToggle: true,
          // every group of operations is open in the content, the reader can still close it
          defaultOpenAllTags: true,
          // no Scalar cloud buttons (Configure, Share, Deploy)
          showDeveloperTools: "never",
          // no Ask AI and no "Generate MCP" (Scalar cloud features)
          agent: { disabled: true },
          mcp: { disabled: true },
          withDefaultFonts: false,
        }}
      />
    </>
  );
}

/**
 * The element at the top of Scalar's sidebar that holds the search field of the site. Scalar draws
 * its sidebar itself (and draws it again when the theme changes), so the element is put back
 * whenever the sidebar appears.
 */
function useSearchHost(): HTMLElement {
  const [host] = useState(() => {
    const element = document.createElement("div");
    element.className = "consify-scalar-search";
    return element;
  });
  useEffect(() => {
    const attach = () => {
      const sidebar = document.querySelector(".scalar-app .t-doc__sidebar");
      if (sidebar && host.parentElement !== sidebar) sidebar.prepend(host);
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      host.remove();
    };
  }, [host]);
  return host;
}

/**
 * When the header button hides or shows Scalar's sidebar the layout changes at once, and this
 * slides the content from where it was to where it is now (a FLIP animation on `transform`, which
 * does not re-layout the page on every frame). The sidebar itself is animated in `scalar.css`.
 * `useSidebarCollapsed` is the shared, documented way to know this — not a detail of the docs
 * layout this component would otherwise have to reach into.
 */
function useSlideContentWithSidebar() {
  const collapsed = useSidebarCollapsed();
  const previous = useRef(collapsed);

  useEffect(() => {
    const changed = previous.current !== collapsed;
    previous.current = collapsed;
    if (!changed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const app = document.querySelector<HTMLElement>(".scalar-app");
    const sidebar = app?.querySelector(".t-doc__sidebar");
    if (!app || !sidebar) return;
    const width =
      Number.parseFloat(getComputedStyle(app).getPropertyValue("--refs-sidebar-width")) || 268;
    const content = [...app.children]
      .filter((child): child is HTMLElement => child !== sidebar && child instanceof HTMLElement)
      .sort((a, b) => b.offsetWidth - a.offsetWidth)[0];

    // hiding moves the content left by the width of the sidebar, showing moves it right
    content?.animate(
      [
        { transform: `translateX(${collapsed ? width : -width}px)` },
        { transform: "translateX(0)" },
      ],
      { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
    );
  }, [collapsed]);
}
