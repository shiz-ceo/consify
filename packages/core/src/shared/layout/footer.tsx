import type { FooterSlotProps } from "../slots.ts";
import { CompactFooter, FullFooter } from "./site-footer.tsx";

/** The footer that ships with docsivi, for a custom footer to wrap or to fall back to. */
export function DefaultFooter({ docsivi, lang, variant, editUrl }: FooterSlotProps) {
  return variant === "full" ? (
    <FullFooter docsivi={docsivi} lang={lang} />
  ) : (
    <CompactFooter docsivi={docsivi} lang={lang} editUrl={editUrl} />
  );
}

/**
 * The footer of a page: the project's own (`custom/footer.tsx` or `slots.footer`) or the default
 * one. Every page asks for it here, so the footer is the same everywhere.
 */
export function Footer(props: FooterSlotProps) {
  const Custom = props.docsivi.slots.Footer;
  return Custom ? <Custom {...props} /> : <DefaultFooter {...props} />;
}
