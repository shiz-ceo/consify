import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { defineFeature } from "../src/feature/define.ts";
import { linkCatalog, linkIds, primaryLinks } from "../src/shared/catalog.ts";
import { resolveHref } from "../src/shared/links.ts";
import { headerItems, isMenu, resolveItems, resolveLeaf } from "../src/shared/nav.ts";

const site = { name: "D" };
const feature = (id: string) =>
  defineFeature({
    id,
    title: id.toUpperCase(),
    description: `About ${id}`,
    messages: { en: { [`${id}Hint`]: `About ${id}` } },
    links: ({ lang }) => [
      { id: `${id}:feed`, title: `${id} feed`, url: `/${lang}/${id}/feed.xml` },
    ],
  });

const shop = feature("shop");
const news = feature("news");
// a feature without a title offers no front page link
const hidden = defineFeature({ id: "hidden" });
const base = { site, i18n: { languages: ["en", "ru"] }, features: [shop, news, hidden] };

describe("the catalog", () => {
  test("lists what the features offer, in their order: the front page of a titled one, then its links", () => {
    const config = defineConfig(base);
    expect(linkIds(config)).toEqual(["shop", "shop:feed", "news", "news:feed"]);
    expect(linkCatalog(config, "ru")[0]?.url).toBe("/ru/shop");
    expect(primaryLinks(config, "en").map((l) => l.id)).toEqual(["shop", "news"]);
  });
});

describe("the header", () => {
  test("without `header.links` it lists the main place of every section", () => {
    const items = headerItems(defineConfig(base), "en");
    expect(items.map((i) => i.title)).toEqual(["SHOP", "NEWS"]);
  });

  test("`header.links` chooses, orders and renames", () => {
    const config = defineConfig({
      ...base,
      header: {
        links: [
          { id: "news", title: { en: "Latest", ru: "Новое" } },
          "shop:feed",
          { title: "Home", url: "/" },
          { title: "GitHub", url: "https://github.com/x", description: "Code" },
        ],
      },
    });
    const en = headerItems(config, "en");
    expect(en.map((i) => i.title)).toEqual(["Latest", "shop feed", "Home", "GitHub"]);
    expect(en[0]).toMatchObject({ url: "/en/news", description: "About news", external: false });
    expect(en[2]).toMatchObject({ url: "/en/", external: false });
    expect(en[3]).toMatchObject({
      url: "https://github.com/x",
      external: true,
      description: "Code",
    });
    expect(headerItems(config, "ru")[0]?.title).toBe("Новое");
  });

  test("a drop-down menu holds links, with descriptions from the features", () => {
    const config = defineConfig({
      ...base,
      header: {
        links: [
          {
            title: { en: "More", ru: "Ещё" },
            items: [
              "shop",
              { id: "news", description: "Own words" },
              { title: "Docs", url: "/docs" },
            ],
          },
        ],
      },
    });
    const [menu] = headerItems(config, "ru");
    expect(menu && isMenu(menu)).toBe(true);
    if (!menu || !isMenu(menu)) return;
    expect(menu.title).toBe("Ещё");
    expect(menu.items.map((i) => [i.title, i.description, i.url])).toEqual([
      ["SHOP", "About shop", "/ru/shop"],
      ["NEWS", "Own words", "/ru/news"],
      ["Docs", undefined, "/ru/docs"],
    ]);
  });
});

describe("ids", () => {
  test("an unknown id stops the config and names the ones that exist", () => {
    expect(() => defineConfig({ ...base, header: { links: ["shp"] } })).toThrow(
      /unknown link "shp" \(available: shop, shop:feed, news, news:feed\)/,
    );
    expect(() =>
      defineConfig({ ...base, header: { links: [{ title: "M", items: ["nope"] }] } }),
    ).toThrow(/unknown link "nope"/);
    expect(() =>
      defineConfig({ ...base, footer: { columns: [{ title: "C", links: ["nope"] }] } }),
    ).toThrow(/unknown link "nope"/);
  });

  test("a link of a feature that is off is unknown", () => {
    expect(() => defineConfig({ ...base, header: { links: ["hidden"] } })).toThrow(/unknown link/);
  });

  test("the footer takes the same links, but no menus", () => {
    const config = defineConfig({
      ...base,
      footer: {
        columns: [{ title: "C", links: ["shop", "news:feed", { title: "X", url: "/x" }] }],
      },
    });
    expect(config.footer).toBeTruthy();
    expect(() =>
      defineConfig({
        ...base,
        footer: { columns: [{ title: "C", links: [{ title: "M", items: ["shop"] }] }] } as never,
      }),
    ).toThrow();
  });

  test("resolveHref takes an id too (buttons of the home page, custom links)", () => {
    const config = defineConfig(base);
    expect(resolveHref(config, "ru", "news:feed")).toBe("/ru/news/feed.xml");
    expect(resolveHref(config, "en", "/x")).toBe("/en/x");
    expect(resolveHref(config, "en", "https://a.b")).toBe("https://a.b");
  });

  test("resolveLeaf and resolveItems agree", () => {
    const config = defineConfig(base);
    expect(resolveItems(config, "en", ["shop"])[0]).toEqual(resolveLeaf(config, "en", "shop"));
  });
});
