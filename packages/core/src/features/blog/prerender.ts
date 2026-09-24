import type { PrerenderPaths } from "../types.ts";
import { publishedFiles, scanPosts } from "./scan.ts";

/** Only published posts: a draft has no page, so it cannot be built by accident. */
export const blogPrerender: PrerenderPaths = (config, cwd) => {
  if (!config.blog) return [];
  const { languages } = config.i18n;
  const slugs = new Set(publishedFiles(scanPosts(cwd, languages)).map((p) => p.slug));
  const paths: string[] = [];
  for (const lang of languages) {
    paths.push(`/${lang}/blog`);
    if (config.blog.rss) paths.push(`/${lang}/blog/rss.xml`);
    for (const slug of slugs) paths.push(`/${lang}/blog/${slug}`, `/${lang}/blog/${slug}/og.png`);
  }
  return paths;
};
