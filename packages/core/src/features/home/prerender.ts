import type { PrerenderPaths } from "../../shared/feature.ts";
import { hasCustomHome, homeFiles } from "./scan.ts";

/**
 * `/{lang}` is pre-rendered when there is something to show: a home component, `content/home.mdx`
 * or the `home` block. Otherwise it redirects to the docs: on a server that stays a real HTTP
 * redirect, so it is left out; a static site has no server, so the page that redirects is built.
 */
export const homePrerender: PrerenderPaths = (config, cwd) => {
  const hasHome =
    config.slots?.home !== undefined ||
    config.home !== undefined ||
    hasCustomHome(cwd) ||
    homeFiles(cwd, config.i18n.languages).length > 0;
  if (!hasHome && config.deploy.mode !== "static") return [];
  return config.i18n.languages.map((lang) => `/${lang}`);
};
