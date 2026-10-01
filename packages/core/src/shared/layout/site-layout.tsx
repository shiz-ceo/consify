import type * as PageTree from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import type { Consify } from "../instance.ts";
import { Footer } from "./footer.tsx";
import { docsLayoutOptions } from "./layout-options.tsx";
import { SidebarState } from "./sidebar-state.tsx";

const noPages: PageTree.Root = { name: "", children: [] };

/**
 * Every page that is not the docs (home, blog, the API reference, your own features). It is the
 * docs layout without a page tree, so the header (logo, search, links, language, theme) and the
 * footer are the very same components on every page of the site.
 *
 * A feature has exactly one choice: `sidebar`, whether the header shows the button that hides a
 * panel the page renders itself (the API reference: Scalar's sidebar). The footer is always there;
 * a feature never renders it and never sees a variant of it. To react to the button, read
 * `useSidebarCollapsed()` from `@consify/core/ui` inside the page, or select on
 * `[data-consify-sidebar-collapsed]` in CSS — never the internals of the docs layout.
 */
export function SitePage({
  consify,
  lang,
  sidebar = false,
  page,
  children,
}: {
  consify: Consify;
  lang: string;
  /** Whether this page has a panel of its own that the header can hide. */
  sidebar?: boolean;
  /** The feature this page belongs to. */
  page?: string;
  children: ReactNode;
}) {
  return (
    <>
      <DocsLayout
        {...docsLayoutOptions(consify, lang, page, sidebar)}
        tree={noPages}
        sidebar={{ collapsible: sidebar }}
        containerProps={{ "data-site-layout": "" } as Record<string, string>}
      >
        <SidebarState track={sidebar}>{children}</SidebarState>
      </DocsLayout>
      <Footer consify={consify} lang={lang} />
    </>
  );
}
