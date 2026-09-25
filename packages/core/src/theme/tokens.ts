import type { DocsConfig } from "../config/index.ts";

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
  const shared: Record<string, string> = {};
  if (theme.radius !== undefined) shared.radius = theme.radius;
  if (theme.fonts.sans !== undefined) shared["consify-font-sans"] = theme.fonts.sans;
  if (theme.fonts.mono !== undefined) shared["consify-font-mono"] = theme.fonts.mono;

  const rules: string[] = [];
  const light = { ...shared, ...theme.colors.light };
  if (Object.keys(light).length > 0) rules.push(`:root{${declarations(light)}}`);
  if (Object.keys(theme.colors.dark).length > 0) {
    rules.push(`.dark{${declarations(theme.colors.dark)}}`);
  }
  return rules.join("\n");
}
