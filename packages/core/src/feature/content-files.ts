import type { Feature } from "./types.ts";

/** A file core serves for the content of a feature. */
export type ContentFileKind = "search" | "llms" | "llms-full" | "og" | "rss";

/**
 * The files core adds to a feature with content, by address: its search index, `llms.txt`, the
 * social images of its entries (`/og/v2/guide.png`) and its feed.
 */
export function contentFiles(feature: Pick<Feature, "content">): Record<string, ContentFileKind> {
  const content = feature.content;
  if (!content) return {};
  return {
    ...(content.search === false ? {} : { "/search.json": "search" as const }),
    ...(content.llms
      ? { "/llms.txt": "llms" as const, "/llms-full.txt": "llms-full" as const }
      : {}),
    ...(content.og ? { "/og/*": "og" as const } : {}),
    ...(content.rss ? { "/rss.xml": "rss" as const } : {}),
  };
}

/** The social image of an entry: `/en/docs/og/v2/guide.png`, `…/og/index.png` for `index.mdx`. */
export function ogImagePath(featureUrl: string, slug: string): string {
  return `${featureUrl}/og/${slug || "index"}.png`;
}
