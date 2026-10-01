import { contrast, fromOklch, mix, parseHex, readableOn, toHex, toOklch } from "./color.ts";
import { neutral, type Palette, type Preset } from "./presets.ts";

/** Text on a page needs 4.5:1 (WCAG AA); the accent is used as a text color and as a button. */
const target = 4.5;

/** The brand color moved in lightness (its hue and chroma kept) until it reads on `background`. */
function readableBrand(brand: string, background: string, direction: "darker" | "lighter"): string {
  const start = toOklch(parseHex(brand));
  for (let step = 0; step <= 80; step++) {
    const l = start.l + (direction === "lighter" ? 1 : -1) * step * 0.01;
    const candidate = toHex(fromOklch({ ...start, l: Math.min(1, Math.max(0, l)) }));
    if (contrast(candidate, background) >= target) return candidate;
  }
  return direction === "lighter" ? "#ffffff" : "#000000";
}

/** The accent tokens of one color scheme for a brand color, on top of `base`'s background. */
export function brandPalette(
  brand: string,
  base: Palette,
  scheme: "light" | "dark",
): Partial<Palette> {
  const primary = readableBrand(brand, base.background, scheme === "light" ? "darker" : "lighter");
  return {
    primary,
    primaryForeground: readableOn(primary),
    // hover and selected backgrounds: the page color tinted with the brand
    accent: mix(base.background, primary, scheme === "light" ? 0.1 : 0.18),
    ring: primary,
  };
}

/** The palettes a brand color adds to a preset (or to the neutral colors when there is none). */
export function withBrand(brand: string, preset: Preset = neutral): Preset {
  return {
    ...preset,
    light: { ...preset.light, ...brandPalette(brand, preset.light, "light") },
    dark: { ...preset.dark, ...brandPalette(brand, preset.dark, "dark") },
  };
}
