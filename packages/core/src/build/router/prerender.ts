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

/**
 * A file of a static site that its pre-render leaves empty and `consify build` writes afterwards:
 * the search index of a language. The pre-render gives a file 10 s, too little to index a large site.
 */
export const isDeferredFile = (url: string): boolean => url.endsWith("/search.json");

/** The URLs of the deferred files of a static site (see {@link isDeferredFile}). */
export async function deferredPaths(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
): Promise<string[]> {
  if (config.deploy.mode !== "static") return [];
  const addresses = await siteAddresses(config, cwd);
  return [
    ...new Set(
      addresses
        .filter((address) => address.kind === "file" && isDeferredFile(address.url))
        .map((address) => address.url),
    ),
  ];
}
