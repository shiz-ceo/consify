import { blog } from "docsivi:blog";
import { SiteLayout } from "../../../shared/layout/site-layout.tsx";
import { getMessages } from "../../../shared/messages.ts";
import { absoluteUrl, buildMeta, docsivi, requireLang } from "../../../shared/router.ts";
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
  authors: NonNullable<typeof docsivi.config.blog>["authors"];
  perPage: number;
  rss: boolean;
}

/** `/{lang}/blog`: only published posts reach this loader, so nothing else can be sent to the browser. */
export async function loader({ params }: { params: Params }): Promise<ListData> {
  const lang = requireLang(params);
  const { config } = docsivi;
  if (!config.blog || !blog) throw new Response("Not found", { status: 404 });
  const labels = categoryLabels(config, lang);
  return {
    lang,
    title: localized(config, lang, config.blog.title) ?? getMessages(config, lang).blog,
    description: localized(config, lang, config.blog.description) ?? config.site.description,
    posts: await blog.posts(lang),
    categories: config.blog.categories.map((c) => ({ id: c.id, label: labels[c.id] ?? c.id })),
    authors: config.blog.authors,
    perPage: config.blog.perPage,
    rss: config.blog.rss,
  };
}

export function meta({ loaderData }: { loaderData?: ListData }) {
  if (!loaderData) return [];
  const { lang, title, description, rss } = loaderData;
  const tags = buildMeta({
    lang,
    title: `${title} | ${docsivi.config.site.name}`,
    description,
    path: `/${lang}/blog`,
    alternates: Object.fromEntries(docsivi.config.i18n.languages.map((l) => [l, `/${l}/blog`])),
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
  const { lang, title, description, posts, categories, authors, perPage, rss } = loaderData;
  const messages = getMessages(docsivi.config, lang);
  return (
    <SiteLayout docsivi={docsivi} lang={lang}>
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
          messages={messages}
        />
      </main>
    </SiteLayout>
  );
}
