import type { DocsConfig } from "../../config/index.ts";
import { featurePrerenderers } from "../../features/prerender.ts";
import { systemPrerenderers } from "../../system/prerender.ts";

export { collectSlugs } from "../../features/docs/slugs.ts";

/**
 * Every URL to pre-render: the union of what each feature asks for (see `system/prerender.ts` and `features/prerender.ts`).
 */
export function prerenderPaths(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
): string[] {
  return [...new Set([...systemPrerenderers, ...featurePrerenderers].flatMap((paths) => paths(config, cwd)))];
}
