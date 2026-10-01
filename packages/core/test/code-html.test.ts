import { describe, expect, test } from "bun:test";
import { compile } from "@mdx-js/mdx";
import { createElement } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { defineConfig } from "../src/config/index.ts";
import { rehypeCodeHtml } from "../src/mdx/code-html.ts";
import { createMdxPipeline } from "../src/mdx/options.ts";
import { CodeHtml } from "../src/shared/ui/code-html.tsx";

const config = defineConfig({ site: { name: "T" }, mdx: { twoslash: false } });
const source =
  "Text\n\n```ts {2}\nconst a = 1 < 2 && 'x';\nconst b = `t`;\n```\n\n```bash\nls -la\n```\n";

async function render(pipeline: ReturnType<typeof createMdxPipeline>) {
  const code = String(await compile(source, { outputFormat: "function-body", ...pipeline }));
  const Content = (new Function(code)(runtime) as { default: never }).default;
  return renderToStaticMarkup(createElement(Content, { components: { CodeHtml } }));
}

describe("rehypeCodeHtml", () => {
  test("a page looks the same with the lines of a block as HTML", async () => {
    const pipeline = createMdxPipeline(config, process.cwd());
    // the very first highlight of a process can color a token differently than the next ones
    await render(pipeline);
    const withHtml = await render(pipeline);
    const without = await render({
      ...pipeline,
      rehypePlugins: pipeline.rehypePlugins.filter((p) => p !== rehypeCodeHtml),
    });
    // React writes a quote as an entity, the string has it as it is: the same text for the browser
    const quoted = (html: string) => html.replace(/(\s[\w-]+)='([^']*)'/g, '$1="$2"');
    expect(quoted(withHtml)).toBe(without.replaceAll("&#x27;", "'"));
    expect(withHtml).toContain("class='line highlighted'");
    expect(withHtml).toContain(" &lt;</span>");
  });

  test("the compiled code has the lines as one string", async () => {
    const pipeline = createMdxPipeline(config, process.cwd());
    const code = String(await compile(source, { outputFormat: "function-body", ...pipeline }));
    expect(code).toContain("CodeHtml");
    expect(code).toContain("html: \"<span class='line");
    expect(code).not.toContain('children: "const"');
  });

  test("a block with anything but spans stays as it is", () => {
    const code = {
      type: "element",
      tagName: "code",
      properties: {},
      children: [{ type: "element", tagName: "Popup", properties: {}, children: [] }],
    };
    const tree = {
      type: "root",
      children: [{ type: "element", tagName: "pre", properties: {}, children: [code] }],
    };
    rehypeCodeHtml()(tree);
    expect(code.tagName).toBe("code");
  });
});

describe("Twoslash popups", () => {
  const text = (value: string) => ({ type: "text", value });
  const element = (tagName: string, properties: Record<string, unknown>, children: unknown[]) => ({
    type: "element",
    tagName,
    properties,
    children,
  });
  const hover = (name: string, type: string) =>
    element("Popup", {}, [
      element("PopupContent", {}, [element("div", { class: "twoslash" }, [text(type)])]),
      element("PopupTrigger", {}, [text(name)]),
    ]);
  const block = (...children: unknown[]) =>
    element("pre", {}, [element("code", {}, [element("span", { class: "line" }, children)])]);

  test("a hover is a button, the popups of the page are one list without repeats", () => {
    const tree = {
      type: "root",
      children: [block(hover("a", "type A"), hover("b", "type B")), block(hover("c", "type A"))],
    } as {
      type: string;
      children: { children: { tagName: string; properties: Record<string, string> }[] }[];
    };
    rehypeCodeHtml()(tree as never);
    const [first, second, list] = tree.children as never as {
      children: { tagName: string; properties: Record<string, string> }[];
      tagName: string;
      properties: Record<string, string>;
    }[];
    expect(first?.children[0]?.tagName).toBe("CodeHtml");
    const html = first?.children[0]?.properties.html;
    expect(html).toContain("<button type='button' class='twoslash-hover'");
    expect(html).toContain("data-tw='0'>a</button>");
    expect(html).toContain("data-tw='1'>b</button>");
    // the third hover has the popup of the first
    expect(second?.children[0]?.properties.html).toContain("data-tw='0'>c</button>");
    expect(list?.tagName).toBe("TwoslashPopups");
    expect(list?.properties.data?.split("\u0001")).toEqual([
      "<div class='twoslash'>type A</div>",
      "<div class='twoslash'>type B</div>",
    ]);
  });

  test("a hover with a component in its popup leaves the block as it is", () => {
    const popup = element("Popup", {}, [
      element("PopupContent", {}, [element("Callout", {}, [])]),
      element("PopupTrigger", {}, [text("a")]),
    ]);
    const tree = { type: "root", children: [block(popup)] };
    rehypeCodeHtml()(tree as never);
    expect(tree.children).toHaveLength(1);
    expect((tree.children[0] as { children: { tagName: string }[] }).children[0]?.tagName).toBe(
      "code",
    );
  });
});
