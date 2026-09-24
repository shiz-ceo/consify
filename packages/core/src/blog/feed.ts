import type { BlogPost } from "./posts.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface FeedOptions {
  title: string;
  description: string;
  language: string;
  /** Absolute URL of the blog page. */
  link: string;
  /** Absolute URL of the feed itself. */
  self: string;
  /** Absolute URL of a post. */
  postUrl: (post: BlogPost) => string;
  /** Category id → label. */
  categoryLabels?: Readonly<Record<string, string>>;
}

/** An RSS 2.0 feed of the posts (already sorted, newest first). */
export function buildRss(posts: readonly BlogPost[], options: FeedOptions): string {
  const items = posts.map((post) => {
    const url = escape(options.postUrl(post));
    const categories = [
      ...post.categories.map((c) => options.categoryLabels?.[c] ?? c),
      ...post.tags,
    ];
    return [
      "    <item>",
      `      <title>${escape(post.title)}</title>`,
      `      <link>${url}</link>`,
      `      <guid isPermaLink="true">${url}</guid>`,
      `      <pubDate>${new Date(post.date).toUTCString()}</pubDate>`,
      `      <description>${escape(post.description)}</description>`,
      ...categories.map((c) => `      <category>${escape(c)}</category>`),
      "    </item>",
    ].join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(options.title)}</title>
    <link>${escape(options.link)}</link>
    <description>${escape(options.description)}</description>
    <language>${escape(options.language)}</language>
    <atom:link href="${escape(options.self)}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
}
