/// <reference path="../build/router/instance.d.ts" />
import { consify } from "consify:instance";
import type { MetaDescriptor } from "react-router";

export { consify };

export const isStatic = consify.config.deploy.mode === "static";

/** The language from the URL, or a 404 for anything that is not a configured language. */
export function requireLang(params: Record<string, string | undefined>): string {
  const lang = params.lang;
  if (!lang || !consify.config.i18n.languages.includes(lang)) {
    throw new Response("Not found", { status: 404 });
  }
  return lang;
}

/** Absolute URL when `site.url` is set, otherwise the path itself. */
export function absoluteUrl(path: string): string {
  const { url } = consify.config.site;
  const base = consify.config.deploy.basePath ?? "";
  return url ? new URL(`${base}${path}`, url).toString() : path;
}

export interface PageMeta {
  lang: string;
  title: string;
  description?: string | undefined;
  /** Path of the page, e.g. `/en/docs/v2/quickstart`. */
  path: string;
  /** Language → path, for hreflang links. */
  alternates?: Record<string, string> | undefined;
  /** Path of the OG image. */
  image?: string | undefined;
}

/** `<title>`, description, canonical, hreflang, Open Graph and Twitter tags for a page. */
export function buildMeta(page: PageMeta): MetaDescriptor[] {
  const meta: MetaDescriptor[] = [
    { title: page.title },
    { property: "og:title", content: page.title },
    { property: "og:site_name", content: consify.config.site.name },
    { tagName: "link", rel: "canonical", href: absoluteUrl(page.path) },
  ];
  if (page.description) {
    meta.push(
      { name: "description", content: page.description },
      { property: "og:description", content: page.description },
    );
  }
  for (const [lang, path] of Object.entries(page.alternates ?? {})) {
    meta.push({ tagName: "link", rel: "alternate", hrefLang: lang, href: absoluteUrl(path) });
  }
  if (page.image) {
    meta.push(
      { property: "og:image", content: absoluteUrl(page.image) },
      { name: "twitter:card", content: "summary_large_image" },
    );
  }
  return meta;
}
