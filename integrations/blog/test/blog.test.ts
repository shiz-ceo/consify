import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineConfig, type EntryPage, linkCatalog } from "@consify/core";
import { createLoadContext, siteAddresses } from "@consify/core/node";
import { blog } from "../src/index.ts";
import {
  type BlogPost,
  collectTags,
  filterPosts,
  isPublished,
  paginate,
  relatedPosts,
} from "../src/posts.ts";

const post = (slug: string, extra: Partial<BlogPost> = {}): BlogPost => ({
  slug,
  url: `/en/blog/${slug}`,
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

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-blog-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

/** A post of `content/<lang>/<folder>/<slug>.mdx`. */
function write(lang: string, slug: string, header: string, folder = "blog") {
  const path = join(cwd, "content", lang, folder, `${slug}.mdx`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `---\ntitle: ${slug}\ndescription: d\n${header}\n---\n\nSome text.\n`);
}

const site = { name: "D", url: "https://d.example" };
const config = (...features: ReturnType<typeof blog>[]) =>
  defineConfig({ site, i18n: { languages: ["en", "ru"] }, features });

const urls = async (c: ReturnType<typeof config>, id = "blog") =>
  (await siteAddresses(c, cwd)).filter((a) => a.feature.id === id).map((a) => a.url);

describe("publishing and related posts", () => {
  test("a draft or a future post is not published", () => {
    const now = new Date("2026-06-01");
    expect(isPublished({ draft: false, date: new Date("2026-05-31") }, now)).toBe(true);
    expect(isPublished({ draft: true, date: new Date("2026-05-31") }, now)).toBe(false);
    expect(isPublished({ draft: false, date: new Date("2026-06-02") }, now)).toBe(false);
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

describe("blog()", () => {
  test("wrong options stop with their name", () => {
    const cats = [
      { id: "a", label: "A" },
      { id: "a", label: "B" },
    ];
    expect(() => blog({ categories: cats })).toThrow(/duplicate category id "a"/);
    expect(() => blog({ perPages: 3 } as never)).toThrow(/blog\(\)/);
  });

  test("offers a translated link and its feed", () => {
    expect(linkCatalog(config(blog()), "ru").map((l) => [l.id, l.title, l.url])).toEqual([
      ["blog", "Блог", "/ru/blog"],
      ["blog:rss", "RSS", "/ru/blog/rss.xml"],
    ]);
  });

  test("a page and a social image per published post, a list, a feed and a search", async () => {
    write("en", "hello", "date: 2026-01-02");
    write("en", "draft", "date: 2026-01-02\ndraft: true");
    write("en", "later", "date: 2999-01-01");
    const all = await urls(config(blog()));
    expect(all).toEqual(
      expect.arrayContaining([
        "/en/blog",
        "/en/blog/hello",
        "/en/blog/og/hello.png",
        "/en/blog/rss.xml",
        // not translated: shown in the default language
        "/ru/blog/hello",
      ]),
    );
    expect(all.filter((u) => /draft|later/.test(u))).toEqual([]);
  });

  test("an unknown category or author stops with the file named", async () => {
    write("en", "hello", "date: 2026-01-02\ncategories: [nope]");
    await expect(urls(config(blog()))).rejects.toThrow(
      /content\/en\/blog\/hello\.mdx.*unknown category "nope"/s,
    );
  });

  test("the list is newest first, with the posts as the pages show them", async () => {
    write("en", "old", "date: 2026-01-01\ntags: [a]");
    write("en", "new", "date: 2026-02-01");
    const c = config(blog());
    const feature = c.features[0] as ReturnType<typeof blog>;
    const list = feature.pages["/"];
    if (list?.kind !== "page" || !list.load) throw new Error("no list");
    const data = (await list.load(createLoadContext({ config: c, feature, lang: "en", cwd }))) as {
      posts: BlogPost[];
      rss?: string;
    };
    expect(data.posts.map((p) => p.slug)).toEqual(["new", "old"]);
    expect(data.posts[1]).toMatchObject({
      tags: ["a"],
      date: "2026-01-01T00:00:00.000Z",
      readingTime: 1,
    });
    expect(data.rss).toBe("/en/blog/rss.xml");
  });

  test("a post shows its text and the posts around it", async () => {
    write("en", "a", "date: 2026-01-01\ntags: [x]");
    write("en", "b", "date: 2026-01-02\ntags: [x]");
    const c = config(blog());
    const feature = c.features[0] as ReturnType<typeof blog>;
    const context = createLoadContext({
      config: c,
      feature,
      lang: "en",
      cwd,
      params: { slug: "a" },
    });
    const entry = (await context.content.entry("a")) as EntryPage;
    const page = feature.pages["/:slug"];
    if (page?.kind !== "page" || !page.load) throw new Error("no post page");
    const data = (await page.load({ ...context, entry })) as {
      code: string;
      related: BlogPost[];
      share?: string;
    };
    expect(data.code).toContain("Some text.");
    expect(data.related.map((p) => p.slug)).toEqual(["b"]);
    expect(data.share).toBe("https://d.example/en/blog/a");
  });

  test("a second blog reads its own folder", async () => {
    write("en", "one", "date: 2026-01-01", "news");
    const c = config(blog(), blog({ id: "news", title: "News" }));
    expect(await urls(c, "news")).toContain("/en/news/one");
    expect(await urls(c, "blog")).not.toContain("/en/blog/one");
  });
});
