import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import type { Docsivi } from "../instance.ts";
import { docsLayoutOptions } from "./layout-options.tsx";
import { SiteFooter } from "./site-footer.tsx";

const noPages: PageTree.Root = { name: "", children: [] };

/**
 * Home, API and 404 pages. It is the docs layout without a page tree, so the header (logo,
 * search, links, language, theme) is the very same component on every page of the site.
 *
 * The sidebar of the layout only holds the site links (Documentation, API, ...): it is the mobile
 * menu, and on tablets the narrow sidebar. On wide screens it is not shown (`theme.css`, the
 * `data-site-layout` rules). `sidebarToggle` adds the button in the header that hides a sidebar
 * the page renders itself (the API page: Scalar's sidebar).
 */
export function SiteLayout({
  docsivi,
  lang,
  sidebarToggle = false,
  footer = true,
  children,
}: {
  docsivi: Docsivi;
  lang: string;
  sidebarToggle?: boolean;
  /** Whether to show the footer. Off for the API page: Scalar has its own full-height layout. */
  footer?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <DocsLayout
        {...docsLayoutOptions(docsivi, lang)}
        tree={noPages}
        sidebar={{ collapsible: sidebarToggle }}
        containerProps={{ "data-site-layout": "" } as Record<string, string>}
      >
        <div className="flex min-w-0 flex-col [grid-area:main]">{children}</div>
      </DocsLayout>
      {footer ? <SiteFooter docsivi={docsivi} lang={lang} /> : null}
    </>
  );
}
