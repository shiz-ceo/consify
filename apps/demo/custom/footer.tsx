import type { FooterSlotProps } from "consify";
import { DefaultFooter } from "consify/components";

/**
 * The footer of every page. `variant` is `full` on the home page and the blog, `compact` in the
 * docs and the API reference. The default footer is reused, with one line added to the full one.
 */
export default function Footer(props: FooterSlotProps) {
  return (
    <>
      <DefaultFooter {...props} />
      {props.variant === "full" ? (
        <p className="border-t border-fd-border py-4 text-center text-xs text-fd-muted-foreground">
          Made with consify · <span className="text-emerald-500">●</span> All systems operational
        </p>
      ) : null}
    </>
  );
}
