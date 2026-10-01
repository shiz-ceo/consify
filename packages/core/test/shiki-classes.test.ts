import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { compile } from "@mdx-js/mdx";
import { bundledThemes } from "shiki";
import { defineConfig } from "../src/config/index.ts";
import { recmaHoistPopups } from "../src/mdx/hoist-popups.ts";
import { createMdxPipeline } from "../src/mdx/options.ts";
import { darkColors, lightColors, rehypeShikiClasses } from "../src/mdx/shiki-classes.ts";

async function colorsOf(name: "github-light-high-contrast" | "github-dark-default") {
  const theme = (await bundledThemes[name]()).default as {
    colors?: Record<string, string>;
    tokenColors?: { settings?: { foreground?: string } }[];
  };
  const colors = new Set<string>();
  const add = (color?: string) => color && colors.add(color.toLowerCase());
  add(theme.colors?.["editor.foreground"]);
  for (const rule of theme.tokenColors ?? []) add(rule.settings?.foreground);
  return [...colors];
}

describe("shiki classes", () => {
  test("the lists are the colors of the two themes", async () => {
    expect(lightColors).toEqual(await colorsOf("github-light-high-contrast"));
    expect(darkColors).toEqual(await colorsOf("github-dark-default"));
  });

  test("theme.css has a rule for every color", () => {
    const css = readFileSync(new URL("../src/theme/theme.css", import.meta.url), "utf8").replace(
      /\s+/g,
      "",
    );
    lightColors.forEach((c, i) => expect(css).toContain(`.sl${i}{--shiki-light:${c};}`));
    darkColors.forEach((c, i) => expect(css).toContain(`.sd${i}{--shiki-dark:${c};}`));
  });

  test("a token style becomes classes, another style stays", () => {
    const token = {
      type: "element",
      tagName: "span",
      properties: { style: "--shiki-light:#A0111F;--shiki-dark:#FF7B72" } as Record<
        string,
        unknown
      >,
      children: [],
    };
    const other = {
      type: "element",
      tagName: "span",
      properties: { style: "--shiki-light:#123456;--shiki-dark:#FF7B72" },
      children: [],
    };
    rehypeShikiClasses()({ type: "root", children: [token, other] } as never);
    expect(token.properties).toEqual({ className: ["sl2", "sd2"] });
    expect(other.properties.style).toBe("--shiki-light:#123456;--shiki-dark:#FF7B72");
  });
});

describe("the pipeline", () => {
  test("the tokens of a code block have classes, not styles", async () => {
    const pipeline = createMdxPipeline(defineConfig({ site: { name: "T" } }), process.cwd());
    const code = String(
      await compile("```ts\nconst a = 1;\n```", { outputFormat: "function-body", ...pipeline }),
    );
    expect(code).toMatch(/className: "sl\d sd\d"/);
    // only the block itself keeps its style (the background)
    expect(code.match(/"--shiki-light":/g)).toHaveLength(1);
  });
});

describe("hoisted popups", () => {
  // `Popup` stands for what Twoslash puts in a page: the same hover twice
  const mdx = `<Popup><PopupContent>type A</PopupContent></Popup>\n\n<Popup><PopupContent>type A</PopupContent></Popup>\n\n<Popup><PopupContent>type B</PopupContent></Popup>`;

  test("a repeated popup is made once", async () => {
    const code = String(
      await compile(mdx, { outputFormat: "function-body", recmaPlugins: [recmaHoistPopups] }),
    );
    expect(code.match(/type A/g)).toHaveLength(1);
    expect(code.match(/type B/g)).toHaveLength(1);
    expect(code).toContain("const _popup0 =");
    expect(code.indexOf("const _popup0")).toBeLessThan(code.indexOf("return"));
  });

  test("the page is the same with and without it", async () => {
    const run = (code: string) => {
      const Popup = (p: { children?: unknown }) => p.children;
      const PopupContent = (p: { children?: unknown }) => p.children;
      const jsx = (type: unknown, props: { children?: unknown }) => ({ type, props });
      const body = new Function(code)({ Fragment: "f", jsx, jsxs: jsx });
      return JSON.stringify(body.default({ components: { Popup, PopupContent } }), (_, v) =>
        typeof v === "function" ? v.name : v,
      );
    };
    const plain = String(await compile(mdx, { outputFormat: "function-body" }));
    const hoisted = String(
      await compile(mdx, { outputFormat: "function-body", recmaPlugins: [recmaHoistPopups] }),
    );
    expect(run(hoisted)).toBe(run(plain));
  });
});

describe("shrink", () => {
  test("drops the indent, keeps the backticks of the text", async () => {
    const { shrink } = await import("../src/content/compile.ts");
    expect(shrink('a(\n  "x `y`",\n    b\n)')).toBe('a(\n"x `y`",\nb\n)');
  });

  test("leaves code with a template literal as it is", async () => {
    const { shrink } = await import("../src/content/compile.ts");
    const code = "a(`\n  line\n`)";
    expect(shrink(code)).toBe(code);
  });
});
