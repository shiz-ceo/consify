import { docsivi } from "../../shared/router.ts";

/** Every docs page. */
export function docsSitemap(): string[] {
  return docsivi.source.getPages().map((page) => page.url);
}
