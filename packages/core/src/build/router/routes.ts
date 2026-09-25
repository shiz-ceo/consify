import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { index, type RouteConfig, route } from "@react-router/dev/routes";
import { features } from "../../features/index.ts";
import { routeKey } from "../../shared/feature.ts";
import { system } from "../../system/index.ts";

/** The routes that exist for the config, set by `defineRouterConfig` (see `route-list.ts`). */
const enabled = process.env.CONSIFY_ROUTES
  ? new Set<string>(JSON.parse(process.env.CONSIFY_ROUTES))
  : undefined;

/** `defineRouterConfig` sets this before the routes are read. */
const isStatic = process.env.CONSIFY_DEPLOY_MODE === "static";

/**
 * The file of a route module. The specs name it without an extension, because the package ships as
 * TypeScript in the repository and as compiled JavaScript when it is installed.
 */
function resolveRouteFile(base: string): string {
  for (const extension of [".tsx", ".ts", ".jsx", ".js"]) {
    if (existsSync(base + extension)) return base + extension;
  }
  throw new Error(`consify: route module not found: ${base}`);
}

/**
 * The routes of the system parts and of every feature that is on. Route modules live in this
 * package, so a project never has to copy them. Routes of a feature that is off are left out (a
 * static site cannot have a route with a loader that nothing is pre-rendered for); their URLs
 * answer with the 404 page. React Router ranks the routes itself.
 */
export default [...system, ...features].flatMap((feature) =>
  feature
    .routes({ isStatic })
    .filter((spec) => enabled === undefined || enabled.has(routeKey(feature, spec)))
    .map((spec) => {
      const file = resolveRouteFile(fileURLToPath(new URL(spec.file, feature.dir)));
      return spec.index ? index(file) : route(spec.path as string, file);
  }),
) satisfies RouteConfig;
