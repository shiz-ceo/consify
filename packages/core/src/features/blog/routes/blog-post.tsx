import { blog } from "docsivi:blog";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { TOCProvider, TOCScrollArea } from "fumadocs-ui/components/toc";
import { TOCItem, TOCItems } from "fumadocs-ui/components/toc/default";
import { DocsBody } from "fumadocs-ui/layouts/notebook/page";
import { type ComponentProps, use } from "react";
import { Link, useParams } from "react-router";
import { SiteLayout } from "../../../shared/layout/site-layout.tsx";
import { resolveHref } from "../../../shared/links.ts";
import { format, getMessages } from "../../../shared/messages.ts";
import { absoluteUrl, buildMeta, docsivi, requireLang } from "../../../shared/router.ts";
import { getMDXComponents } from "../../../shared/ui/mdx.tsx";
import { categoryLabels } from "../labels.ts";
import type { BlogPost } from "../posts.ts";
import { relatedPosts } from "../posts.ts";
import { PostCard } from "../ui/blog-list.tsx";
import { BlogProvider } from "../ui/context.tsx";
import { AuthorLine, Chip, formatDate, PostCover } from "../ui/post-parts.tsx";
import { Reveal, RevealGroup } from "../ui/reveal.tsx";
import { ShareButtons } from "../ui/share-buttons.tsx";
import { SmoothAnchors } from "../ui/smooth-anchors.tsx";

type Params = Record<string, string | undefined>;

interface PostData {
  lang: string;
  post: BlogPost;
  /** Path of the file inside `content/blog`. */
  path: string;
  related: BlogPost[];
  categoryLabels: Record<string, string>;
  authors: NonNullable<typeof docsivi.config.blog>["authors"];
  share: boolean;
  shareUrl: string;
  alternates: Record<string, string>;
}

export async function loader({ params }: { params: Params }): Promise<PostData> {
  const lang = requireLang(params);
  const { config } = docsivi;
  const segments = (params["*"] ?? "").split("/").filter(Boolean);
  if (!config.blog || !blog || segments.length !== 1)
    throw new Response("Not found", { status: 404 });

  const found = await blog.post(segments[0] as string, lang);
  if (!found) throw new Response("Not found", { status: 404 });
  await found.entry.preload();

  const alternates: Record<string, string> = {};
  for (const other of config.i18n.languages) {
    if (await blog.post(found.post.slug, other))
      alternates[other] = `/${other}/blog/${found.post.slug}`;
  }

  return {
    lang,
    post: found.post,
    path: found.entry.info.path,
    related: relatedPosts(found.post, await blog.posts(lang)),
    categoryLabels: categoryLabels(config, lang),
    authors: config.blog.authors,
    share: config.blog.share,
    shareUrl: absoluteUrl(`/${lang}/blog/${found.post.slug}`),
    alternates,
  };
}

export function meta({ loaderData }: { loaderData?: PostData }) {
  if (!loaderData) return [];
  const { lang, post, alternates } = loaderData;
  const tags = buildMeta({
    lang,
    title: `${post.title} | ${docsivi.config.site.name}`,
    description: post.description,
    path: `/${lang}/blog/${post.slug}`,
    alternates,
    image: `/${lang}/blog/${post.slug}/og.png`,
  });
  tags.push(
    { property: "og:type", content: "article" },
    { property: "article:published_time", content: post.date },
    ...post.tags.map((tag) => ({ property: "article:tag", content: tag })),
  );
  return tags;
}

/** Links in a post: `/docs` and other site paths get the language of the post. */
function PostLink({ href, ...props }: ComponentProps<"a">) {
  const { lang } = useParams();
  const to = href && lang ? resolveHref(docsivi.config, lang, href) : href;
  if (to?.startsWith("/")) return <Link to={to} {...(props as object)} />;
  const external = to?.startsWith("http");
  return (
    <a
      href={to}
      {...props}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    />
  );
}

