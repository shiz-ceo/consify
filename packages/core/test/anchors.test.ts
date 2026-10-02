import { describe, expect, test } from "bun:test";
import {
  type AnchorsConfig,
  type AnchorsInput,
  anchorRules,
  checkAnchors,
  headingsOf,
  idsOf,
  linksOf,
  resolveLink,
  transliterate,
  validId,
} from "../src/content/anchors.ts";

describe("headings", () => {
  const source = [
    "# Title",
    "",
    "## Быстрый путь [#quick-start]",
    "",
    "```md",
    "## not a heading",
    "```",
    "",
    "### `client.supportsTransactions`",
    "### Setup",
    "### Setup",
    "## Closed ##",
  ].join("\n");

  test("the headings of a file, not those in code, with the id that is written", () => {
    const found = headingsOf(source);
    expect(found.map((h) => [h.depth, h.text, h.explicit, h.line])).toEqual([
      [1, "Title", undefined, 1],
      [2, "Быстрый путь", "quick-start", 3],
      [3, "`client.supportsTransactions`", undefined, 9],
      [3, "Setup", undefined, 10],
      [3, "Setup", undefined, 11],
      [2, "Closed", undefined, 12],
    ]);
  });

  test("the ids are those of the page: written, or made of the text, repeats numbered", () => {
    expect(idsOf(source).map((e) => [e.id, e.explicit])).toEqual([
      ["title", false],
      ["quick-start", true],
      ["clientsupportstransactions", false],
      ["setup", false],
      ["setup-1", false],
      ["closed", false],
    ]);
  });
});

describe("links", () => {
  test("a link goes to a page and an id", () => {
    expect(resolveLink("./b.mdx#intro", "docs/a.mdx")).toEqual({
      path: "docs/b.mdx",
      hash: "intro",
    });
    expect(resolveLink("../x/y.mdx#z", "docs/a/b.mdx")).toEqual({
      path: "docs/x/y.mdx",
      hash: "z",
    });
    expect(resolveLink("#top", "docs/a.mdx")).toEqual({ path: "docs/a.mdx", hash: "top" });
    expect(resolveLink("./b.mdx#%D0%B0", "a.mdx")?.hash).toBe("а");
  });

  test("another site, an address, a page without an id and a file are not such links", () => {
    expect(resolveLink("https://e.com/a#b", "a.mdx")).toBeUndefined();
    expect(resolveLink("/en/docs/a#b", "a.mdx")).toBeUndefined();
    expect(resolveLink("./b.mdx", "a.mdx")).toBeUndefined();
    expect(resolveLink("./b.png#x", "a.mdx")).toBeUndefined();
    expect(resolveLink("../../up.mdx#x", "a.mdx")).toBeUndefined();
  });

  test("links in code are not links", () => {
    const text = [
      "See [a](./b.mdx#one) and `[x](./c.mdx#two)`.",
      "```",
      "[y](./d.mdx#three)",
      "```",
    ].join("\n");
    expect(linksOf(text, "a.mdx").map((l) => l.hash)).toEqual(["one"]);
  });
});

describe("transliterate", () => {
  test("Cyrillic is English letters, short, with no empty words", () => {
    expect(transliterate("Быстрый путь")).toBe("bystryy-put");
    expect(transliterate("Что предполагается")).toBe("chto-predpolagaetsya");
    expect(transliterate("Перевести деньги между счетами")).toBe("perevesti-dengi-mezhdu-schetami");
    expect(transliterate("`client.transaction` и сессии")).toBe("clienttransaction-i-sessii");
  });

  test("other scripts and signs cannot be an id", () => {
    expect(transliterate("快速开始")).toBeUndefined();
    expect(transliterate("???")).toBeUndefined();
  });
});

describe("the id", () => {
  test("lowercase English words and digits, joined by - or .", () => {
    for (const id of ["quick-start", "model.find", "v2", "client.transaction.start", "a1-b2"]) {
      expect(validId.test(id)).toBe(true);
    }
    for (const id of ["Quick", "быстрый", "a_b", "a..b", ".a", "a.", "a--b", "a b", "-a"]) {
      expect(validId.test(id)).toBe(false);
    }
  });
});

