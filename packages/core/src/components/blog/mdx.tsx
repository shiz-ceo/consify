import type { ReactNode } from "react";
import { type BlogAuthor, useBlog } from "./context.tsx";

/** <Authors ids={["ada", "grace"]} /> shows people from `blog.authors` inside a post. */
export function Authors({ ids }: { ids: string[] }) {
  const { authors } = useBlog();
  const people = ids
    .map((id) => [id, authors[id]] as const)
    .filter((p): p is [string, BlogAuthor] => p[1] !== undefined);
  return (
    <div className="not-prose my-6 flex flex-wrap gap-4">
      {people.map(([id, author]) => (
        <div key={id} className="flex items-center gap-3">
          {author.avatar ? (
            <img src={author.avatar} alt="" className="size-10 rounded-full object-cover" />
          ) : (
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-fd-secondary text-sm font-medium">
              {author.name[0]}
            </span>
          )}
          <span className="text-sm leading-tight">
            {author.url ? (
              <a className="font-medium underline" href={author.url}>
                {author.name}
              </a>
            ) : (
              <span className="font-medium">{author.name}</span>
            )}
            {author.role ? (
              <span className="block text-fd-muted-foreground">{author.role}</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** <Expand title="Full example">…code…</Expand>: a block that is closed until the reader opens it. */
export function Expand({ title = "Expand", children }: { title?: string; children: ReactNode }) {
  return (
    <details className="group my-4 rounded-xl border border-fd-border bg-fd-card px-4">
      <summary className="cursor-pointer py-3 text-sm font-medium text-fd-muted-foreground group-open:text-fd-foreground">
        {title}
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

/** <PR n={1234} /> links to a pull request or issue of the repository in `site.github`. */
export function PR({ n, kind = "pull" }: { n: number; kind?: "pull" | "issues" }) {
  const { repo } = useBlog();
  const label = `#${n}`;
  if (!repo) return <span>{label}</span>;
  return (
    <a
      className="font-mono text-[0.85em] text-fd-muted-foreground underline decoration-fd-border underline-offset-2 hover:text-fd-foreground"
      href={`https://github.com/${repo}/${kind}/${n}`}
    >
      {label}
    </a>
  );
}

export interface BenchmarkRow {
  label: string;
  value: number;
  /** Highlights this row (e.g. the new version). */
  highlight?: boolean;
}

/**
 * <Benchmark title="Requests per second" unit="req/s" rows={[{ label: "1.3", value: 90 }, …]} />
 * Bars are drawn relative to the largest value. `lowerIsBetter` is only a hint for the reader.
 */
export function Benchmark({
  title,
  unit = "",
  rows,
  lowerIsBetter = false,
  note,
}: {
  title: string;
  unit?: string;
  rows: BenchmarkRow[];
  lowerIsBetter?: boolean;
  note?: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <figure className="not-prose my-6 rounded-xl border border-fd-border bg-fd-card p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-fd-muted-foreground">
          {lowerIsBetter ? "lower is better" : "higher is better"}
        </span>
      </figcaption>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-sm"
          >
            <span className="truncate text-fd-muted-foreground">{row.label}</span>
            <span className="h-3 rounded-full bg-fd-secondary">
              <span
                className={`block h-3 rounded-full ${row.highlight ? "bg-fd-primary" : "bg-fd-muted-foreground/40"}`}
                style={{ width: `${(row.value / max) * 100}%` }}
              />
            </span>
            <span className="font-mono text-xs tabular-nums">
              {row.value}
              {unit ? ` ${unit}` : ""}
            </span>
          </div>
        ))}
      </div>
      {note ? <p className="mt-3 text-xs text-fd-muted-foreground">{note}</p> : null}
    </figure>
  );
}

/** <Figure src="/blog/x.png" alt="…" caption="…" />: an image with a caption. */
export function Figure({
  src,
  alt = "",
  caption,
}: {
  src: string;
  alt?: string;
  caption?: string;
}) {
  return (
    <figure className="not-prose my-6">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="w-full rounded-xl border border-fd-border"
      />
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** <Embed url="https://www.youtube.com/watch?v=…" title="…" />: a YouTube video, or any embeddable page. */
export function Embed({ url, title = "Embedded content" }: { url: string; title?: string }) {
  const youtube = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url)?.[1];
  const src = youtube ? `https://www.youtube-nocookie.com/embed/${youtube}` : url;
  return (
    <div className="not-prose my-6 aspect-video overflow-hidden rounded-xl border border-fd-border">
      <iframe
        src={src}
        title={title}
        className="size-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/** <CTA title="…" description="…" href="/docs" label="Get started" />: a call to action block. */
export function CTA({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description?: string;
  href: string;
  label: string;
}) {
  const { resolve } = useBlog();
  return (
    <div className="not-prose my-8 flex flex-col items-start gap-4 rounded-2xl border border-fd-border bg-fd-card p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-lg font-semibold">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-fd-muted-foreground">{description}</p>
        ) : null}
      </div>
      <a
        className="shrink-0 rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
        href={resolve ? resolve(href) : href}
      >
        {label}
      </a>
    </div>
  );
}
