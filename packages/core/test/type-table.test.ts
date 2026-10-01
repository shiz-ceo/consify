import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { inline } from "../src/shared/ui/type-table.tsx";

const html = (text: string) => renderToStaticMarkup(createElement("p", null, inline(text)));

describe("a text of a type table", () => {
  test("code, bold, italic and a link are made", () => {
    expect(html("Use `{ domain: false }` for a **hard** *soft* [doc](/a).")).toBe(
      '<p>Use <code>{ domain: false }</code> for a <strong>hard</strong> <em>soft</em> <a href="/a">doc</a>.</p>',
    );
  });

  test("a text without marks, and a lone backtick or star, stay as they are", () => {
    expect(html("plain text")).toBe("<p>plain text</p>");
    expect(html("5 * 3 and a ` tick")).toBe("<p>5 * 3 and a ` tick</p>");
  });

  test("something that is not a string is not touched", () => {
    const node = createElement("b", null, "x");
    expect(inline(node)).toBe(node);
    expect(inline(undefined)).toBeUndefined();
  });
});
