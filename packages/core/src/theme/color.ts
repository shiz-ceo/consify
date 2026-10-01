/**
 * Color math for the theme: hex ↔ OKLCH (lightness stays even between hues, which is what makes a
 * brand color usable on both a light and a dark page) and the WCAG contrast ratio.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

/** `#rgb` or `#rrggbb` to 0..1 channels. Throws on anything else. */
export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`"${hex}" is not a hex color like #0ea5e9`);
  const value =
    (match[1] as string).length === 3
      ? [...(match[1] as string)].map((c) => c + c).join("")
      : (match[1] as string);
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255,
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

export function toOklch({ r, g, b }: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)] as const;
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}

export function fromOklch({ l: L, c, h }: Oklch): Rgb {
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** Relative luminance of WCAG 2. */
function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio of two hex colors, 1 to 21. Body text needs 4.5 (AA). */
export function contrast(foreground: string, background: string): number {
  const a = luminance(parseHex(foreground));
  const b = luminance(parseHex(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** `first` mixed with `second`, `amount` (0..1) of the second, in OKLab so that the middle is not muddy. */
export function mix(first: string, second: string, amount: number): string {
  const a = toOklch(parseHex(first));
  const b = toOklch(parseHex(second));
  const ax = a.c * Math.cos(a.h);
  const ay = a.c * Math.sin(a.h);
  const bx = b.c * Math.cos(b.h);
  const by = b.c * Math.sin(b.h);
  const x = ax + (bx - ax) * amount;
  const y = ay + (by - ay) * amount;
  return toHex(
    fromOklch({ l: a.l + (b.l - a.l) * amount, c: Math.hypot(x, y), h: Math.atan2(y, x) }),
  );
}

/** Black or white, whichever reads better on `background`. */
export function readableOn(background: string): string {
  return contrast("#ffffff", background) >= contrast("#000000", background) ? "#ffffff" : "#000000";
}
