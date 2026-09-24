import { defineConfig } from "fumadocs-mdx/config";
import type { DocsConfig } from "./config/index.ts";
import { createMdxOptions } from "./mdx/options.ts";

/**
 * Default export of the project's `source.config.ts`: global Fumadocs MDX options derived from
 * `docs.config.ts`.
 *
 * @example
 * import config from "./docs.config";
 * export default createSourceConfig(config);
 */
export function createSourceConfig(config: Readonly<DocsConfig>) {
  return defineConfig({ mdxOptions: createMdxOptions(config) });
}
