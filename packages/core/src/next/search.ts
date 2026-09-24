import { createFromSource } from "fumadocs-core/search/server";
import type { Docsivi } from "../instance.ts";

/**
 * Route handler for `app/api/search/route.ts`. Static mode pre-renders the whole index
 * (`staticGET`), server mode answers queries.
 */
export function createSearchRoute({ config, source }: Docsivi) {
  const server = createFromSource(source);
  return { GET: config.deploy.mode === "static" ? server.staticGET : server.GET };
}
