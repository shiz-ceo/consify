import type { Feature } from "../../shared/feature.ts";
import { getMessages } from "../../shared/messages.ts";
import { localized } from "./labels.ts";

export const blog: Feature = {
  id: "blog",
  dir: import.meta.url,
  enabled: (config) => config.blog !== undefined,
  routes: () => [
    { path: ":lang/blog", file: "routes/blog" },
    {
      path: ":lang/blog/rss.xml",
      file: "routes/blog-feed",
      when: (config) => config.blog?.rss === true,
    },
    { path: ":lang/blog/:slug/og.png", file: "routes/blog-og" },
    { path: ":lang/blog/*", file: "routes/blog-post" },
  ],
  nav: (config, lang) =>
    config.blog
      ? {
          text: localized(config, lang, config.blog.title) ?? getMessages(config, lang).blog,
          url: `/${lang}/blog`,
        }
      : undefined,
};
