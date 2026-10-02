import { describe, expect, test } from "bun:test";
import { excerpt, previewOf } from "../src/content/previews.ts";

describe("excerpt", () => {
  test("a short text is one line", () => {
    expect(excerpt("  a\n  b  ")).toBe("a b");
  });

  test("a long text is cut at a word with an ellipsis", () => {
    const text = "word ".repeat(80);
    const cut = excerpt(text);
    expect(cut.length).toBeLessThanOrEqual(221);
    expect(cut.endsWith("word…")).toBe(true);
  });
});

describe("previewOf", () => {
  const body = [
    "Intro with **bold** and `code`.",
    "",
    "## First section",
    "",
    "Text of the *first* [section](/a).",
    "",
    "More text.",
    "",
    "### Empty one",
    "",
    "## Second",
    "",
    "<Callout>",
    "",
    "Inside a component.",
    "",
    "</Callout>",
  ].join("\n");

  test("the title, the description and the headings with their first paragraph", () => {
    const preview = previewOf("Page", "About the page.", body);
    expect(preview.t).toBe("Page");
    expect(preview.d).toBe("About the page.");
    expect(preview.s?.["first-section"]).toEqual(["First section", "Text of the first section."]);
    expect(preview.s?.["empty-one"]).toEqual(["Empty one", ""]);
    expect(preview.s?.second?.[1]).toBe("Inside a component.");
  });

  test("a page without a description is told by its first paragraph", () => {
    expect(previewOf("Page", undefined, body).d).toBe("Intro with bold and code.");
    expect(previewOf("Page", "  ", body).d).toBe("Intro with bold and code.");
  });

  test("a page without headings has no sections", () => {
    expect(previewOf("P", "d", "Just text.").s).toBeUndefined();
  });
});
