import type { ComponentType } from "react";
import type { Consify } from "./instance.ts";

/** A link of the top navigation, ready to render: the language is in `url`. */
export interface LayoutLink {
  text: string;
  url: string;
  external: boolean;
}

export interface HeaderSlotProps {
  consify: Consify;
  lang: string;
  /** The links the header shows by default (the sections that are on, then `nav`). */
  links: LayoutLink[];
}

export interface FooterSlotProps {
  consify: Consify;
  lang: string;
  /** `full` on pages without a sidebar, `compact` in the docs and the API reference. */
  variant: "full" | "compact";
  /** Link to edit the page on GitHub, when there is one (docs pages). */
  editUrl?: string | undefined;
}

export interface HomeSlotProps {
  consify: Consify;
  lang: string;
}

/**
 * The parts of the site a project can replace. The header, the footer and the home page are
 * described once and every page uses them, so they stay the same across the site.
 * Each one comes from `custom/` (`home.tsx`, `header.tsx`, `footer.tsx`) or from `slots` in
 * `docs.config.ts`; the config wins.
 */
export interface Slots {
  /** The content of the home page (`/{lang}`), inside the common header and footer. */
  Home?: ComponentType<HomeSlotProps>;
  /** The middle of the header, next to the name of the site. Replaces the default links. */
  Header?: ComponentType<HeaderSlotProps>;
  /** The right side of the header, before the search, language and theme controls. */
  HeaderEnd?: ComponentType<HeaderSlotProps>;
  /** The footer, both variants. */
  Footer?: ComponentType<FooterSlotProps>;
}

/**
 * Turns the result of `import.meta.glob("/custom/{home,header,footer}.{tsx,jsx}", { eager: true })`
 * into slots. The default export is the component; `header.tsx` may also export `End` for the right
 * side of the header.
 */
export function slotsFromGlob(modules: Record<string, unknown>): Slots {
  const slots: Slots = {};
  for (const [path, mod] of Object.entries(modules)) {
    const name = /\/(home|header|footer)\.(?:tsx|jsx)$/.exec(path)?.[1];
    const exports = (mod ?? {}) as { default?: unknown; End?: unknown };
    if (name === "home" && exports.default) slots.Home = exports.default as Slots["Home"] & object;
    if (name === "footer" && exports.default)
      slots.Footer = exports.default as Slots["Footer"] & object;
    if (name === "header") {
      if (exports.default) slots.Header = exports.default as Slots["Header"] & object;
      if (exports.End) slots.HeaderEnd = exports.End as Slots["HeaderEnd"] & object;
    }
  }
  return slots;
}
