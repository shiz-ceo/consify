import type { DocsConfig } from "../config/index.ts";

type Version = DocsConfig["versions"]["list"][number];

/** The configured version a docs path belongs to (first URL segment after `/docs`), if any. */
export function versionFromSlug(
  config: Readonly<DocsConfig>,
  slug: readonly string[] | undefined,
): Version | undefined {
  const id = slug?.[0];
  return id === undefined ? undefined : config.versions.list.find((v) => v.id === id);
}

/** Where `/docs` (no version) should go, or `undefined` when the site is not versioned. */
export function defaultDocsPath(config: Readonly<DocsConfig>, lang: string): string | undefined {
  const id = config.versions.default;
  return id === undefined ? undefined : `/${lang}/docs/${id}`;
}

/** Set when a page belongs to a deprecated version. `latest` is the version to point readers to. */
export function deprecationOf(
  config: Readonly<DocsConfig>,
  slug: readonly string[] | undefined,
): { version: Version; latest: Version | undefined } | undefined {
  const version = versionFromSlug(config, slug);
  if (version?.status !== "deprecated") return undefined;
  const latest =
    config.versions.list.find((v) => v.id === config.versions.default) ??
    config.versions.list.find((v) => v.status === "latest");
  return { version, latest };
}
