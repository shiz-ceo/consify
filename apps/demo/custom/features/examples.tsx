import {
  defineFeature,
  type Entry,
  type EntryPage,
  FallbackNotice,
  Mdx,
  type PageProps,
  page,
  z,
} from "@consify/core";
import { Link, useSearchParams } from "react-router";

/** The front matter of an example: `content/<language>/examples/<slug>.mdx`. */
const example = z.object({
  title: z.string(),
  description: z.string(),
  level: z.enum(["beginner", "advanced"]),
  tags: z.array(z.string()).default([]),
  date: z.coerce.date(),
});

type Example = z.output<typeof example>;

/** The list: every example as a card, filtered by a tag from the address (`?tag=cron`). */
function ExampleList({ data, t }: PageProps<Entry<Example>[]>) {
  const tag = useSearchParams()[0].get("tag");
  const shown = tag ? data.filter((entry) => entry.data.tags.includes(tag)) : data;
  const tags = [...new Set(data.flatMap((entry) => entry.data.tags))].sort();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">{t("examples")}</h1>
      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        {tags.map((name) => (
          <Link
            key={name}
            to={tag === name ? "." : `?tag=${encodeURIComponent(name)}`}
            className={tag === name ? "font-medium" : "text-fd-muted-foreground"}
          >
            #{name}
          </Link>
        ))}
      </nav>
      <ul className="mt-8 space-y-4">
        {shown.map((entry) => (
          <li key={entry.slug} className="rounded-lg border border-fd-border p-4">
            <Link to={entry.url} className="font-medium underline">
              {entry.data.title}
            </Link>
            <p className="mt-1 text-sm text-fd-muted-foreground">{entry.data.description}</p>
            <p className="mt-2 text-xs text-fd-muted-foreground">
              {t(entry.data.level)} · {t("minutes", { n: String(entry.readingTime) })}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** One example: its text, compiled from MDX by core. */
function ExamplePage({ data }: PageProps<EntryPage<Example>>) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">{data.data.title}</h1>
      {data.fallback ? <FallbackNotice original={data.original} className="mt-6" /> : null}
      <Mdx code={data.code} className="prose mt-8" />
    </main>
  );
}

/** Examples of Lattice: MDX files with a checked front matter and tags, a page per file. */
export const examples = defineFeature({
  id: "examples",
  title: ({ t }) => t("examples"),
  messages: {
    en: {
      examples: "Examples",
      beginner: "Beginner",
      advanced: "Advanced",
      minutes: "{n} min",
    },
    ru: {
      examples: "Примеры",
      beginner: "Для начала",
      advanced: "Продвинутый",
      minutes: "{n} мин",
    },
  },
  content: {
    schema: example,
    sort: (a, b) => b.data.date.getTime() - a.data.date.getTime(),
    og: true,
    rss: true,
  },
  pages: {
    "/": page({ load: ({ content }) => content.entries<Example>(), component: ExampleList }),
    "/:slug": { entry: true, component: ExamplePage },
  },
});
