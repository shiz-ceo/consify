import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineConfig } from "../src/config/index.ts";
import { createBlog } from "../src/features/blog/blog.ts";
import { buildRss } from "../src/features/blog/feed.ts";
import { authorNames, categoryLabels, localized } from "../src/features/blog/labels.ts";
import {
  type BlogPost,
  collectTags,
  filterPosts,
  isPublished,
  paginate,
  parsePostPath,
  pickLanguage,
  readingTime,
  relatedPosts,
  sortByDate,
} from "../src/features/blog/posts.ts";
import {
  checkPosts,
  publishedFiles,
  readFrontmatter,
  scanPosts,
} from "../src/features/blog/scan.ts";
import { postFrontmatterSchema } from "../src/features/blog/schema.ts";

const post = (slug: string, extra: Partial<BlogPost> = {}): BlogPost => ({
  slug,
  lang: "en",
  title: slug,
  description: "d",
  date: "2026-01-01T00:00:00.000Z",
  categories: [],
  tags: [],
  authors: [],
  readingTime: 1,
  ...extra,
});

describe("paths, publishing, reading time", () => {
  test("parsePostPath splits the slug and the language suffix", () => {
    expect(parsePostPath("hello.mdx", ["en", "ru"])).toEqual({ slug: "hello", lang: undefined });
    expect(parsePostPath("hello.ru.mdx", ["en", "ru"])).toEqual({ slug: "hello", lang: "ru" });
    expect(parsePostPath("v1.2.mdx", ["en", "ru"])).toEqual({ slug: "v1.2", lang: undefined });
    expect(parsePostPath("cover.png", ["en"])).toBeUndefined();
  });

  test("a draft or a future post is not published", () => {
    const now = new Date("2026-06-01");
    expect(isPublished({ draft: false, date: new Date("2026-05-31") }, now)).toBe(true);
    expect(isPublished({ draft: true, date: new Date("2026-05-31") }, now)).toBe(false);
    expect(isPublished({ draft: false, date: new Date("2026-06-02") }, now)).toBe(false);
  });

  test("readingTime rounds up and is at least one minute", () => {
    expect(readingTime("")).toBe(1);
    expect(readingTime("word ".repeat(200))).toBe(1);
    expect(readingTime("word ".repeat(201))).toBe(2);
  });
});

describe("language, order and related posts", () => {
  test("pickLanguage prefers the language, falls back to the default, else nothing", () => {
    const files = [
      { lang: undefined, n: "en" },
      { lang: "ru", n: "ru" },
    ];
    expect(pickLanguage(files, "ru", "en")?.n).toBe("ru");
    expect(pickLanguage(files, "de", "en")?.n).toBe("en");
    expect(pickLanguage([{ lang: "ru", n: "only-ru" }], "de", "en")).toBeUndefined();
  });

  test("sortByDate is newest first and does not mutate", () => {
    const a = post("a", { date: "2026-01-01T00:00:00.000Z" });
    const b = post("b", { date: "2026-03-01T00:00:00.000Z" });
    const input = [a, b];
    expect(sortByDate(input).map((p) => p.slug)).toEqual(["b", "a"]);
    expect(input[0]).toBe(a);
  });

  test("relatedPosts ranks by shared tags and categories, skips the post itself", () => {
    const base = post("base", { tags: ["x", "y"], categories: ["c"] });
    const posts = [
      base,
      post("none"),
      post("cat", { categories: ["c"] }),
      post("tags", { tags: ["x", "y"] }),
    ];
    expect(relatedPosts(base, posts, 2).map((p) => p.slug)).toEqual(["tags", "cat"]);
  });
});

