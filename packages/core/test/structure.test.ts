import { describe, expect, test } from "bun:test";
import { compile } from "@mdx-js/mdx";
import { defineConfig } from "../src/config/index.ts";
import { createMdxPipeline } from "../src/mdx/options.ts";

async function structured(source: string) {
  const pipeline = createMdxPipeline(defineConfig({ site: { name: "T" } }), process.cwd());
  const file = await compile(
    { value: source, path: "page.mdx" },
    { outputFormat: "function-body", ...pipeline },
  );
  return file.data.structuredData as {
    headings: { id: string; content: string }[];
    contents: { heading?: string; content: string }[];
  };
}

describe("the text of a page for the search", () => {
  test("bold and other formatting is plain words", async () => {
    const data = await structured(
      "## Title\n\nSome **bold**, _italic_ and `code` text with a [link](/a).\n",
    );
    expect(data.headings).toEqual([{ id: "title", content: "Title" }]);
    expect(data.contents[0]?.content).toBe("Some bold, italic and code text with a link.");
  });

  test("lists, quotes and components give their text", async () => {
    const data = await structured(
      "## T\n\n> a **quote**\n\n- one\n- **two**\n\n<Callout>\n\ninside *it*\n\n</Callout>\n",
    );
    const text = data.contents.map((c) => c.content).join("\n");
    expect(text).toContain("a quote");
    expect(text).toContain("two");
    expect(text).toContain("inside it");
    expect(text).not.toContain("**");
  });
});
