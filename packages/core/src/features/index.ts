import type { Feature, FeatureConfig } from "../shared/feature.ts";
import { apiReference } from "./api-reference/feature.ts";
import { blog } from "./blog/feature.ts";
import { docs } from "./docs/feature.ts";
import { home } from "./home/feature.ts";

/**
 * The sections of the site: pages with their own content that a project can switch on and off.
 * Listed in the order of their links in the top navigation. To add one, create its folder with a
 * `feature.ts` and list it here (and in `prerender.ts` / `sitemap.ts` if it has pages to
 * pre-render or to list in the sitemap). What every site needs regardless of the config lives in
 * `system/`.
 */
export const features: readonly Feature[] = [home, docs, apiReference, blog];

/** Features that are on for this config. */
export function enabledFeatures(config: FeatureConfig): Feature[] {
  return features.filter((feature) => feature.enabled?.(config) ?? true);
}
