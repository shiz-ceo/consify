import { Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { format, type Messages } from "../../../shared/messages.ts";
import { type BlogPost, collectTags, filterPosts, paginate } from "../posts.ts";
import type { BlogAuthor } from "./context.tsx";
import { AuthorLine, Chip, formatDate, PostCover } from "./post-parts.tsx";

export interface BlogListProps {
  lang: string;
  posts: BlogPost[];
  categories: { id: string; label: string }[];
  authors: Record<string, BlogAuthor>;
  perPage: number;
  messages: Messages;
}

export function PostCard({
  post,
  lang,
  authors,
  categoryLabels,
  featured,
}: {
  post: BlogPost;
  lang: string;
  authors: Record<string, BlogAuthor>;
  categoryLabels: Record<string, string>;
  featured: boolean;
}) {
  const category = post.categories[0];
  return (
    <article className="group flex flex-col gap-4">
      <Link to={`/${lang}/blog/${post.slug}`} className="block" aria-hidden tabIndex={-1}>
        <PostCover
          post={post}
          className={`w-full transition-opacity group-hover:opacity-90 ${featured ? "aspect-[4/3]" : "aspect-[16/10]"}`}
          eager={featured}
        />
      </Link>
      <div className="flex flex-col gap-2">
        <h2
          className={`font-semibold tracking-tight text-balance ${featured ? "text-3xl" : "text-xl"}`}
        >
          <Link to={`/${lang}/blog/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fd-muted-foreground">
          <AuthorLine ids={post.authors} authors={authors} />
          <time dateTime={post.date}>{formatDate(post.date, lang)}</time>
          {category ? <span>{categoryLabels[category] ?? category}</span> : null}
        </div>
        <p
          className={`text-fd-muted-foreground ${featured ? "line-clamp-4 text-base" : "line-clamp-3 text-sm"}`}
        >
          {post.description}
        </p>
      </div>
    </article>
  );
}

/** 1 … 4 5 6 … 12 */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const shown = new Set([1, total, current - 1, current, current + 1]);
  const numbers = [...shown].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (const n of numbers) {
    const last = result[result.length - 1];
    if (typeof last === "number" && n - last > 1) result.push("…");
    result.push(n);
  }
  return result;
}

function Pagination({
  page,
  pages,
  onChange,
  messages,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  messages: Messages;
}) {
  if (pages <= 1) return null;
  const item =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-3 text-sm transition-colors";
  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        className={`${item} text-fd-muted-foreground hover:bg-fd-accent disabled:opacity-40`}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        {messages.previous}
      </button>
      {pageNumbers(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className={`${item} text-fd-muted-foreground`}>
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-current={n === page ? "page" : undefined}
            className={`${item} ${n === page ? "bg-fd-accent font-medium text-fd-accent-foreground" : "text-fd-muted-foreground hover:bg-fd-accent/50"}`}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        className={`${item} text-fd-muted-foreground hover:bg-fd-accent disabled:opacity-40`}
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        {messages.next}
      </button>
    </nav>
  );
}

/**
 * The list of posts: category pills, search, tag filter and numbered pages. Filtering runs in the
 * browser over the published posts the loader sent, and the state lives in the address
 * (`?category=…&tag=…&q=…&page=2`) so a filtered list can be shared.
 */
export function BlogList({ lang, posts, categories, authors, perPage, messages }: BlogListProps) {
  const [params, setParams] = useSearchParams();
  // The page is pre-rendered without a query: the first render must match it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [filterOpen, setFilterOpen] = useState(false);

  const category = mounted ? (params.get("category") ?? undefined) : undefined;
  const tags = mounted ? params.getAll("tag") : [];
  const query = mounted ? (params.get("q") ?? "") : "";
  const requestedPage = mounted ? Number(params.get("page") ?? 1) : 1;

  const names = useMemo(
    () => Object.fromEntries(Object.entries(authors).map(([id, a]) => [id, a.name])),
    [authors],
  );
  const labels = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.label])),
    [categories],
  );
  const allTags = useMemo(() => collectTags(posts), [posts]);
  const usedCategories = useMemo(
    () => categories.filter((c) => posts.some((p) => p.categories.includes(c.id))),
    [categories, posts],
  );

  const filtered = useMemo(
    () => filterPosts(posts, { category, tags, query }, names),
    [posts, category, tags.join("\u0000"), query, names],
  );
  const { items, page, pages } = paginate(filtered, requestedPage, perPage);
  const filtering = Boolean(category || tags.length > 0 || query);

  function update(next: {
    category?: string | undefined;
    tags?: string[];
    query?: string;
    page?: number;
  }) {
    const merged = {
      category: "category" in next ? next.category : category,
      tags: next.tags ?? tags,
      query: next.query ?? query,
      page: next.page ?? 1,
    };
    const search = new URLSearchParams();
    if (merged.category) search.set("category", merged.category);
    for (const tag of merged.tags) search.append("tag", tag);
    if (merged.query) search.set("q", merged.query);
    if (merged.page > 1) search.set("page", String(merged.page));
    setParams(search, { replace: true, preventScrollReset: true });
  }

  const pill = (active: boolean) =>
    `inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${
      active
        ? "bg-fd-primary text-fd-primary-foreground"
        : "text-fd-muted-foreground hover:text-fd-foreground"
    }`;

  // On the first page without filters the two newest posts are large.
  const featuredCount = page === 1 && !filtering ? Math.min(2, items.length) : 0;

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex flex-wrap items-center gap-1">
          <button
            type="button"
            className={pill(!category)}
            onClick={() => update({ category: undefined })}
          >
            {messages.allPosts}
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={pill(category === c.id)}
              onClick={() => update({ category: c.id })}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative block w-full lg:w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-fd-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => update({ query: e.target.value })}
              placeholder={messages.searchPosts}
              aria-label={messages.searchPosts}
              className="h-10 w-full rounded-xl border border-fd-border bg-fd-background ps-9 pe-3 text-sm outline-none placeholder:text-fd-muted-foreground focus:border-fd-ring"
            />
          </label>
          {allTags.length > 0 ? (
            <button
              type="button"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((open) => !open)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-fd-border bg-fd-secondary px-4 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              {messages.filter}
              <Filter className="size-4" />
              {tags.length > 0 ? (
                <span className="text-fd-muted-foreground">{tags.length}</span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      {filterOpen || tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={messages.tags}>
          {allTags.map(({ tag, count }) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  update({ tags: active ? tags.filter((t) => t !== tag) : [...tags, tag] })
                }
              >
                <Chip active={active}>
                  {tag} <span className="ms-1 opacity-60">{count}</span>
                </Chip>
              </button>
            );
          })}
          {filtering ? (
            <button
              type="button"
              className="text-xs text-fd-muted-foreground underline"
              onClick={() => update({ category: undefined, tags: [], query: "" })}
            >
              {messages.clearFilters}
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-24 text-center text-fd-muted-foreground">{messages.noPosts}</p>
      ) : (
        <div className="mt-10 flex flex-col gap-14">
          {featuredCount > 0 ? (
            <div className="grid gap-8 md:grid-cols-2">
              {items.slice(0, featuredCount).map((post) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  lang={lang}
                  authors={authors}
                  categoryLabels={labels}
                  featured
                />
              ))}
            </div>
          ) : null}
          {items.length > featuredCount ? (
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {items.slice(featuredCount).map((post) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  lang={lang}
                  authors={authors}
                  categoryLabels={labels}
                  featured={false}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      <Pagination
        page={page}
        pages={pages}
        onChange={(n) => {
          update({ page: n });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        messages={messages}
      />
      {pages > 1 ? (
        <p className="mt-3 text-center text-xs text-fd-muted-foreground">
          {format(messages.page, { page: String(page) })}
        </p>
      ) : null}
    </div>
  );
}
