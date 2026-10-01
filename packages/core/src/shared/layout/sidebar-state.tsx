import { useSidebar } from "fumadocs-ui/layouts/notebook/slots/sidebar";
import type { ReactNode } from "react";

/**
 * Whether the reader collapsed the sidebar of the page (the button `SitePage`'s `sidebar` option
 * adds to the header). A feature with a panel of its own (the API reference: Scalar's sidebar) uses
 * this to fold it in sync, instead of reaching into the DOM of the docs layout.
 */
export function useSidebarCollapsed(): boolean {
  return useSidebar().collapsed;
}

/** A CSS attribute a feature can select on instead of the React hook, e.g. in a plain stylesheet. */
export const sidebarCollapsedAttribute = "data-consify-sidebar-collapsed";

/** Puts `data-consify-sidebar-collapsed` on a wrapper around the page's content, kept in sync. */
export function SidebarState({ track, children }: { track: boolean; children: ReactNode }) {
  const collapsed = useSidebarCollapsed();
  return (
    <div
      className="flex min-w-0 flex-col [grid-area:main]"
      {...(track ? { [sidebarCollapsedAttribute]: collapsed ? "true" : "false" } : {})}
    >
      {children}
    </div>
  );
}