describe("anchorRules", () => {
  test("off, the defaults and a rule of its own", () => {
    expect(anchorRules(false)).toBeUndefined();
    expect(anchorRules(true)).toEqual({
      missing: "error",
      unknown: "error",
      unused: "warn",
      translated: "warn",
      links: "error",
    });
    expect(anchorRules({ unused: "off" })?.unused).toBe("off");
  });
});

describe("checkAnchors", () => {
  const config: AnchorsConfig = {
    scope: (path) => (path.startsWith("v1/") ? "v1" : ""),
    ...(anchorRules(true) as NonNullable<ReturnType<typeof anchorRules>>),
  };
  const input = (over: Partial<AnchorsInput>): AnchorsInput => ({
    defaultLanguage: "ru",
    config,
    pages: [],
    registries: new Map([["v1", { "a.mdx": ["intro", "setup"], "b.mdx": ["start"] }]]),
    ...over,
  });
  const page = (lang: string, path: string, text: string) => ({ lang, path, text });
  const ok = [
    page("ru", "v1/a.mdx", "## Введение [#intro]\n\n## Настройка [#setup]\n"),
    page("ru", "v1/b.mdx", "## Старт [#start]\n\nSee [a](./a.mdx#setup).\n"),
    page("en", "v1/a.mdx", "## Intro [#intro]\n\n## Setup [#setup]\n"),
  ];

  test("everything agrees: nothing to say", () => {
    expect(checkAnchors(input({ pages: ok }))).toEqual([]);
  });

  test("a heading with no id of its own, in a language that is not Latin, is an error", () => {
    const found = checkAnchors(
      input({ pages: [page("ru", "v1/a.mdx", "## Введение [#intro]\n\n## Настройка\n")] }),
    );
    expect(found.some((d) => d.level === "error" && d.message.includes("no id of its own"))).toBe(
      true,
    );
  });

  test("an id that is not in the registry is an error, a bad format too, a repeat too", () => {
    const found = checkAnchors(
      input({
        pages: [
          page("ru", "v1/a.mdx", "## A [#intro]\n## B [#New-Id]\n## C [#intro]\n## D [#extra]\n"),
        ],
      }),
    );
    const messages = found.map((d) => d.message).join("\n");
    expect(messages).toContain('"New-Id" is not lowercase');
    expect(messages).toContain('"intro" is used twice');
    expect(messages).toContain('"extra" is not in anchors.json');
    expect(found.filter((d) => d.level === "error").length).toBe(3);
  });

  test("an id of the registry that the page lost is a warning, and so is one a translation lacks", () => {
    const found = checkAnchors(
      input({
        pages: [
          page("ru", "v1/a.mdx", "## Введение [#intro]\n"),
          page("ru", "v1/b.mdx", "## Старт [#start]\n"),
          page("en", "v1/b.mdx", "## Begin\n"),
        ],
      }),
    );
    const warnings = found.filter((d) => d.level === "warn").map((d) => d.message);
    expect(warnings.some((m) => m.includes('the id "setup" is not on the page any more'))).toBe(
      true,
    );
    expect(warnings.some((m) => m.includes('no heading with the id "start"'))).toBe(true);
  });

  test("a link to an id that is not in the registry is an error", () => {
    const found = checkAnchors(
      input({
        pages: [...ok, page("ru", "v1/c.mdx", "[x](./a.mdx#missing) [y](./a.mdx#intro)\n")],
      }),
    );
    expect(found.filter((d) => d.message.includes('goes to "missing"')).length).toBe(1);
  });

  test("a version with no registry is said once, and the rules can be off", () => {
    const missing = checkAnchors(input({ pages: ok, registries: new Map() }));
    expect(missing.filter((d) => d.message.includes("no registry")).length).toBe(1);
    const off = checkAnchors(
      input({
        pages: [page("ru", "v1/a.mdx", "## A [#nope]\n")],
        config: { ...config, unknown: "off", unused: "off", translated: "off" },
      }),
    );
    expect(off).toEqual([]);
  });
});
