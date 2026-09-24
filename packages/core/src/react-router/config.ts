import type { Config } from "@react-router/dev/config";
import type { DocsConfig } from "../config/index.ts";
import { prerenderPaths } from "./prerender.ts";
import { appDirectory, scaffold } from "./scaffold.ts";

/**
 * Default export of the project's `react-router.config.ts`.
 *
 * `server` mode renders on demand and pre-renders every page too. `static` mode is a single-page
 * app pre-rendered to plain files for any static host.
 */
export function defineRouterConfig(docsConfig: Readonly<DocsConfig>): Config {
  scaffold();
  const { mode, basePath } = docsConfig.deploy;
  // read by `routes.ts`, which is evaluated after this config
  process.env.DOCSIVI_DEPLOY_MODE = mode;
  return {
    appDirectory,
    ssr: mode !== "static",
    ...(basePath ? { basename: basePath } : {}),
    prerender: () => prerenderPaths(docsConfig),
  };
}