describe("filter, search, tags, pagination", () => {
  const posts = [
    post("retries", {
      title: "Retries that work",
      tags: ["reliability", "guide"],
      categories: ["engineering"],
      authors: ["ada"],
    }),
    post("launch", {
      title: "Lattice 2.3 launch",
      tags: ["release"],
      categories: ["updates"],
      authors: ["grace"],
    }),
    post("scale", {
      title: "Scaling workers",
      tags: ["reliability"],
      categories: ["engineering", "customers"],
    }),
  ];
  const names = { ada: "Ada Lovelace", grace: "Grace Hopper" };

  test("category and tags (all of them)", () => {
    expect(filterPosts(posts, { category: "engineering" }).map((p) => p.slug)).toEqual([
      "retries",
      "scale",
    ]);
    expect(filterPosts(posts, { tags: ["reliability"] }).map((p) => p.slug)).toEqual([
      "retries",
      "scale",
    ]);
    expect(filterPosts(posts, { tags: ["reliability", "guide"] }).map((p) => p.slug)).toEqual([
      "retries",
    ]);
  });

  test("the query searches title, tags and author names, every word must match", () => {
    expect(filterPosts(posts, { query: "RETRIES" }).map((p) => p.slug)).toEqual(["retries"]);
    expect(filterPosts(posts, { query: "release" }, names).map((p) => p.slug)).toEqual(["launch"]);
    expect(filterPosts(posts, { query: "lovelace" }, names).map((p) => p.slug)).toEqual([
      "retries",
    ]);
    expect(filterPosts(posts, { query: "workers reliability" }, names).map((p) => p.slug)).toEqual([
      "scale",
    ]);
    expect(filterPosts(posts, { query: "nothing" }, names)).toEqual([]);
  });

  test("filters combine", () => {
    expect(
      filterPosts(posts, { category: "engineering", query: "scaling" }).map((p) => p.slug),
    ).toEqual(["scale"]);
  });

  test("collectTags counts and sorts by use, then name", () => {
    expect(collectTags(posts)).toEqual([
      { tag: "reliability", count: 2 },
      { tag: "guide", count: 1 },
      { tag: "release", count: 1 },
    ]);
  });

  test("paginate moves an out of range page into range", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 1, 12)).toEqual({ items: items.slice(0, 12), page: 1, pages: 3 });
    expect(paginate(items, 3, 12).items).toEqual([24]);
    expect(paginate(items, 99, 12).page).toBe(3);
    expect(paginate(items, -4, 12).page).toBe(1);
    expect(paginate([], 1, 12)).toEqual({ items: [], page: 1, pages: 1 });
  });
});

describe("labels", () => {
  const config = defineConfig({
    site: { name: "D" },
    i18n: { languages: ["en", "ru"] },
    blog: {
      categories: [
        { id: "updates", label: { en: "Updates", ru: "Обновления" } },
        { id: "eng", label: "Engineering" },
      ],
      authors: { ada: { name: "Ada" } },
    },
  });

  test("localized text and category labels", () => {
    expect(localized(config, "ru", { en: "A", ru: "Б" })).toBe("Б");
    expect(localized(config, "de", { en: "A", ru: "Б" })).toBe("A");
    expect(localized(config, "en", "plain")).toBe("plain");
    expect(categoryLabels(config, "ru")).toEqual({ updates: "Обновления", eng: "Engineering" });
    expect(authorNames(config)).toEqual({ ada: "Ada" });
  });
});

describe("blog config", () => {
  const base = { site: { name: "D" } };

  test("defaults", () => {
    const blog = defineConfig({ ...base, blog: {} }).blog;
    expect(blog).toMatchObject({
      perPage: 12,
      share: true,
      rss: true,
      categories: [],
      authors: {},
    });
    expect(defineConfig(base).blog).toBeUndefined();
  });

  test("duplicate category ids, bad ids and unknown fields are rejected", () => {
    const cats = [
      { id: "a", label: "A" },
      { id: "a", label: "B" },
    ];
    expect(() => defineConfig({ ...base, blog: { categories: cats } })).toThrow(
      /duplicate category id "a"/,
    );
    expect(() =>
      defineConfig({ ...base, blog: { categories: [{ id: "Bad Id", label: "x" }] } }),
    ).toThrow(/lowercase/);
    expect(() => defineConfig({ ...base, blog: { authors: { "Bad Id": { name: "x" } } } })).toThrow(
      /author id/,
    );
    expect(() => defineConfig({ ...base, blog: { perPages: 3 } as never })).toThrow(
      /Unrecognized key/,
    );
  });
});

