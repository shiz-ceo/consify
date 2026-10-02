import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { inline } from "../src/shared/ui/inline-marks.tsx";
import { highlight } from "../src/shared/ui/type-highlight.tsx";

const html = (text: string) => renderToStaticMarkup(createElement("p", null, inline(text)));
const marked = (text: string) => renderToStaticMarkup(createElement("p", null, highlight(text)));

describe("a text of a type table", () => {
  test("code, bold, italic, strike and a link are made", () => {
    expect(html("Use `{ domain: false }` for a **hard** *soft* ~~old~~ [doc](/a).")).toBe(
      '<p>Use <code>{ domain: false }</code> for a <strong>hard</strong> <em>soft</em> <del>old</del> <a href="/a">doc</a>.</p>',
    );
  });

  test("the underscore forms, a title of a link and an address in brackets", () => {
    expect(html('__bold__ and _italic_ and [x](/a "A title") and <https://e.com/a>')).toBe(
      '<p><strong>bold</strong> and <em>italic</em> and <a href="/a" title="A title">x</a> and <a href="https://e.com/a">https://e.com/a</a></p>',
    );
  });

  test("the marks nest, but not inside code", () => {
    expect(html("**bold `code` and *italic***")).toContain("<strong>bold <code>code</code> and");
    expect(html("[*a link*](/a)")).toBe('<p><a href="/a"><em>a link</em></a></p>');
    expect(html("`**not bold**`")).toBe("<p><code>**not bold**</code></p>");
    expect(html("*italic with **bold** inside*")).toBe(
      "<p><em>italic with <strong>bold</strong> inside</em></p>",
    );
    expect(html("***both***")).toBe("<p><strong><em>both</em></strong></p>");
  });

  test("a backslash shows the mark", () => {
    expect(html("2 \\* 3 and \\`tick\\`")).toBe("<p>2 * 3 and `tick`</p>");
  });

  test("a text without marks, and a lone backtick or star, stay as they are", () => {
    expect(html("plain text")).toBe("<p>plain text</p>");
    expect(html("5 * 3 and a ` tick and snake_case_name")).toBe(
      "<p>5 * 3 and a ` tick and snake_case_name</p>",
    );
  });

  test("something that is not a string is not touched", () => {
    const node = createElement("b", null, "x");
    expect(inline(node)).toBe(node);
    expect(inline(undefined)).toBeUndefined();
  });
});

describe("the color of a type", () => {
  test("the built-in types, the names of types, strings and numbers have a color", () => {
    const out = marked('Promise<number | "none"> | undefined');
    expect(out).toContain('<span class="consify-tk sl4 sd4">Promise</span>');
    expect(out).toContain('<span class="consify-tk sl3 sd3">number</span>');
    expect(out).toContain('<span class="consify-tk sl7 sd7">&quot;none&quot;</span>');
    expect(out).toContain('<span class="consify-tk sl3 sd3">undefined</span>');
    expect(marked("100")).toBe('<p><span class="consify-tk sl3 sd3">100</span></p>');
  });

  test("a property and a parameter keep the color of the text", () => {
    const out = marked("(job: Job<Data>, window?: Date) => void");
    expect(out).toContain("(job: <span");
    expect(out).not.toContain(">job<");
    expect(out).not.toContain(">window<");
    expect(out).toContain('<span class="consify-tk sl2 sd2">=&gt;</span>');
  });

  test("the text is the same with and without the color", () => {
    const text = "{ start: Date; used: number } | (() => string)";
    expect(
      marked(text)
        .replace(/<[^>]+>/g, "")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
    ).toBe(`<p>${text}</p>`.replace(/<\/?p>/g, ""));
  });
});
