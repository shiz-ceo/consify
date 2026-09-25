import type { ReactNode } from "react";
import type { BlogPost } from "../posts.ts";
import type { BlogAuthor } from "./context.tsx";

/** Same date in the browser and on the server: fixed time zone. */
export function formatDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(iso),
  );
}

function hash(text: string): number {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

/** A stable gradient for a post without a cover image. */
export function coverGradient(slug: string): string {
  const h = hash(slug) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 22%), hsl(${(h + 55) % 360} 65% 42%))`;
}

/** The cover of a post: its image, or a gradient made from the slug. */
export function PostCover({
  post,
  className = "",
  eager = false,
}: {
  post: Pick<BlogPost, "slug" | "cover" | "coverAlt" | "title">;
  className?: string;
  eager?: boolean;
}) {
  return (
    <div
      className={`consify-media relative overflow-hidden rounded-2xl bg-fd-card ${className}`}
      style={post.cover ? undefined : { backgroundImage: coverGradient(post.slug) }}
    >
      {post.cover ? (
        <img
          src={post.cover}
          alt={post.coverAlt ?? ""}
          loading={eager ? "eager" : "lazy"}
          className="size-full object-cover"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="consify-media-border pointer-events-none absolute inset-0 rounded-[inherit]"
      />
    </div>
  );
}

function Avatar({ author, size = 24 }: { author: BlogAuthor; size?: number }) {
  const initials = author.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return author.avatar ? (
    <img
      src={author.avatar}
      alt=""
      width={size}
      height={size}
      className="rounded-full border border-fd-background object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full bg-fd-secondary text-[10px] font-medium text-fd-secondary-foreground"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  );
}

/** Overlapping avatars, and the names when `names` is set. */
export function AuthorLine({
  ids,
  authors,
  names = false,
  size = 24,
}: {
  ids: readonly string[];
  authors: Record<string, BlogAuthor>;
  names?: boolean;
  size?: number;
}) {
  const known = ids.map((id) => authors[id]).filter((a): a is BlogAuthor => a !== undefined);
  if (known.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-1.5">
        {known.map((author) => (
          <Avatar key={author.name} author={author} size={size} />
        ))}
      </span>
      {names ? (
        <span className="text-fd-foreground">{known.map((a) => a.name).join(", ")}</span>
      ) : null}
    </span>
  );
}

export function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active
          ? "border-fd-primary bg-fd-primary text-fd-primary-foreground"
          : "border-fd-border text-fd-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}
