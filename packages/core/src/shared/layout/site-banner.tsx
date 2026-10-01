import { Banner } from "fumadocs-ui/components/banner";
import { Link } from "react-router";
import { isExternalUrl, resolveHref } from "../links.ts";
import { localized } from "../localized.ts";
import { consify } from "../router.ts";

/** A short stable name for a text, so that a new announcement is not hidden by the old one being closed. */
function hash(text: string): string {
  let h = 0;
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** The announcement above the header (`banner` in the config). Closing it is remembered per `id`. */
export function SiteBanner({ lang }: { lang: string }) {
  const { config } = consify;
  const banner = config.banner;
  if (!banner) return null;
  const text = localized(config, lang, banner.text) ?? "";
  const url = banner.href ? resolveHref(config, lang, banner.href) : undefined;
  const id = banner.id ?? `banner-${hash(JSON.stringify(banner.text))}`;
  const content = url ? (
    url.startsWith("/") && !isExternalUrl(url) ? (
      <Link to={url} className="underline underline-offset-4">
        {text}
      </Link>
    ) : (
      <a href={url} className="underline underline-offset-4" rel="noopener noreferrer">
        {text}
      </a>
    )
  ) : (
    text
  );
  return (
    <Banner
      id={id}
      data-consify-banner={banner.variant}
      className={
        banner.variant === "warning"
          ? "bg-yellow-100 text-yellow-950 dark:bg-yellow-950/60 dark:text-yellow-100"
          : ""
      }
    >
      {content}
    </Banner>
  );
}
