import type { Config } from "@react-router/dev/config";
import type { DocsConfig } from "../../config/index.ts";
import { warnMissingLocales } from "../../locales/template.ts";
import { prerenderPaths } from "./prerender.ts";
import { appDirectory, scaffold } from "./scaffold.ts";

/**
 * Default export of the project's `react-router.config.ts` (imported from
 * `@consify/core/react-router`). It generates the app files in `.consify/`, warns about missing
 * language packs and tells React Router what to pre-render.
 *
 * `server` mode renders on demand and pre-renders every page too. `static` mode is a single-page
 * app pre-rendered to plain files for any static host.
 *
 * @example
 * // react-router.config.ts
 * import { defineRouterConfig } from "@consify/core/react-router";
 * import config from "./docs.config.ts";
 *
 * export default defineRouterConfig(config);
 */
export function defineRouterConfig(docsConfig: Readonly<DocsConfig>): Config {
  scaffold(process.cwd());
  warnMissingLocales(docsConfig, process.cwd());
  const { mode, basePath } = docsConfig.deploy;
  return {
    appDirectory,
    ssr: mode !== "static",
    ...(basePath ? { basename: basePath } : {}),
    prerender: () => prerenderPaths(docsConfig),
  };
}
