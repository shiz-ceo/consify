import type { FeatureSearch } from "../feature/types.ts";
import type { Consify } from "./instance.ts";

/** The search of a page: the one of the feature it belongs to (`handle.page` of its route). */
export function pageSearch(consify: Consify, page: string | undefined): FeatureSearch | undefined {
  return page === undefined ? undefined : consify.searches[page];
}

/** Whether the pages of this feature have a search. */
export function hasSearch(consify: Consify, page: string | undefined): boolean {
  return pageSearch(consify, page) !== undefined;
}
