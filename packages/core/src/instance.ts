import { defineI18n } from "fumadocs-core/i18n";
import type { MetaData, Source } from "fumadocs-core/source";
import { llms, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import type { TableOfContents } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import type { DocsConfig } from "./config/index.ts";

/** The page fields the docs layouts rely on (satisfied by Fumadocs MDX collections). */
export interface DocsPageData {
  title: string;
  description?: string | undefined;
  body: MDXContent;
  toc: TableOfContents;
  full?: boolean | undefined;
  /** Present when the collection sets `postprocess.includeProcessedMarkdown` (needed for llms.txt). */
  getText?: ((type: "raw" | "processed") => Promise<string>) | undefined;
}

/**
 * The collection returned by `defineDocs()` from `fumadocs-mdx/macro` (called in the project,
 * because the macro cannot be re-exported).
 */
export interface DocsCollection {
  toFumadocsSource(): Source<{ pageData: DocsPageData; metaData: MetaData }>;
}

/**
 * Builds everything the docs site needs at runtime from the validated config and the content
 * collection. The collection is created in the project (macros cannot be re-exported), the rest
 * lives here.
 */
export function createDocsivi(
  config: Readonly<DocsConfig>,
  docs: DocsCollection,
  /** Components discovered in `custom/components` (generated registry). */
  customComponents: Record<string, unknown> = {},
) {
  const i18n = defineI18n({
    defaultLanguage: config.i18n.defaultLanguage,
    languages: config.i18n.languages,
  });

  const source = loader({
    baseUrl: "/docs",
    source: docs.toFumadocsSource(),
    i18n,
    // `icon: "Rocket"` in frontmatter and meta.json (any Lucide icon name)
    plugins: [lucideIconsPlugin()],
  });

  const docsLlms = llms(source, {
    renderPage: async (page) =>
      `# ${page.data.title} (${page.url})\n\n${(await page.data.getText?.("processed")) ?? ""}`,
  });

  return { config, i18n, source, customComponents, docsLlms };
}

export type Docsivi = ReturnType<typeof createDocsivi>;