export default function BlogPostRoute({ loaderData }: { loaderData: PostData }) {
  const {
    lang,
    post,
    path,
    related,
    categoryLabels: labels,
    authors,
    share,
    shareUrl,
  } = loaderData;
  const { config } = docsivi;
  const messages = getMessages(config, lang);

  const entry = blog?.collection.get(path);
  if (!entry) throw new Error(`unknown post: ${path}`);
  // The content was preloaded in the loader, so this does not suspend.
  const { toc } = use(entry.load());
  const Body = entry.body;

  const shareBlock = share ? (
    <div>
      <ShareButtons link={shareUrl} title={post.title} label={messages.share} copied="✓" />
    </div>
  ) : null;

  return (
    <SiteLayout docsivi={docsivi} lang={lang}>
      <div className="mx-auto w-full max-w-[84rem] px-6 pb-16">
        {/* title block: a narrow centered column */}
        <header className="mx-auto max-w-3xl pt-10 md:pt-14">
          <Link
            to={`/${lang}/blog`}
            className="text-sm text-fd-muted-foreground hover:text-fd-foreground"
          >
            ← {messages.backToBlog}
          </Link>
          {post.categories.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.categories.map((id) => (
                <Link key={id} to={`/${lang}/blog?category=${id}`}>
                  <Chip>{labels[id] ?? id}</Chip>
                </Link>
              ))}
            </div>
          ) : null}
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance md:text-6xl">
            {post.title}
          </h1>
          <p className="mt-5 text-lg text-fd-muted-foreground md:text-xl">{post.description}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fd-muted-foreground">
            <AuthorLine ids={post.authors} authors={authors} names size={28} />
            <time dateTime={post.date}>{formatDate(post.date, lang)}</time>
          </div>
        </header>

        {/* the cover is wider than the text */}
        <PostCover post={post} eager className="mx-auto mt-10 aspect-[16/8] w-full max-w-6xl" />

        {/* left: meta and share, center: text, right: table of contents */}
        <SmoothAnchors />
        <RevealGroup className="mt-12 grid gap-x-10 xl:grid-cols-[14rem_minmax(0,1fr)_16rem]">
          <aside className="hidden xl:block">
            <Reveal className="sticky top-24 space-y-6 text-sm text-fd-muted-foreground">
              <p>
                {formatDate(post.date, lang)} ·{" "}
                {format(messages.minRead, { minutes: String(post.readingTime) })}
              </p>
              <AuthorLine ids={post.authors} authors={authors} names size={28} />
              {share ? (
                <div className="space-y-3">
                  <p className="text-base font-medium text-fd-foreground">{messages.share}</p>
                  <ShareButtons link={shareUrl} title={post.title} label="" copied="✓" />
                </div>
              ) : null}
            </Reveal>
          </aside>

          <article data-blog-post className="mx-auto w-full min-w-0 max-w-3xl">
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 text-sm text-fd-muted-foreground xl:hidden">
              <span>{format(messages.minRead, { minutes: String(post.readingTime) })}</span>
              {shareBlock}
            </div>

            {toc.length > 0 ? (
              <div className="mb-8 xl:hidden">
                <InlineTOC items={toc}>{messages.inThisArticle}</InlineTOC>
              </div>
            ) : null}

            <DocsBody>
              <BlogProvider
                value={{
                  authors,
                  repo: config.site.github?.repo,
                  resolve: (href) => resolveHref(config, lang, href),
                }}
              >
                <Body
                  components={getMDXComponents(config, { a: PostLink }, docsivi.customComponents)}
                />
              </BlogProvider>
            </DocsBody>

            {post.tags.length > 0 ? (
              <div className="mt-10 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Link key={tag} to={`/${lang}/blog?tag=${encodeURIComponent(tag)}`}>
                    <Chip>{tag}</Chip>
                  </Link>
                ))}
              </div>
            ) : null}
          </article>

          {toc.length > 0 ? (
            <aside className="hidden xl:block">
              <Reveal className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-hidden">
                <TOCProvider toc={toc}>
                  <TOCScrollArea>
                    <TOCItems>
                      {toc.map((item) => (
                        <TOCItem key={item.url} item={item} />
                      ))}
                    </TOCItems>
                  </TOCScrollArea>
                </TOCProvider>
              </Reveal>
            </aside>
          ) : null}
        </RevealGroup>

        {related.length > 0 ? (
          <section className="mx-auto mt-20 max-w-6xl border-t border-fd-border pt-10">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">{messages.relatedPosts}</h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((other) => (
                <PostCard
                  key={other.slug}
                  post={other}
                  lang={lang}
                  authors={authors}
                  categoryLabels={labels}
                  featured={false}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </SiteLayout>
  );
}
