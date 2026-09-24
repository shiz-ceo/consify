import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { CSSProperties, ReactNode } from "react";
import type { Docsivi } from "./instance.ts";
import { docsLayoutOptions } from "./layout-options.tsx";

const noPages: PageTree.Root = { name: "", children: [] };

// The notebook layout reserves a sidebar column, pages without a sidebar take it back.
const withoutSidebar = {
  "--fd-sidebar-width": "0px",
  "--fd-sidebar-col": "0px",
} as CSSProperties;

/**
 * Home, API and 404 pages. It is the docs layout without a sidebar, so the header (logo, search,
 * links, language, theme) is the very same component on every page of the site.
 */
export function SiteLayout({
  docsivi,
  lang,
  children,
}: {
  docsivi: Docsivi;
  lang: string;
  children: ReactNode;
}) {
  return (
    <DocsLayout
      {...docsLayoutOptions(docsivi, lang)}
      tree={noPages}
      sidebar={{ collapsible: false, className: "hidden" }}
      containerProps={{ style: withoutSidebar }}
    >
      <div className="flex min-w-0 flex-col [grid-area:main]">{children}</div>
    </DocsLayout>
  );
}
