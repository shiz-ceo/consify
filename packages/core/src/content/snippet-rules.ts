// The snippets of a feature, for `docs.config.ts`: no Node, no Markdown here (the main entry of the
// package is read by the browser bundles too). The expansion is in mdx/snippets.ts, the checks in
// content/snippets.ts.

/** The folder of the snippets of a page that has no version: `snippets/WITHOUT_VERSION/`. */
export const withoutVersion = "WITHOUT_VERSION";

/** Where the snippets of a feature are, and which version a page of it has. */
export interface SnippetsConfig {
  /** The folder of the snippets, from the project folder: `snippets`. */
  dir: string;
  /** The version of the page at `path` (inside the folder of the feature): `v1`, `""` when it has none. */
  version(path: string): string;
  /** The versions of the feature: the names a folder of `dir` may have, besides `WITHOUT_VERSION`. */
  versions: readonly string[];
}

/** What `snippets` of `docs()` says: `true` for the folder `snippets`. */
export type SnippetsOptions = boolean | { dir?: string | undefined };

/** The folder of the snippets of a `SnippetsOptions` (`undefined` when they are off). */
export function snippetsDir(options: SnippetsOptions | undefined): string | undefined {
  if (!options) return undefined;
  const dir = options === true ? undefined : options.dir;
  return (dir ?? "snippets").replace(/^\.\//, "").replace(/\/+$/, "") || "snippets";
}

/** The folders of snippets of the features of a site, once each. */
export function snippetDirs(config: {
  readonly features: readonly { content?: { snippets?: SnippetsConfig | undefined } | undefined }[];
}): string[] {
  const dirs = config.features.flatMap((feature) => feature.content?.snippets?.dir ?? []);
  return [...new Set(dirs)];
}
