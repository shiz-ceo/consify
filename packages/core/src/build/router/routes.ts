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
    const file = fileURLToPath(new URL(spec.file, feature.dir));
    return spec.index ? index(file) : route(spec.path as string, file);
  }),
) satisfies RouteConfig;
