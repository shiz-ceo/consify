// The posts as the pages use them, and the pure helpers over them: no imports of values, so the
// pages that run in the browser can take them without pulling in `index.ts` (zod, defineFeature).

/** A post as the blog pages use it. */
export interface BlogPost {
  slug: string;
  /** Its page: `/en/blog/hello`. */
  url: string;
  /** Language of the file that is shown (the default language when there is no translation). */
  lang: string;
  title: string;
  description: string;
  /** ISO 8601. */
  date: string;
  categories: string[];
  tags: string[];
  authors: string[];
  cover?: string | undefined;
  coverAlt?: string | undefined;
  /** Minutes, at least 1. */
  readingTime: number;
}

/** A post is published when it is not a draft and its date has come. */
export function isPublished(
  frontmatter: { draft: boolean; date: Date },
  now: Date = new Date(),
): boolean {
  return !frontmatter.draft && frontmatter.date.getTime() <= now.getTime();
}

/**
 * Other posts that share tags or categories with `post`, best match first. `posts` come newest
 * first, which is the tiebreaker.
 */
export function relatedPosts(post: BlogPost, posts: readonly BlogPost[], limit = 3): BlogPost[] {
  const score = (other: BlogPost) =>
    other.tags.filter((t) => post.tags.includes(t)).length * 2 +
    other.categories.filter((c) => post.categories.includes(c)).length;
  return posts
    .filter((other) => other.slug !== post.slug)
    .map((other) => ({ other, score: score(other) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.other);
}

export interface PostFilter {
  category?: string | undefined;
  tags?: readonly string[] | undefined;
  query?: string | undefined;
}

const normalize = (value: string) => value.toLowerCase().normalize("NFKD");

/**
 * Category, selected tags (a post needs all of them) and a text query. The query is matched against
 * the title, the tags and the author names, every word of it has to be found.
 */
export function filterPosts(
  posts: readonly BlogPost[],
  filter: PostFilter,
  authorNames: Readonly<Record<string, string>> = {},
): BlogPost[] {
  const words = normalize(filter.query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return posts.filter((post) => {
    if (filter.category && !post.categories.includes(filter.category)) return false;
    if (filter.tags?.some((tag) => !post.tags.includes(tag))) return false;
    if (words.length === 0) return true;
    const haystack = normalize(
      [post.title, ...post.tags, ...post.authors.map((id) => authorNames[id] ?? id)].join(" "),
    );
    return words.every((word) => haystack.includes(word));
  });
}

export interface Page<T> {
  items: T[];
  page: number;
  pages: number;
}

/** A 1-based page; an out of range number is moved into range. */
export function paginate<T>(items: readonly T[], page: number, perPage: number): Page<T> {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: items.slice((current - 1) * perPage, current * perPage), page: current, pages };
}

/** Tags of the posts with the number of posts that have them, most used first. */
export function collectTags(posts: readonly BlogPost[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts)
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
