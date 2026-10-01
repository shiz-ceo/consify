// The blog: what it is made of, for `docs.config.ts`. The pages are in list.tsx and post.tsx, the
// MDX components of posts in mdx.tsx. No JSX here: Node reads this module with `docs.config.ts`.
import {
  defineFeature,
  type Entry,
  type EntryPage,
  type LoadContext,
  lazyComponents,
  localized,
  type MessagesOf,
  page,
} from "@consify/core";
import { lazy } from "react";
import { z } from "zod";
import { type BlogPost, isPublished, relatedPosts } from "./posts.ts";

export type { BlogPost } from "./posts.ts";

const ListPage = lazy(() => import("./list.tsx"));
const PostPage = lazy(() => import("./post.tsx"));

// --- strings ---

/** The strings of the blog. `i18n.messages` in `docs.config.ts` overrides any of them. */
export const blogMessages = {
  en: {
    blog: "Blog",
    blogHint: "Articles and release notes",
    allPosts: "All posts",
    searchPosts: "Search posts...",
    filter: "Filter",
    tags: "Tags",
    clearFilters: "Clear filters",
    noPosts: "No posts found.",
    minRead: "{minutes} min read",
    share: "Share",
    relatedPosts: "Keep reading",
    backToBlog: "Back to the blog",
    inThisArticle: "In this article",
    previous: "Previous",
    next: "Next",
    page: "Page {page}",
    rss: "RSS feed",
    postedBy: "By",
    copyLink: "Link",
    pagination: "Pagination",
    expand: "Expand",
    lowerIsBetter: "lower is better",
    higherIsBetter: "higher is better",
    embeddedContent: "Embedded content",
  },
  ru: {
    blog: "Блог",
    blogHint: "Статьи и новости",
    allPosts: "Все статьи",
    searchPosts: "Поиск по статьям...",
    filter: "Фильтр",
    tags: "Теги",
    clearFilters: "Сбросить фильтры",
    noPosts: "Ничего не найдено.",
    minRead: "{minutes} мин чтения",
    share: "Поделиться",
    relatedPosts: "Читайте также",
    backToBlog: "Назад в блог",
    inThisArticle: "В этой статье",
    previous: "Назад",
    next: "Вперёд",
    page: "Страница {page}",
    rss: "RSS-лента",
    postedBy: "Автор",
    copyLink: "Ссылка",
    pagination: "Страницы",
    expand: "Развернуть",
    lowerIsBetter: "чем меньше, тем лучше",
    higherIsBetter: "чем больше, тем лучше",
    embeddedContent: "Встроенное содержимое",
  },
} as const;

export type BlogMessages = MessagesOf<typeof blogMessages>;

// --- posts ---

/** Slugs of categories, authors and tags: lowercase words joined by `-`. */
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const id = z.string().regex(idPattern, "must be lowercase letters, digits and `-`");

/** The header (front matter) of a post in `content/<language>/blog`. Tags are free. */
const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  /** Publication date. A post dated in the future is not published until then. */
  date: z.coerce.date(),
  categories: z.array(id).default([]),
  tags: z.array(z.string().min(1)).default([]),
  /** Author ids from `blog.authors`. */
  authors: z.array(id).default([]),
  /** Path of the cover image in `public/`, e.g. `/blog/my-post/cover.png`. */
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  /** A draft is never published. */
  draft: z.boolean().default(false),
});

export type PostFrontmatter = z.output<typeof postFrontmatterSchema>;

/** The header of a post of a blog: its categories and authors are ones the blog knows. */
function postSchema(categories: readonly string[], authors: readonly string[]) {
  return postFrontmatterSchema.superRefine((post, ctx) => {
    for (const category of post.categories) {
      if (!categories.includes(category)) {
        ctx.addIssue({
          code: "custom",
          path: ["categories"],
          message: `unknown category "${category}" (add it to categories of blog())`,
        });
      }
    }
    for (const author of post.authors) {
      if (!authors.includes(author)) {
        ctx.addIssue({
          code: "custom",
          path: ["authors"],
          message: `unknown author "${author}" (add it to authors of blog())`,
        });
      }
    }
  });
}

export interface BlogAuthor {
  name: string;
  role?: string | undefined;
  avatar?: string | undefined;
  url?: string | undefined;
}

/** The post of an entry of the blog. */
function toPost(entry: Entry<PostFrontmatter>): BlogPost {
  const { draft: _, date, ...data } = entry.data;
  return {
    slug: entry.slug,
    url: entry.url,
    lang: entry.lang,
    readingTime: entry.readingTime,
    ...data,
    date: date.toISOString(),
  };
}

// --- options ---

const localizedText = z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]);

