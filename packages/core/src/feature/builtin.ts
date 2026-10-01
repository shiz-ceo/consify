import { home } from "../builtin/home.ts";
import type { DocsConfig } from "../config/index.ts";
import type { Feature } from "./types.ts";

/**
 * Every feature of the site: the built-in front page (unless a feature of the project takes `/{lang}`),
 * then `features` of the config in their order.
 */
export function allFeatures(config: Readonly<DocsConfig>): readonly Feature[] {
  const ownFrontPage = config.features.some((feature) => feature.path === "");
  return ownFrontPage ? config.features : [home, ...config.features];
}
