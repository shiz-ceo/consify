import { blog } from "consify:blog";
import { SiteLayout } from "../../../shared/layout/site-layout.tsx";
import { getMessages } from "../../../shared/messages.ts";
import { absoluteUrl, buildMeta, consify, requireLang } from "../../../shared/router.ts";
import { categoryLabels, localized } from "../labels.ts";
import type { BlogPost } from "../posts.ts";
import { BlogList } from "../ui/blog-list.tsx";

type Params = Record<string, string | undefined>;

interface ListData {
  lang: string;
  title: string;
  description?: string | undefined;
  posts: BlogPost[];
  categories: { id: string; label: string }[];
  authors: NonNullable<typeof consify.config.blog>["authors"];
  perPage: number;
  rss: boolean;
  /** Code of the default language, put on the cards of posts that are not translated (or none). */
  fallbackBadge?: string | undefined;
}

/** `/{lang}/blog`: only published posts reach this loader, so nothing else can be sent to the browser. */
/** The section of the site this page belongs to (see `header.hideSearchOn`). */
export const handle = { page: "blog" };

export async function loader({ params }: { params: Params }): Promise<ListData> {
  const lang = requireLang(params);
  const { config } = consify;
  if (!config.blog || !blog) throw new Response("Not found", { status: 404 });
  const labels = categoryLabels(config, lang);
  return {
    lang,
    title: localized(config, lang, config.blog.title) ?? getMessages(config, lang).blog,
    description: localized(config, lang, config.blog.description) ?? config.site.description,
    posts: await blog.posts(lang, { exact: config.i18n.fallback === "hide" }),
    categories: config.blog.categories.map((c) => ({ id: c.id, label: labels[c.id] ?? c.id })),
    authors: config.blog.authors,
    perPage: config.blog.perPage,
    rss: config.blog.rss,
    ...(config.i18n.fallback === "notice"
      ? { fallbackBadge: config.i18n.defaultLanguage.toUpperCase() }
      : {}),
  };
}

export function meta({ loaderData }: { loaderData?: ListData }) {
  if (!loaderData) return [];
  const { lang, title, description, rss } = loaderData;
  const tags = buildMeta({
    lang,
    title: `${title} | ${consify.config.site.name}`,
    description,
    path: `/${lang}/blog`,
    alternates: Object.fromEntries(consify.config.i18n.languages.map((l) => [l, `/${l}/blog`])),
  });
  if (rss) {
    tags.push({
      tagName: "link",
      rel: "alternate",
      type: "application/rss+xml",
      title,
      href: absoluteUrl(`/${lang}/blog/rss.xml`),
    });
  }
  return tags;
}

export default function BlogRoute({ loaderData }: { loaderData: ListData }) {
  const { lang, title, description, posts, categories, authors, perPage, rss, fallbackBadge } =
    loaderData;
  const messages = getMessages(consify.config, lang);
  return (
    <SiteLayout consify={consify} lang={lang} page="blog">
      <main className="mx-auto w-full max-w-7xl px-6 py-12 md:py-16">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{title}</h1>
            {description ? (
              <p className="mt-3 max-w-2xl text-fd-muted-foreground">{description}</p>
            ) : null}
          </div>
          {rss ? (
            <a
              className="text-sm text-fd-muted-foreground underline"
              href={`/${lang}/blog/rss.xml`}
            >
              {messages.rss}
            </a>
          ) : null}
        </header>
        <BlogList
          lang={lang}
          posts={posts}
          categories={categories}
          authors={authors}
          perPage={perPage}
          fallbackBadge={fallbackBadge}
          messages={messages}
        />
      </main>
    </SiteLayout>
  );
}
