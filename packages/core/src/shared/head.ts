import type { DocsConfig } from "../config/index.ts";
import { type Head, headSchema } from "../config/schema.ts";

const empty: Head = { meta: [], links: [], scripts: [] };

/** The `head` of the config for a language: the object, or what the function gives for it, checked. */
export function resolveHead(config: Readonly<DocsConfig>, lang: string): Head {
  const { head } = config;
  if (head === undefined) return empty;
  return typeof head === "function" ? headSchema.parse(head(lang)) : (head as Head);
}
