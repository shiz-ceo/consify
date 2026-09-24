import type { MetadataRoute } from "next";
import type { Docsivi } from "../instance.ts";

/** Default export of `app/sitemap.ts`. Empty when `site.url` is not set (sitemaps need absolute URLs). */
export function createSitemap({ config, source }: Docsivi) {
  return function sitemap(): MetadataRoute.Sitemap {
    const origin = config.site.url;
    if (!origin) return [];
    return source.getPages().map((page) => ({ url: new URL(page.url, origin).toString() }));
  };
}

/** Default export of `app/robots.ts`. */
export function createRobots({ config }: Docsivi) {
  return function robots(): MetadataRoute.Robots {
    const origin = config.site.url;
    return {
      rules: { userAgent: "*", allow: "/" },
      ...(origin ? { sitemap: new URL("/sitemap.xml", origin).toString() } : {}),
    };
  };
}
