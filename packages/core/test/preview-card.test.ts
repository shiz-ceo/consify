import { describe, expect, test } from "bun:test";
import { cardFor, previewKey } from "../src/content/preview-card.ts";
import type { Previews } from "../src/content/previews.ts";

const at = { origin: "https://docs.test", pathname: "/en/docs/v1/guide" };

describe("previewKey", () => {
  test("a link to a page of the site, with the slash and the heading", () => {
    expect(previewKey("/en/docs/v1/other/", at, "")).toEqual({
      path: "/en/docs/v1/other",
      hash: "",
    });
    expect(previewKey("/en/docs/v1/other#setup", at, "")).toEqual({
      path: "/en/docs/v1/other",
      hash: "setup",
    });
    expect(previewKey("../v2/x", at, "")?.path).toBe("/en/docs/v2/x");
    expect(previewKey("#top", at, "")).toEqual({ path: "/en/docs/v1/guide", hash: "top" });
    expect(previewKey("https://docs.test/en/docs/a", at, "")?.path).toBe("/en/docs/a");
  });

  test("another site, a mail address and a file are not pages", () => {
    expect(previewKey("https://example.com/en/docs/a", at, "")).toBeNull();
    expect(previewKey("mailto:a@b.c", at, "")).toBeNull();
    expect(previewKey("tel:123", at, "")).toBeNull();
  });

  test("the basePath is not a part of the address of the entry", () => {
    const base = { origin: "https://docs.test", pathname: "/site/en/docs/guide" };
    expect(previewKey("/site/en/docs/other", base, "/site")?.path).toBe("/en/docs/other");
    expect(previewKey("/en/docs/other", base, "/site")).toBeNull();
  });

  test("an address that is not well formed has no card", () => {
    expect(previewKey("/en/docs/%E0%A4%A", at, "")).toBeNull();
  });
});

describe("cardFor", () => {
  const previews: Previews = {
    "/en/docs/a": {
      t: "Page A",
      d: "About A.",
      s: { setup: ["Setup", "How to set up."], bare: ["Bare", ""] },
    },
    "/en/docs/guide": { t: "Guide", s: { x: ["Heading X", "Text X."] } },
  };

  test("a page: its title and description", () => {
    expect(cardFor(previews, { path: "/en/docs/a", hash: "" }, "/en/docs/guide")).toEqual({
      title: "Page A",
      text: "About A.",
      page: "",
    });
  });

  test("a heading: the heading, its paragraph and the page", () => {
    expect(cardFor(previews, { path: "/en/docs/a", hash: "setup" }, "/en/docs/guide")).toEqual({
      title: "Setup",
      text: "How to set up.",
      page: "Page A",
    });
  });

  test("a heading that is not known gives the page", () => {
    expect(cardFor(previews, { path: "/en/docs/a", hash: "nope" }, "/en/docs/guide")?.title).toBe(
      "Page A",
    );
  });

  test("nothing for an address that is not an entry, or for the page itself", () => {
    expect(cardFor(previews, { path: "/en/docs/none", hash: "" }, "/en/docs/guide")).toBeNull();
    expect(cardFor(previews, { path: "/en/docs/guide", hash: "" }, "/en/docs/guide/")).toBeNull();
    // but a heading of the page itself is something to show
    expect(cardFor(previews, { path: "/en/docs/guide", hash: "x" }, "/en/docs/guide")?.title).toBe(
      "Heading X",
    );
  });
});
