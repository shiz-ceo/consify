import { apiSitemap } from "./api-reference/sitemap.ts";
import { blogSitemap } from "./blog/sitemap.ts";
import { docsSitemap } from "./docs/sitemap.ts";

/** What each feature adds to `sitemap.xml` (runs on the server, has the loaded content). */
export const sitemapSources: readonly (() => string[] | Promise<string[]>)[] = [
  docsSitemap,
  apiSitemap,
  blogSitemap,
];
