import { apiPrerender } from "./api-reference/prerender.ts";
import { blogPrerender } from "./blog/prerender.ts";
import { docsPrerender } from "./docs/prerender.ts";
import { homePrerender } from "./home/prerender.ts";
import { searchPrerender } from "./search/prerender.ts";
import { seoPrerender } from "./seo/prerender.ts";
import { sitePrerender } from "./site/prerender.ts";
import type { PrerenderPaths } from "./types.ts";

/** What each feature adds to the pre-render list (Node, build time). */
export const prerenderers: readonly PrerenderPaths[] = [
  sitePrerender,
  homePrerender,
  docsPrerender,
  apiPrerender,
  blogPrerender,
  searchPrerender,
  seoPrerender,
];
