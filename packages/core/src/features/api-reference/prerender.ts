import type { PrerenderPaths } from "../types.ts";

/** The API reference (Scalar) is one page per language. */
export const apiPrerender: PrerenderPaths = (config) =>
  config.openapi ? config.i18n.languages.map((lang) => `/${lang}/api`) : [];
