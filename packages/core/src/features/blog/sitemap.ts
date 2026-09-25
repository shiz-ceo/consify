import { blog } from "docsivi:blog";
import { docsivi } from "../../shared/router.ts";

export async function blogSitemap(): Promise<string[]> {
  const { config } = docsivi;
  if (!config.blog || !blog) return [];
  const paths: string[] = [];
  for (const lang of config.i18n.languages) {
    paths.push(`/${lang}/blog`);
    // a post shown without a translation is a copy of the original: only real translations
    const exact = config.i18n.fallback !== "show";
    for (const post of await blog.posts(lang, { exact })) paths.push(`/${lang}/blog/${post.slug}`);
  }
  return paths;
}
