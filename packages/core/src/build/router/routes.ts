import { fileURLToPath } from "node:url";
import { index, type RouteConfig, route } from "@react-router/dev/routes";
import { features } from "../../features/index.ts";

/** `defineRouterConfig` sets this before the routes are read. */
const isStatic = process.env.DOCSIVI_DEPLOY_MODE === "static";

/**
 * The routes of every feature. Route modules live in this package, so a project never has to copy
 * them. The routes are registered even for a feature that is off (its pages answer with a 404),
 * because the router reads them before the config is known. React Router ranks the routes itself.
 */
export default features.flatMap((feature) =>
  feature.routes({ isStatic }).map((spec) => {
    const file = fileURLToPath(new URL(spec.file, feature.dir));
    return spec.index ? index(file) : route(spec.path as string, file);
  }),
) satisfies RouteConfig;
