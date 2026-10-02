// The rules of the registry of anchors, for `docs.config.ts`: no Node, no Markdown here (the main entry
// of the package is read by the browser bundles too). The checks themselves are in anchors.ts.

/** How strict a rule is: `error` stops the build, `warn` is printed, `off` is not checked. */
export type AnchorLevel = "error" | "warn" | "off";

/** What the registry of a feature checks. */
export interface AnchorsConfig {
  /**
   * The folder (inside the content folder of the feature) whose `anchors.json` holds the ids of the page
   * at `path`: the folder of its version, `""` when there are no versions.
   */
  scope(path: string): string;
  /** A heading with no id of its own that cannot be told by a plain English id. */
  missing: AnchorLevel;
  /** An id that is not in the registry, is not a lowercase English word, or is used twice on a page. */
  unknown: AnchorLevel;
  /** An id of the registry that no page of the original language has. */
  unused: AnchorLevel;
  /** An id of the registry that a translation does not have. */
  translated: AnchorLevel;
  /** A link to an id that is not in the registry. */
  links: AnchorLevel;
}

/** What `anchors` of a feature (or of `docs()`) says; every rule has a default. */
export type AnchorsOptions =
  | boolean
  | { [Rule in keyof Omit<AnchorsConfig, "scope">]?: AnchorLevel | undefined };

/** The rules of an `AnchorsOptions` (`false` for no registry). */
export function anchorRules(
  options: AnchorsOptions | undefined,
): Omit<AnchorsConfig, "scope"> | undefined {
  if (!options) return undefined;
  const own = options === true ? {} : options;
  return {
    missing: own.missing ?? "error",
    unknown: own.unknown ?? "error",
    unused: own.unused ?? "warn",
    translated: own.translated ?? "warn",
    links: own.links ?? "error",
  };
}

/**
 * An id the registry accepts: lowercase English words and digits, joined by `-` or `.` (`quick-start`,
 * `model.find`: the dot is for the name of a method).
 */
export const validId = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
