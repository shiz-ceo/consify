import type { FooterSlotProps } from "@consify/core";
import { SiteFooter } from "@consify/core/components";

/** The footer of every page: the default one, with one line added below it. */
export default function Footer(props: FooterSlotProps) {
  return (
    <>
      <SiteFooter {...props} />
      <p className="border-t border-fd-border py-4 text-center text-xs text-fd-muted-foreground">
        Made with consify · <span className="text-emerald-500">●</span> All systems operational
      </p>
    </>
  );
}