/** The options of `blog()`. */
const blogOptionsSchema = z
  .strictObject({
    /** The address (`/{lang}/<id>`), content folder and link id. Set it for a second blog. */
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, "must be lowercase letters, digits and `-`")
      .default("blog"),
    /** Heading of the blog page and text of its link. Defaults to the translated word "Blog". */
    title: localizedText.optional(),
    description: localizedText.optional(),
    /** Posts per page of the list. */
    perPage: z.number().int().min(1).max(100).default(12),
    /** Categories of the list filter. A post lists the ids it belongs to. */
    categories: z
      .array(
        z.strictObject({
          id: z.string().regex(idPattern, "must be lowercase letters, digits and `-`"),
          label: localizedText,
        }),
      )
      .prefault([]),
    /** People who write posts, by id. A post lists the ids of its authors. */
    authors: z
      .record(
        z.string(),
        z.strictObject({
          name: z.string().min(1),
          role: z.string().optional(),
          /** Path or URL of the avatar. */
          avatar: z.string().optional(),
          url: z.string().optional(),
        }),
      )
      .prefault({}),
    /** Share buttons (X, LinkedIn, Bluesky) on a post. */
    share: z.boolean().default(true),
    /** An RSS feed at `/{lang}/<id>/rss.xml`. */
    rss: z.boolean().default(true),
  })
  .superRefine((blog, ctx) => {
    const ids = blog.categories.map((c) => c.id);
    const dup = ids.find((c, i) => ids.indexOf(c) !== i);
    if (dup !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: `duplicate category id "${dup}"`,
      });
    }
    for (const authorId of Object.keys(blog.authors)) {
      if (!idPattern.test(authorId)) {
        ctx.addIssue({
          code: "custom",
          path: ["authors", authorId],
          message: `author id "${authorId}" must be lowercase letters, digits and \`-\``,
        });
      }
    }
  });

/** What you pass to `blog()`. */
export type BlogOptionsInput = z.input<typeof blogOptionsSchema>;
/** The options with the defaults applied. */
export type BlogOptions = z.output<typeof blogOptionsSchema>;

// --- the feature ---

const blogUrl = (id: string, lang: string) => `/${lang}/${id}`;

/** The categories with their labels in the language of the page. */
const categoriesOf = ({ config, lang }: LoadContext, options: BlogOptions) =>
  options.categories.map((c) => ({ id: c.id, label: localized(config, lang, c.label) ?? c.id }));

/** What the list of posts shows. */
async function listData(context: LoadContext, options: BlogOptions) {
  const { content, config, lang, t } = context;
  return {
    title: localized(config, lang, options.title) ?? t("blog"),
    description: localized(config, lang, options.description) ?? config.site.description,
    posts: (await content.entries<PostFrontmatter>()).map(toPost),
    categories: categoriesOf(context, options),
    authors: options.authors,
    perPage: options.perPage,
    rss: options.rss ? `${blogUrl(options.id, lang)}/rss.xml` : undefined,
    /** Put on the cards of posts that are not translated. */
    fallbackBadge:
      config.i18n.fallback === "notice" ? config.i18n.defaultLanguage.toUpperCase() : undefined,
  };
}

/** What the page of a post shows: the entry, and what the blog knows around it. */
async function postData(context: LoadContext, options: BlogOptions) {
  const { content, config, lang, url } = context;
  const entry = context.entry as EntryPage<PostFrontmatter>;
  const post = toPost(entry);
  return {
    ...entry,
    post,
    related: relatedPosts(post, (await content.entries<PostFrontmatter>()).map(toPost)),
    categoryLabels: Object.fromEntries(categoriesOf(context, options).map((c) => [c.id, c.label])),
    authors: options.authors,
    repo: config.site.github?.repo,
    share: options.share ? url(entry.url) : undefined,
    blogUrl: blogUrl(options.id, lang),
  };
}

export type ListData = Awaited<ReturnType<typeof listData>>;
export type PostData = Awaited<ReturnType<typeof postData>>;

/**
 * A blog: posts in `content/<language>/blog/`, a list with filters and search, an RSS feed, a social
 * image per post, and MDX components for posts (`<Authors />`, `<Figure />`, …).
 *
 * @example
 * features: [blog({ authors: { ada: { name: "Ada" } } })]
 * features: [blog(), blog({ id: "news", title: "News" })] // a second one at /{lang}/news
 */
export function blog(input: BlogOptionsInput = {}) {
  const parsed = blogOptionsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `blog(): ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const options: BlogOptions = parsed.data;

  return defineFeature({
    id: options.id,
    title: options.title ?? (({ t }) => t("blog")),
    description: options.description ?? (({ t }) => t("blogHint")),
    messages: blogMessages,
    content: {
      schema: postSchema(
        options.categories.map((c) => c.id),
        Object.keys(options.authors),
      ),
      // drafts and posts dated in the future are not published (`CONSIFY_DRAFTS=1` shows them)
      filter: (entry: Entry<PostFrontmatter>) =>
        process.env.CONSIFY_DRAFTS === "1" || isPublished(entry.data),
      sort: (a: Entry<PostFrontmatter>, b: Entry<PostFrontmatter>) =>
        b.data.date.getTime() - a.data.date.getTime(),
      og: true,
      rss: options.rss,
    },
    pages: {
      "/": page({
        load: (context) => listData(context, options),
        meta: ({ data }) => ({ title: data.title, description: data.description }),
        component: ListPage,
      }),
      "/:slug": page({
        entry: true,
        load: (context) => postData(context, options),
        meta: ({ data }) => ({
          head: [
            { property: "og:type", content: "article" },
            { property: "article:published_time", content: data.post.date },
            ...data.post.tags.map((tag) => ({ property: "article:tag", content: tag })),
          ],
        }),
        component: PostPage,
      }),
    },
    components: lazyComponents(
      () => import("./mdx.tsx"),
      ["Authors", "Benchmark", "CTA", "Embed", "Expand", "Figure", "PR"],
    ),
  });
}