describe("frontmatter, scanning and checks", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-blog-"));
  });
  afterEach(() => rmSync(cwd, { recursive: true, force: true }));

  const write = (file: string, header: string) => {
    const path = join(cwd, "content/blog", file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `---\n${header}\n---\n\nBody\n`);
  };
  const ok = (date: string, extra = "") => `title: T\ndescription: D\ndate: ${date}\n${extra}`;

  test("readFrontmatter reads YAML, a file without a header is empty", () => {
    expect(readFrontmatter("---\ntitle: A\ntags: [x, y]\n---\nBody")).toEqual({
      title: "A",
      tags: ["x", "y"],
    });
    expect(readFrontmatter("no header")).toEqual({});
  });

  test("the schema fills defaults and parses the date", () => {
    const parsed = postFrontmatterSchema.parse({
      title: "T",
      description: "D",
      date: "2026-05-01",
    });
    expect(parsed.draft).toBe(false);
    expect(parsed.tags).toEqual([]);
    expect(parsed.date).toBeInstanceOf(Date);
  });

  test("scanPosts reads every file with its language", () => {
    write("a.mdx", ok("2026-01-01"));
    write("a.ru.mdx", ok("2026-01-01"));
    const posts = scanPosts(cwd, ["en", "ru"]);
    expect(posts.map((p) => [p.slug, p.lang])).toEqual([
      ["a", undefined],
      ["a", "ru"],
    ]);
  });

  test("an invalid header stops with the file name and the problem", () => {
    write("bad.mdx", "title: T\ndate: not a date");
    expect(() => scanPosts(cwd, ["en"])).toThrow(/content\/blog\/bad\.mdx[\s\S]*description/);
  });

  test("publishedFiles drops drafts and future posts, CONSIFY_DRAFTS=1 keeps them", () => {
    write("live.mdx", ok("2026-01-01"));
    write("draft.mdx", ok("2026-01-01", "draft: true"));
    write("later.mdx", ok("2099-01-01"));
    const posts = scanPosts(cwd, ["en"]);
    const now = new Date("2026-06-01");
    expect(publishedFiles(posts, now).map((p) => p.slug)).toEqual(["live"]);
    process.env.CONSIFY_DRAFTS = "1";
    try {
      expect(publishedFiles(posts, now)).toHaveLength(3);
    } finally {
      delete process.env.CONSIFY_DRAFTS;
    }
  });

  test("checkPosts names unknown categories and authors", () => {
    write("a.mdx", ok("2026-01-01", "categories: [updates, nope]\nauthors: [ada, ghost]"));
    const problems = checkPosts(scanPosts(cwd, ["en"]), {
      categories: ["updates"],
      authors: ["ada"],
    });
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('unknown category "nope"');
    expect(problems[1]).toContain('unknown author "ghost"');
  });
});

describe("buildRss", () => {
  test("a valid feed with escaped text, dates and categories", () => {
    const xml = buildRss(
      [
        post("a&b", {
          title: "A & <B>",
          date: "2026-01-02T03:04:05.000Z",
          categories: ["updates"],
          tags: ["t"],
        }),
      ],
      {
        title: "Blog",
        description: "News",
        language: "en",
        link: "https://x.dev/en/blog",
        self: "https://x.dev/en/blog/rss.xml",
        postUrl: (p) => `https://x.dev/en/blog/${p.slug}`,
        categoryLabels: { updates: "Updates" },
      },
    );
    expect(xml).toContain("<title>A &amp; &lt;B&gt;</title>");
    expect(xml).toContain("<link>https://x.dev/en/blog/a&amp;b</link>");
    expect(xml).toContain("<pubDate>Fri, 02 Jan 2026 03:04:05 GMT</pubDate>");
    expect(xml).toContain("<category>Updates</category>");
    expect(xml).toContain("<category>t</category>");
    expect(xml).toContain('rel="self"');
  });
});

describe("posts without a translation", () => {
  const entry = (path: string) => ({
    info: { path },
    title: path,
    description: "d",
    date: "2026-01-01",
    categories: [],
    tags: [],
    authors: [],
    load: async () => ({ toc: [] }),
    preload: async () => {},
    getText: async () => "words",
    body: (() => null) as never,
  });
  const entries = [entry("a.mdx"), entry("a.ru.mdx"), entry("b.mdx")];
  const blog = createBlog(
    defineConfig({ site: { name: "D" }, i18n: { languages: ["en", "ru"] } }),
    {
      entries,
      get: (path: string) => entries.find((e) => e.info.path === path),
    },
  );

  test("are listed in the default language unless the list is exact", async () => {
    expect((await blog.posts("ru")).map((p) => [p.slug, p.lang]).sort()).toEqual([
      ["a", "ru"],
      ["b", "en"],
    ]);
    expect((await blog.posts("ru", { exact: true })).map((p) => p.slug)).toEqual(["a"]);
    expect((await blog.posts("en", { exact: true })).map((p) => p.slug).sort()).toEqual(["a", "b"]);
  });
});
