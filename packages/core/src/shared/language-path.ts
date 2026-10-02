/**
 * The address of the same page in another language, with its search and hash. The path has no
 * trailing slash: a static host adds one (`facets/`) after a full load, and a page with it asks for
 * `facets/_.data`, a file the build does not have, so a switch ended on "page not found" until a reload.
 */
export function languagePath(
  location: { pathname: string; search: string; hash: string },
  to: string,
  languages: readonly string[],
): string {
  const [, first = "", ...rest] = location.pathname.split("/");
  const path = (languages.includes(first) ? rest : [first, ...rest]).join("/").replace(/\/+$/, "");
  return `/${to}${path ? `/${path}` : ""}${location.search}${location.hash}`;
}
