import type { FooterSlotProps } from "../slots.ts";
import { CompactFooter, FullFooter } from "./site-footer.tsx";

/** The footer that ships with consify, for a custom footer to wrap or to fall back to. */
export function DefaultFooter({ consify, lang, variant, editUrl }: FooterSlotProps) {
  return variant === "full" ? (
    <FullFooter consify={consify} lang={lang} />
  ) : (
    <CompactFooter consify={consify} lang={lang} editUrl={editUrl} />
  );
}

/**
 * The footer of a page: the project's own (`custom/footer.tsx` or `slots.footer`) or the default
 * one. Every page asks for it here, so the footer is the same everywhere.
 */
export function Footer(props: FooterSlotProps) {
  const Custom = props.consify.slots.Footer;
  return Custom ? <Custom {...props} /> : <DefaultFooter {...props} />;
}
