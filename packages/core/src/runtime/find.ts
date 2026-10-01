import type { Feature, FileRoute, Page, PageMeta } from "../feature/types.ts";
import type { Consify } from "../shared/instance.ts";

/** A page of a feature, as the generated route modules name it. */
export function findPage(
  consify: Consify,
  id: string,
  key: string,
): { feature: Feature; page: Page } {
  const feature = consify.feature(id);
  const page = feature.pages[key];
  if (!page) throw new Error(`consify: feature "${id}" has no page "${key}"`);
  return { feature, page };
}

/** A file of a feature, as the generated route modules name it. */
export function findFile(
  consify: Consify,
  id: string,
  key: string,
): { feature: Feature; file: FileRoute } {
  const feature = consify.feature(id);
  const file = feature.files[key];
  if (!file) throw new Error(`consify: feature "${id}" has no file "${key}"`);
  return { feature, file };
}

/** The parameters of a page without the language. */
export function pageParams(
  params: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const own: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    if (name === "lang" || value === undefined) continue;
    // `/en/docs/v1/guide/` is the page `v1/guide`
    own[name] = name === "*" ? value.replace(/^\/+|\/+$/g, "") : value;
  }
  return own;
}

/** What the loader of a page sends to its component: the data, and the `<head>` of an entry. */
export type PageData =
  | {
      lang: string;
      data: unknown;
      meta?: PageMeta | undefined;
      /** The language of the text when it is not the one of the address (a page not translated). */
      contentLanguage?: string | undefined;
      redirectTo?: undefined;
    }
  | { lang: string; redirectTo: string };
