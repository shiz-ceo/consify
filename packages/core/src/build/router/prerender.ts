import type { DocsConfig } from "../../config/index.ts";
import { siteAddresses } from "../../feature/addresses.ts";

/**
 * Every URL to pre-render. A server keeps its redirects real HTTP redirects, so there only pages
 * and files are built; a static site has no server, so its redirects are pages too (and `/`).
 */
export async function prerenderPaths(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
): Promise<string[]> {
  const isStatic = config.deploy.mode === "static";
  const addresses = await siteAddresses(config, cwd);
  const urls = addresses
    .filter((address) => isStatic || address.kind !== "redirect")
    .map((address) => address.url);
  return [...new Set([...(isStatic ? ["/"] : []), ...urls, "/sitemap.xml", "/robots.txt"])];
}
