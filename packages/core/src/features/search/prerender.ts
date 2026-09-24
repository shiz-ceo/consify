import type { PrerenderPaths } from "../types.ts";

/** In static mode the search index is a file that the browser downloads and searches itself. */
export const searchPrerender: PrerenderPaths = (config) =>
  config.deploy.mode === "static" ? ["/api/search"] : [];
