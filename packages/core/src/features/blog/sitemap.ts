import { blog } from "docsivi:blog";
import { docsivi } from "../../shared/router.ts";

export async function blogSitemap(): Promise<string[]> {
  const { config } = docsivi;
  if (!config.blog || !blog) return [];
  const paths: string[] = [];
  for (const lang of config.i18n.languages) {
    paths.push(`/${lang}/blog`);
    for (const post of await blog.posts(lang)) paths.push(`/${lang}/blog/${post.slug}`);
  }
  return paths;
}
