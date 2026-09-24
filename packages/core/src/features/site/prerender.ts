import type { PrerenderPaths } from "../types.ts";

/** In static mode `/` is a page that redirects to the language of the reader. */
export const sitePrerender: PrerenderPaths = (config) =>
  config.deploy.mode === "static" ? ["/"] : [];
