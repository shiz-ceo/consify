import { apiReference } from "./api-reference/feature.ts";
import { blog } from "./blog/feature.ts";
import { docs } from "./docs/feature.ts";
import { home } from "./home/feature.ts";
import { search } from "./search/feature.ts";
import { seo } from "./seo/feature.ts";
import { site } from "./site/feature.ts";
import type { Feature, FeatureConfig } from "./types.ts";

/**
 * Every feature, in the order of their links in the top navigation. To add a feature, create its
 * folder with a `feature.ts` and list it here (and in `prerender.ts` / `sitemap.ts` if it has
 * pages to pre-render or to list in the sitemap).
 */
export const features: readonly Feature[] = [site, home, docs, apiReference, blog, search, seo];

/** Features that are on for this config. */
export function enabledFeatures(config: FeatureConfig): Feature[] {
  return features.filter((feature) => feature.enabled?.(config) ?? true);
}
