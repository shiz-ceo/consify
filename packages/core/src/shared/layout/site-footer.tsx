import { Link } from "react-router";
import { enabledFeatures } from "../../features/index.ts";
import type { Docsivi } from "../instance.ts";
import { resolveHref } from "../links.ts";
import { localized } from "../localized.ts";
import { getMessages } from "../messages.ts";
import { SocialIcon, socialLabel } from "./social-icons.tsx";

interface Column {
  title: string;
  links: { title: string; url: string; external: boolean }[];
}

/** The columns from `footer.columns`, or one column with the sections that are on. */
function footerColumns({ config }: Docsivi, lang: string): Column[] {
  const custom = typeof config.footer === "object" ? config.footer.columns : undefined;
  if (custom) {
    return custom.map((column) => ({
      title: localized(config, lang, column.title) ?? "",
      links: column.links.map((link) => ({
        title: localized(config, lang, link.title) ?? link.url,
        url: resolveHref(config, lang, link.url),
        external: link.external ?? /^https?:\/\//.test(link.url),
      })),
    }));
  }

  const links: Column["links"] = enabledFeatures(config).flatMap((feature) => {
    const link = feature.nav?.(config, lang);
    return link ? [{ title: link.text, url: link.url, external: false }] : [];
  });
  for (const item of config.nav) {
    links.push({
      title: item.title,
      url: resolveHref(config, lang, item.url),
      external: item.external ?? /^https?:\/\//.test(item.url),
    });
  }
  if (config.site.github) {
    links.push({
      title: "GitHub",
      url: `https://github.com/${config.site.github.repo}`,
      external: true,
    });
  }
  return links.length > 0 ? [{ title: getMessages(config, lang).footerSections, links }] : [];
}

/** What both footers show: the texts, the social icons and the columns. `undefined` when it is off. */
function footerData(docsivi: Docsivi, lang: string) {
  const { config } = docsivi;
  if (config.footer === false) return undefined;
  const footer = config.footer ?? { social: [] };
  const messages = getMessages(config, lang);
  return {
    config,
    footer,
    description: localized(config, lang, footer.description) ?? config.site.description,
    legal:
      localized(config, lang, footer.legal) ??
      `© ${new Date().getFullYear()} ${config.site.name}. ${messages.footerRights}`,
    columns: footerColumns(docsivi, lang),
  };
}

/**
 * The footer of pages without a sidebar (home, blog, 404): the name of the site with a short text and social icons on the left,
 * columns of links on the right, the legal line at the bottom. Configured by `footer` in
 * `docs.config.ts`; `footer: false` removes it.
 */
export function SiteFooter({ docsivi, lang }: { docsivi: Docsivi; lang: string }) {
  const data = footerData(docsivi, lang);
  if (!data) return null;
  const { config, footer, description, legal, columns } = data;

  return (
    <footer className="mt-auto border-t border-fd-border" data-docsivi-footer>
      <div className="mx-auto w-full max-w-7xl px-6 py-12 md:py-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <Link to={`/${lang}`} className="text-lg font-semibold tracking-tight">
              {config.site.name}
            </Link>
            {description ? (
              <p className="mt-3 text-sm text-fd-muted-foreground">{description}</p>
            ) : null}
            {footer.social.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-4">
                {footer.social.map((item) => (
                  <li key={`${item.type}-${item.url}`}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={socialLabel(item.type)}
                      className="text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                    >
                      <SocialIcon type={item.type} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {columns.length > 0 ? (
            <nav
              aria-label="Footer"
              className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:grid-cols-4"
            >
              {columns.map((column) => (
                <div key={column.title}>
                  <p className="text-sm font-medium">{column.title}</p>
                  <ul className="mt-4 space-y-3">
                    {column.links.map((link) => (
                      <li key={`${link.title}-${link.url}`}>
                        {link.external ? (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                          >
                            {link.title}
                          </a>
                        ) : (
                          <Link
                            to={link.url}
                            className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                          >
                            {link.title}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          ) : null}
        </div>

        <p className="mt-12 border-t border-fd-border pt-6 text-xs text-fd-muted-foreground">
          {legal}
        </p>
      </div>
    </footer>
  );
}

/**
 * A short footer for the docs, aligned with the column of the page instead of the screen: the
 * link to edit the page, the links of the footer in a row, then the legal line with the icons.
 */
export function CompactFooter({
  docsivi,
  lang,
  editUrl,
}: {
  docsivi: Docsivi;
  lang: string;
  editUrl?: string | undefined;
}) {
  const data = footerData(docsivi, lang);
  if (!data && !editUrl) return null;
  const messages = getMessages(docsivi.config, lang);
  const links = (data?.columns ?? []).flatMap((column) => column.links).slice(0, 8);
  const social = data?.footer.social ?? [];
  const linkClass = "text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground";

  return (
    <div className="mt-10 flex flex-col gap-6 border-t border-fd-border pt-8" data-docsivi-footer>
      {editUrl ? (
        <a
          href={editUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-fd-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          <SocialIcon type="github" />
          {messages.editOnGithub}
        </a>
      ) : null}

      {links.length > 0 ? (
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((link) =>
            link.external ? (
              <a
                key={`${link.title}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {link.title}
              </a>
            ) : (
              <Link key={`${link.title}-${link.url}`} to={link.url} className={linkClass}>
                {link.title}
              </Link>
            ),
          )}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <p className="text-xs text-fd-muted-foreground">{data?.legal}</p>
        {social.length > 0 ? (
          <ul className="flex flex-wrap gap-4">
            {social.map((item) => (
              <li key={`${item.type}-${item.url}`}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLabel(item.type)}
                  className="text-fd-muted-foreground transition-colors hover:text-fd-foreground"
                >
                  <SocialIcon type={item.type} />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
