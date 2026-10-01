import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { withBrand } from "../src/theme/brand.ts";
import { contrast, fromOklch, mix, parseHex, toHex, toOklch } from "../src/theme/color.ts";
import { type Palette, presetNames, presets, tokensOf } from "../src/theme/presets.ts";
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

describe("color math", () => {
  test("hex, OKLCH and back", () => {
    for (const hex of ["#0ea5e9", "#7c2d12", "#ffffff", "#000000", "#15803d", "#a78bfa"]) {
      expect(toHex(fromOklch(toOklch(parseHex(hex))))).toBe(hex);
    }
    expect(toHex(parseHex("#abc"))).toBe("#aabbcc");
    expect(() => parseHex("blue")).toThrow(/hex color/);
  });

  test("contrast is the WCAG ratio", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
  });

  test("a mix is between its colors", () => {
    expect(mix("#ffffff", "#000000", 0)).toBe("#ffffff");
    expect(mix("#ffffff", "#000000", 1)).toBe("#000000");
    const middle = toOklch(parseHex(mix("#ffffff", "#000000", 0.5)));
    expect(middle.l).toBeGreaterThan(0.4);
    expect(middle.l).toBeLessThan(0.8);
  });
});

/** The pairs that carry text must pass WCAG AA (4.5:1). */
function textPairs(p: Palette): [string, string, string][] {
  return [
    ["text on the page", p.foreground, p.background],
    ["text on a card", p.foreground, p.card],
    ["muted text on the page", p.mutedForeground, p.background],
    ["muted text on a card", p.mutedForeground, p.card],
    ["text on a hover background", p.foreground, p.accent],
    ["link or accent on the page", p.primary, p.background],
    ["text on a button", p.primaryForeground, p.primary],
  ];
}

describe("presets", () => {
  test("the names are the ones documented", () => {
    expect([...presetNames]).toEqual([
      "neutral",
      "ocean",
      "forest",
      "sunset",
      "violet",
      "paper",
      "mono",
    ]);
  });

  for (const name of presetNames) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${name} (${scheme}): every text pair has a contrast of 4.5 or more`, () => {
        const palette = presets[name][scheme];
        const failing = textPairs(palette)
          .filter(([, fg, bg]) => contrast(fg, bg) < 4.5)
          .map(([what, fg, bg]) => `${what}: ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}`);
        expect(failing).toEqual([]);
      });
    }
  }

  test("a preset gives every token the stylesheet knows", () => {
    const tokens = Object.keys(tokensOf(presets.ocean.light));
    for (const token of ["background", "primary", "ring", "sidebar-accent", "sidebar-border"]) {
      expect(tokens).toContain(token);
    }
  });

  test("no preset means the stylesheet as it is, `neutral` too", () => {
    expect(themeToCss(defineConfig(base).theme)).toBe("");
    expect(themeToCss(defineConfig({ ...base, theme: { preset: "neutral" } }).theme)).toBe("");
  });

  test("a preset is applied to both schemes, with its radius and font", () => {
    const css = themeToCss(defineConfig({ ...base, theme: { preset: "paper" } }).theme);
    expect(css).toContain(":root{--radius:0.25rem;--consify-font-sans:ui-serif");
    expect(css).toContain("--background:#fbf8f1");
    expect(css).toContain(".dark{--background:#1b1813");
  });

  test("what the project sets wins over the preset", () => {
    const css = themeToCss(
      defineConfig({
        ...base,
        theme: {
          preset: "paper",
          radius: "1rem",
          colors: { light: { primary: "#123456" } },
        },
      }).theme,
    );
    expect(css).toContain("--radius:1rem");
    expect(css).not.toContain("--radius:0.25rem");
    expect(css).toMatch(/--primary:#123456;/);
    expect(css).not.toContain("--primary:#7c2d12");
  });

  test("an unknown preset or a brand that is not a hex color is rejected", () => {
    expect(() => defineConfig({ ...base, theme: { preset: "neon" } } as never)).toThrow();
    expect(() => defineConfig({ ...base, theme: { brand: "blue" } })).toThrow(/hex color/);
  });
});

describe("brand", () => {
  const colors = [
    "#0ea5e9",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#facc15",
    "#fde047",
    "#111827",
    "#0000ff",
    "#ffff00",
    "#00ff00",
    "#ff00ff",
    "#808080",
    "#ffffff",
    "#000000",
    "#123",
    "#fb923c",
    "#1e3a8a",
  ];

  for (const brand of colors) {
    test(`${brand}: readable text pairs in both schemes, on the neutral and a preset`, () => {
      for (const preset of [undefined, presets.paper, presets.ocean]) {
        const result = withBrand(brand, preset);
        for (const scheme of ["light", "dark"] as const) {
          const failing = textPairs(result[scheme]).filter(([, fg, bg]) => contrast(fg, bg) < 4.5);
          expect(failing).toEqual([]);
        }
      }
    });
  }

  test("a brand that already reads is kept, one that does not is darkened (light) or lightened (dark)", () => {
    const light = withBrand("#15803d").light.primary;
    expect(light).toBe("#15803d");
    const yellow = withBrand("#facc15");
    expect(toOklch(parseHex(yellow.light.primary)).l).toBeLessThan(toOklch(parseHex("#facc15")).l);
    const navy = withBrand("#1e3a8a");
    expect(toOklch(parseHex(navy.dark.primary)).l).toBeGreaterThan(toOklch(parseHex("#1e3a8a")).l);
  });

  test("the css has the brand tokens and leaves the rest to the preset", () => {
    const css = themeToCss(defineConfig({ ...base, theme: { brand: "#0ea5e9" } }).theme);
    expect(css).toMatch(/:root\{[^}]*--primary:#/);
    expect(css).toMatch(/\.dark\{[^}]*--ring:#/);
    // the brand tints the hover background, the rest of the palette is the neutral one
    expect(css).toContain("--background:#ffffff");
  });
});
