import type { ShikiTransformer } from "shiki";

/** `{1,3-5}` → the line numbers 1, 3, 4 and 5. */
export function parseLineRanges(meta: string | undefined): Set<number> {
  const lines = new Set<number>();
  const match = meta ? /\{([\d,\s-]+)\}/.exec(meta) : null;
  for (const part of (match?.[1] ?? "").split(",")) {
    const [from, to] = part.trim().split("-").map(Number);
    if (from === undefined || Number.isNaN(from)) continue;
    const end = to === undefined || Number.isNaN(to) ? from : to;
    for (let n = from; n <= end; n++) lines.add(n);
  }
  return lines;
}

/**
 * Highlights lines listed in the code block header, ```` ```ts {2,4-6} ````. The same class as
 * the `// [!code highlight]` comment, so both are styled alike.
 */
export const transformerLineRanges: ShikiTransformer = {
  name: "consify:line-ranges",
  line(node, line) {
    const raw = (this.options.meta as { __raw?: string } | undefined)?.__raw;
    if (!raw) return;
    if (parseLineRanges(raw).has(line)) this.addClassToHast(node, "highlighted");
  },
};
