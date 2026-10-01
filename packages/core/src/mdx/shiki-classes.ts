// Shiki paints every token with an inline `style="--shiki-light:#…;--shiki-dark:#…"`. In compiled MDX
// that is a ~70 byte object per token, and a code-heavy page has tens of thousands of them. The colors
// of the two themes are a short fixed list, so a token gets two short classes instead (`sl3 sd5`),
// and `theme.css` says what they mean.

// the part of the hast tree this plugin uses
interface Element {
  type: string;
  properties?: { style?: unknown; className?: unknown };
  children?: Element[];
}

/** Colors of `github-light-high-contrast`. The index is the number in `sl<n>`; `theme.css` has the same list. */
export const lightColors = [
  "#0e1116",
  "#66707b",
  "#a0111f",
  "#023b95",
  "#702c00",
  "#622cbc",
  "#024c1a",
  "#032563",
  "#6e011a",
  "#ffffff",
  "#e7ecf0",
  "#4b535d",
];

/** Colors of `github-dark-default`. The index is the number in `sd<n>`; `theme.css` has the same list. */
export const darkColors = [
  "#e6edf3",
  "#8b949e",
  "#ff7b72",
  "#79c0ff",
  "#ffa657",
  "#d2a8ff",
  "#7ee787",
  "#a5d6ff",
  "#ffa198",
  "#f0f6fc",
  "#161b22",
];

const tokenStyle = /^--shiki-light:(#[0-9a-f]{6});--shiki-dark:(#[0-9a-f]{6});?$/i;

// not only `element`: Twoslash and the highlighter put whole subtrees in a nested `root`
function visit(node: Element, fn: (element: Element & { properties: object }) => void): void {
  for (const child of node.children ?? []) {
    if (child.properties) fn(child as Element & { properties: object });
    visit(child, fn);
  }
}

/**
 * Rehype plugin: a token style of the two themes becomes the classes `sl<n> sd<n>`. A style with
 * any other color (a plugin's own transformer) is left as it is, so nothing changes in how it looks.
 * Runs after the code highlighter, so it also reaches the Twoslash popups.
 */
export function rehypeShikiClasses() {
  return (tree: Element) => {
    visit(tree, (element) => {
      const style = element.properties.style;
      if (typeof style !== "string") return;
      const match = tokenStyle.exec(style);
      const light = lightColors.indexOf(match?.[1]?.toLowerCase() ?? "");
      const dark = darkColors.indexOf(match?.[2]?.toLowerCase() ?? "");
      if (light < 0 || dark < 0) return;
      // the highlighter writes `class` (a string, an array once a class is added), MDX wants `className`: add to whichever is there
      const props = element.properties as { class?: string | string[]; className?: unknown };
      if (typeof props.class === "string") props.class += ` sl${light} sd${dark}`;
      else if (Array.isArray(props.class)) props.class.push(`sl${light}`, `sd${dark}`);
      else {
        const classes = props.className;
        props.className = [
          ...(Array.isArray(classes) ? classes : classes ? [String(classes)] : []),
          `sl${light}`,
          `sd${dark}`,
        ];
      }
      delete element.properties.style;
    });
  };
}
