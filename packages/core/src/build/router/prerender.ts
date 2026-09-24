import type { DocsConfig } from "../../config/index.ts";
import { prerenderers } from "../../features/prerender.ts";

export { collectSlugs } from "../../features/docs/slugs.ts";

/**
 * Every URL to pre-render: the union of what each feature asks for (see `features/prerender.ts`).
 */
export function prerenderPaths(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
): string[] {
  return [...new Set(prerenderers.flatMap((paths) => paths(config, cwd)))];
}
