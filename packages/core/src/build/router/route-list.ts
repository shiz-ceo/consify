import { hasPublishedPosts } from "../../features/blog/scan.ts";
import { features } from "../../features/index.ts";
import type { FeatureConfig } from "../../shared/feature.ts";
import { routeKey } from "../../shared/feature.ts";
import { system } from "../../system/index.ts";

/**
 * Routes that need something on disk to have any page. A static site cannot have a route with a
 * loader that nothing is pre-rendered for, so a blog without a published post has no post pages.
 */
function needsContent(featureId: string, file: string, config: FeatureConfig, cwd: string): boolean {
  if (featureId === "blog" && (file === "routes/blog-post" || file === "routes/blog-og")) {
    return config.blog !== undefined && hasPublishedPosts(cwd, config.i18n.languages);
  }
  return true;
}

/** Keys of the routes that exist for a config. `routes.ts` reads them from `CONSIFY_ROUTES`. */
export function enabledRouteKeys(config: FeatureConfig, cwd: string = process.cwd()): string[] {
  return [...system, ...features].flatMap((feature) => {
    if (feature.enabled && !feature.enabled(config)) return [];
    return feature
      .routes({ isStatic: config.deploy.mode === "static" })
      .filter((spec) => spec.when?.(config) ?? true)
      .filter((spec) => needsContent(feature.id, spec.file, config, cwd))
      .map((spec) => routeKey(feature, spec));
  });
}
