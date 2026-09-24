import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import "./scalar.css";
import { useTheme } from "next-themes";
import { useEffect } from "react";

/** The Scalar API reference: operations, models and the API client, in one page. Browser only. */
export default function ScalarReference({
  source,
}: {
  source: { url: string } | { content: string };
}) {
  const { resolvedTheme } = useTheme();
  useSlideContentWithSidebar();
  return (
    <ApiReferenceReact
      // Scalar reads the theme once, so it is created again when the site theme changes
      key={resolvedTheme}
      configuration={{
        ...source,
        // follow the site theme, the toggle inside Scalar would fight with it
        forceDarkModeState: resolvedTheme === "dark" ? "dark" : "light",
        hideDarkModeToggle: true,
        // Scalar's own search is replaced by the one in the header, so its hotkey (also Cmd+K)
        // must not fight with ours
        searchHotKey: "j",
        // no Scalar cloud buttons (Configure, Share, Deploy)
        showDeveloperTools: "never",
        // no Ask AI and no "Generate MCP" (Scalar cloud features)
        agent: { disabled: true },
        mcp: { disabled: true },
        withDefaultFonts: false,
      }}
    />
  );
}

/**
 * When the header button hides or shows Scalar's sidebar the layout changes at once, and this
 * slides the content from where it was to where it is now (a FLIP animation on `transform`, which
 * does not re-layout the page on every frame). The sidebar itself is animated in `scalar.css`.
 */
function useSlideContentWithSidebar() {
  useEffect(() => {
    const layout = document.querySelector("#nd-notebook-layout");
    if (!layout || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let collapsed = layout.getAttribute("data-sidebar-collapsed") === "true";
    const observer = new MutationObserver(() => {
      const next = layout.getAttribute("data-sidebar-collapsed") === "true";
      if (next === collapsed) return;
      collapsed = next;

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
        [{ transform: `translateX(${next ? width : -width}px)` }, { transform: "translateX(0)" }],
        { duration: 250, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
    });
    observer.observe(layout, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
    return () => observer.disconnect();
  }, []);
}
