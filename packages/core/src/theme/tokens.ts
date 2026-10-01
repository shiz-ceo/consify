import type { DocsConfig } from "../config/index.ts";
import { withBrand } from "./brand.ts";
import { presets, tokensOf } from "./presets.ts";

function declarations(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([name, value]) => `--${name}:${value};`)
    .join("");
}

/**
 * Turns `theme` from `docs.config.ts` into CSS custom properties. Values are validated by the
 * config schema (no `{ } < > ;`), so the result is safe to put in a `<style>` tag.
 * Returns an empty string when nothing is overridden.
 */
export function themeToCss(theme: Readonly<DocsConfig["theme"]>): string {
  // the order, the last wins: the preset, the brand color, what the project sets itself
  const chosen = theme.preset === undefined ? undefined : presets[theme.preset];
  const base = theme.brand === undefined ? chosen : withBrand(theme.brand, chosen);
  // the neutral palette without a brand is what the stylesheet already has
  const palette =
    base && (base !== presets.neutral || theme.brand !== undefined) ? base : undefined;

  const radius = theme.radius ?? palette?.radius;
  const sans = theme.fonts.sans ?? palette?.fonts?.sans;
  const shared: Record<string, string> = {};
  if (radius !== undefined) shared.radius = radius;
  if (sans !== undefined) shared["consify-font-sans"] = sans;
  if (theme.fonts.mono !== undefined) shared["consify-font-mono"] = theme.fonts.mono;

  const rules: string[] = [];
  const light = {
    ...shared,
    ...(palette ? tokensOf(palette.light) : {}),
    ...theme.colors.light,
  };
  const dark = { ...(palette ? tokensOf(palette.dark) : {}), ...theme.colors.dark };
  if (Object.keys(light).length > 0) rules.push(`:root{${declarations(light)}}`);
  if (Object.keys(dark).length > 0) rules.push(`.dark{${declarations(dark)}}`);
  return rules.join("\n");
}
