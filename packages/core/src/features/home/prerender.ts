import type { PrerenderPaths } from "../types.ts";

export const homePrerender: PrerenderPaths = (config) =>
  config.i18n.languages.map((lang) => `/${lang}`);
