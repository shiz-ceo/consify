import type { ComponentType } from "react";
import type { Consify } from "./instance.ts";

/**
 * A link of the top navigation, ready to render: the language is in `url`. A drop-down menu has
 * `items`, and its `url` is the one of its first item (so a header that only knows links still works).
 */
export interface LayoutLink {
  text: string;
  url: string;
  external: boolean;
  /** A few words about the place, shown in menus. */
  description?: string;
  /** The links of a drop-down menu. */
  items?: LayoutLink[];
}

export interface HeaderSlotProps {
  consify: Consify;
  lang: string;
  /** The links of the header: `header.links`, else the main place of every feature. */
  links: LayoutLink[];
}

export interface FooterSlotProps {
  consify: Consify;
  lang: string;
}

/**
 * The parts of the site a project can replace. The header and the footer are described once and
 * every page uses them, so they stay the same across the site (a feature never renders its own
 * footer or chooses how the header looks). Each one comes from `custom/` (`header.tsx`,
 * `footer.tsx`) or from `slots` in `docs.config.ts`; the config wins.
 */
export interface Slots {
  /** The middle of the header, next to the name of the site. Replaces the default links. */
  Header?: ComponentType<HeaderSlotProps>;
  /** The right side of the header, before the search, language and theme controls. */
  HeaderEnd?: ComponentType<HeaderSlotProps>;
  /** The footer of every page. */
  Footer?: ComponentType<FooterSlotProps>;
}

/**
 * Turns the result of `import.meta.glob("/custom/{header,footer}.{tsx,jsx}", { eager: true })`
 * into slots. The default export is the component; `header.tsx` may also export `End` for the right
 * side of the header.
 */
export function slotsFromGlob(modules: Record<string, unknown>): Slots {
  const slots: Slots = {};
  for (const [path, mod] of Object.entries(modules)) {
    const name = /\/(header|footer)\.(?:tsx|jsx)$/.exec(path)?.[1];
    const exports = (mod ?? {}) as { default?: unknown; End?: unknown };
    if (name === "footer" && exports.default)
      slots.Footer = exports.default as Slots["Footer"] & object;
    if (name === "header") {
      if (exports.default) slots.Header = exports.default as Slots["Header"] & object;
      if (exports.End) slots.HeaderEnd = exports.End as Slots["HeaderEnd"] & object;
    }
  }
  return slots;
}
