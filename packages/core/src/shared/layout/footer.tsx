import type { FooterSlotProps } from "../slots.ts";
import { SiteFooter } from "./site-footer.tsx";

/**
 * The footer of a page: the project's own (`custom/footer.tsx` or `slots.footer`) or the default
 * one. Every page asks for it here (`SitePage` and the docs layout), so it is the same everywhere
 * and a feature never has to think about it.
 */
export function Footer(props: FooterSlotProps) {
  const Custom = props.consify.slots.Footer;
  return Custom ? <Custom {...props} /> : <SiteFooter {...props} />;
}
