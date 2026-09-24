import type { PrerenderPaths } from "../shared/feature.ts";
import { searchPrerender } from "./search/prerender.ts";
import { seoPrerender } from "./seo/prerender.ts";
import { sitePrerender } from "./site/prerender.ts";

/** What the system parts add to the pre-render list. */
export const systemPrerenderers: readonly PrerenderPaths[] = [
  sitePrerender,
  searchPrerender,
  seoPrerender,
];
