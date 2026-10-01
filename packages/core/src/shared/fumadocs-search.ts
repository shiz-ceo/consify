// The site search of a feature whose search API is Fumadocs' own. A module of its own
// (`@consify/core/search`): it pulls in the React search hooks of Fumadocs.
import { useDocsSearch } from "fumadocs-core/search/client";
import { fetchClient } from "fumadocs-core/search/client/fetch";
import { staticClient } from "fumadocs-core/search/client/orama-static";
import type { FeatureSearch, SearchContext, SearchState } from "../feature/types.ts";

const asItems = (data: unknown): SearchState["items"] =>
  data === "empty" || data === undefined ? null : (data as SearchState["items"]);

/** A path of the site under its base path (Vite's `BASE_URL`), as the browser has to ask for it. */
function withBase(path: string): string {
  const base = typeof import.meta.env?.BASE_URL === "string" ? import.meta.env.BASE_URL : "/";
  return `${base.replace(/\/$/, "")}${path}`;
}

/**
 * The search of a feature backed by a Fumadocs search API (`createSearchAPI` / `createFromSource` of
 * `fumadocs-core/search/server`, served as a file of the feature). On a server the search asks the
 * API; on a static site the API is pre-rendered to one file, the exported Orama index, which the
 * browser downloads and searches itself.
 *
 * @example
 * search: createFumadocsSearch((lang) => `/${lang}/notes/search.json`),
 */
export function createFumadocsSearch(url: (lang: string) => string): FeatureSearch {
  function useServerSearch({ lang }: SearchContext): SearchState {
    const { search, setSearch, query } = useDocsSearch({
      client: fetchClient({ api: withBase(url(lang)), locale: lang }),
    });
    return { search, setSearch, isLoading: query.isLoading, items: asItems(query.data) };
  }

  function useStaticSearch({ lang }: SearchContext): SearchState {
    const { search, setSearch, query } = useDocsSearch({
      client: staticClient({ from: withBase(url(lang)), locale: lang }),
    });
    return { search, setSearch, isLoading: query.isLoading, items: asItems(query.data) };
  }

  return {
    // the deploy mode does not change while the site runs, so the hook is the same on every render
    useSearch: (context) =>
      context.isStatic ? useStaticSearch(context) : useServerSearch(context),
  };
}
