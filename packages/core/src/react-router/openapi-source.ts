import { isAbsolute, resolve } from "node:path";
import { defineI18n } from "fumadocs-core/i18n";
import { loader } from "fumadocs-core/source";
import type { DocsConfig } from "../config/index.ts";

/** Loaded lazily and only on the server: `fumadocs-openapi/server` must never reach the browser. */
let cached: ReturnType<typeof build> | undefined;

async function build(config: Readonly<DocsConfig>, cwd: string) {
  const { createOpenAPI } = await import("fumadocs-openapi/server");
  const inputs = [config.openapi?.input ?? []].flat();
  const openapi = createOpenAPI({
    input: inputs.map((input) =>
      /^https?:\/\//.test(input) || isAbsolute(input) ? input : resolve(cwd, input),
    ),
  });
  const i18n = defineI18n({
    defaultLanguage: config.i18n.defaultLanguage,
    languages: config.i18n.languages,
  });
  return loader(
    { openapi: await openapi.staticSource({ baseDir: "" }) },
    { baseUrl: "/api", i18n, plugins: [openapi.loaderPlugin()] },
  );
}

/** The pages of the API reference, one per operation and language. Cached for the process. */
export function getApiSource(config: Readonly<DocsConfig>, cwd: string = process.cwd()) {
  cached ??= build(config, cwd);
  return cached;
}

/** URLs of all API reference pages, for pre-rendering and the sitemap. */
export async function apiPageUrls(config: Readonly<DocsConfig>, cwd?: string): Promise<string[]> {
  if (!config.openapi) return [];
  const source = await getApiSource(config, cwd);
  return source.getPages().map((page) => page.url);
}
