import type { PrerenderPaths } from "../shared/feature.ts";
import { apiPrerender } from "./api-reference/prerender.ts";
import { blogPrerender } from "./blog/prerender.ts";
import { docsPrerender } from "./docs/prerender.ts";
import { homePrerender } from "./home/prerender.ts";

/** What each feature adds to the pre-render list (Node, build time). */
export const featurePrerenderers: readonly PrerenderPaths[] = [
  homePrerender,
  docsPrerender,
  apiPrerender,
  blogPrerender,
];
