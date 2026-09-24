import type { DocsConfig } from "./config/index.ts";
import { defaultDocsPath } from "./versions.ts";

/**
 * Turns a link written in `docs.config.ts` into a URL of the current language:
 * `/docs` opens the default version, `/x` becomes `/{lang}/x`, absolute URLs and anchors are kept.
 */
export function resolveHref(config: Readonly<DocsConfig>, lang: string, href: string): string {
  if (href === "/docs") return defaultDocsPath(config, lang) ?? `/${lang}/docs`;
  if (href.startsWith("/") && !href.startsWith("//")) return `/${lang}${href}`;
  return href;
}
