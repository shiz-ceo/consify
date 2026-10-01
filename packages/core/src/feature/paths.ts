// Addresses of features: the React Router pattern of a page and the URLs it has. No Node here.
import type { Feature, Params } from "./types.ts";

/** The React Router pattern of a page or a file: `:lang/<feature path>/<key>`, no leading `/`. */
export function routePattern(feature: Pick<Feature, "path">, key: string): string {
  return [":lang", feature.path, key.slice(1)].filter(Boolean).join("/");
}

/** The front page of a feature in a language: `/en/status`, `/en` for the front page of the site. */
export function featureUrl(feature: Pick<Feature, "path">, lang: string): string {
  return feature.path ? `/${lang}/${feature.path}` : `/${lang}`;
}

/** The segments of a path encoded one by one (`guides/my page` → `guides/my%20page`): the `/` stays. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** The parameters in a key: `["service"]` for `/:service`, `["*"]` for `/*`. */
export function keyParams(key: string): string[] {
  return key
    .split("/")
    .filter((segment) => segment.startsWith(":") || segment === "*")
    .map((segment) => (segment === "*" ? "*" : segment.slice(1).replace(/\?$/, "")));
}

/**
 * The URL of a page or a file with its parameters filled in: `/en/status/api`. An optional
 * parameter that is missing drops its segment; `*` may hold several segments.
 */
export function fillUrl(
  feature: Pick<Feature, "path">,
  key: string,
  lang: string,
  params: Params = {},
): string {
  const segments = key
    .slice(1)
    .split("/")
    .filter(Boolean)
    .flatMap((segment) => {
      if (segment === "*")
        return (params["*"] ?? "").split("/").filter(Boolean).map(encodeURIComponent);
      if (!segment.startsWith(":")) return [segment];
      const optional = segment.endsWith("?");
      const name = segment.slice(1, optional ? -1 : undefined);
      const value = params[name];
      if (value === undefined || value === "") {
        if (optional) return [];
        throw new Error(`the address ${key} needs the parameter "${name}"`);
      }
      return [encodeURIComponent(value)];
    });
  return [featureUrl(feature, lang), ...segments].join("/");
}
