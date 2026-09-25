import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { themeToCss } from "../src/theme/tokens.ts";

const base = { site: { name: "D" } };

describe("themeToCss", () => {
  test("empty theme produces no CSS", () => {
    expect(themeToCss(defineConfig(base).theme)).toBe("");
  });

  test("radius and fonts go to :root, dark colors to .dark", () => {
    const { theme } = defineConfig({
      ...base,
      theme: {
        radius: "0.25rem",
        fonts: { sans: "Inter, sans-serif" },
        colors: {
          light: { primary: "oklch(0.5 0.2 250)" },
          dark: { primary: "oklch(0.8 0.1 250)" },
        },
      },
    });
    const css = themeToCss(theme);
    expect(css).toContain(
      ":root{--radius:0.25rem;--consify-font-sans:Inter, sans-serif;--primary:oklch(0.5 0.2 250);}",
    );
    expect(css).toContain(".dark{--primary:oklch(0.8 0.1 250);}");
  });

  test("values that could break out of the style tag are rejected", () => {
    expect(() =>
      defineConfig({ ...base, theme: { colors: { light: { primary: "red;}</style><script>" } } } }),
    ).toThrow(/must not contain/);
    expect(() =>
      defineConfig({ ...base, theme: { colors: { light: { "--primary": "red" } } } }),
    ).toThrow(/without `--`/);
  });
});
