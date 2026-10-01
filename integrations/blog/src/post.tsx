import "./blog.css";
import { format, Mdx, type PageProps, resolveHref } from "@consify/core";
import { consify, FallbackNotice, useMessages } from "@consify/core/ui";
import { InlineTOC } from "fumadocs-ui/components/inline-toc";
import { TOCProvider, TOCScrollArea } from "fumadocs-ui/components/toc";
import { TOCItem, TOCItems } from "fumadocs-ui/components/toc/default";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { BlogMessages, PostData } from "./index.ts";
import { AuthorLine, Chip, formatDate, PostCard, PostCover } from "./list.tsx";
import { BlogProvider } from "./mdx.tsx";

const targets = [
  {
    name: "X",
    url: (link: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "LinkedIn",
    url: (link: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
  },
  {
    name: "Bluesky",
    url: (link: string, title: string) =>
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${link}`)}`,
  },
];

const button =
  "inline-flex h-8 items-center rounded-full border border-fd-border px-3 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground";

/** Links that open the share window of X, LinkedIn and Bluesky, and a button that copies the link. */
function ShareButtons({
  link,
  title,
  label,
  copy,
  copied,
}: {
  link: string;
  title: string;
  label: string;
  copy: string;
  copied: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fd-muted-foreground">{label}</span>
      {targets.map((target) => (
        <a
          key={target.name}
          className={button}
          href={target.url(link, title)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {target.name}
        </a>
      ))}
      <button
        type="button"
        className={button}
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          });
        }}
      >
        {done ? copied : copy}
      </button>
    </div>
  );
}

const RevealContext = createContext(true);

/**
 * The container of the side columns of a post. They are shown while the container is in the upper
 * three quarters of the screen and hidden again when the reader scrolls back above it, so the
 * effect repeats in both directions and every column changes state at the same moment.
 */
function RevealGroup({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShown(entry?.isIntersecting ?? false),
      { rootMargin: "0px 0px -25% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <RevealContext.Provider value={shown}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </RevealContext.Provider>
  );
}

/** Fades in (with a small rise) while its `RevealGroup` is reached. */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const shown = useContext(RevealContext);
  return (
    <div
      className={`transition-[opacity,translate] duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Scrolls smoothly to a heading when an in-page link (the table of contents) is clicked. It is
 * done per click instead of `scroll-behavior: smooth` on the page, which would also slow down the
 * scrolling that other code triggers, such as the table of contents following the reader.
 */
function SmoothAnchors() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href^='#']");
      const id = link?.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(decodeURIComponent(id)) : null;
      if (!link || !target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", `#${id}`);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

/** The page of a post: title block, cover, text with its table of contents, related posts. */
export default function PostPage({ data, lang }: PageProps<PostData>) {
  const messages = useMessages<BlogMessages>();
  const { post, toc, categoryLabels: labels, authors, share, blogUrl } = data;
  const minRead = format(messages.minRead, { minutes: String(post.readingTime) });

  return (
    <div className="mx-auto w-full max-w-[84rem] px-6 pb-16">
      {/* title block: a narrow centered column */}
      <header className="mx-auto max-w-3xl pt-10 md:pt-14">
        <Link to={blogUrl} className="text-sm text-fd-muted-foreground hover:text-fd-foreground">
          ← {messages.backToBlog}
        </Link>
        {data.fallback ? <FallbackNotice original={data.original} className="mt-6" /> : null}
        {post.categories.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.categories.map((category) => (
              <Link key={category} to={`${blogUrl}?category=${category}`}>
                <Chip>{labels[category] ?? category}</Chip>
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
              {formatDate(post.date, lang)} · {minRead}
            </p>
            <AuthorLine ids={post.authors} authors={authors} names size={28} />
            {share ? (
              <div className="space-y-3">
                <p className="text-base font-medium text-fd-foreground">{messages.share}</p>
                <ShareButtons
                  link={share}
                  title={post.title}
                  label=""
                  copy={messages.copyLink}
                  copied="✓"
                />
              </div>
            ) : null}
          </Reveal>
        </aside>

        <article data-blog-post className="mx-auto w-full min-w-0 max-w-3xl">
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-3 text-sm text-fd-muted-foreground xl:hidden">
            <span>{minRead}</span>
            {share ? (
              <ShareButtons
                link={share}
                title={post.title}
                label={messages.share}
                copy={messages.copyLink}
                copied="✓"
              />
            ) : null}
          </div>

          {toc.length > 0 ? (
            <div className="mb-8 xl:hidden">
              <InlineTOC items={toc}>{messages.inThisArticle}</InlineTOC>
            </div>
          ) : null}

          <BlogProvider
            value={{
              authors,
              repo: data.repo,
              resolve: (href) => resolveHref(consify.config, lang, href),
            }}
          >
            <Mdx code={data.code} />
          </BlogProvider>

          {post.tags.length > 0 ? (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Link key={tag} to={`${blogUrl}?tag=${encodeURIComponent(tag)}`}>
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

      {data.related.length > 0 ? (
        <section className="mx-auto mt-20 max-w-6xl border-t border-fd-border pt-10">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">{messages.relatedPosts}</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {data.related.map((other) => (
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
  );
}
