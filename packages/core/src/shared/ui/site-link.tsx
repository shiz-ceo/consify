import type { ComponentProps } from "react";
import { Link, useParams } from "react-router";
import { isExternalUrl, resolveHref } from "../links.ts";
import { consify } from "../router.ts";

/**
 * A link in MDX content outside the docs (a post, the home page): `/docs` and other site paths get
 * the language of the page, external links open in a new tab.
 */
export function SiteLink({ href, ...props }: ComponentProps<"a">) {
  const { lang } = useParams();
  const to = href && lang ? resolveHref(consify.config, lang, href) : href;
  const external = to !== undefined && isExternalUrl(to);
  if (to?.startsWith("/") && !external) return <Link to={to} {...(props as object)} />;
  return (
    <a
      href={to}
      {...props}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    />
  );
}
