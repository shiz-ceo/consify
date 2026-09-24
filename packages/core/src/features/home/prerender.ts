import type { PrerenderPaths } from "../../shared/feature.ts";

export const homePrerender: PrerenderPaths = (config) =>
  config.i18n.languages.map((lang) => `/${lang}`);
