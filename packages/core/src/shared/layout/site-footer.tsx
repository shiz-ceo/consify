import { Link } from "react-router";
import { primaryLinks } from "../catalog.ts";
import type { Consify } from "../instance.ts";
import { localized } from "../localized.ts";
import { getMessages } from "../messages.ts";
import { resolveLeaf } from "../nav.ts";
import { SocialIcon, socialLabel } from "./social-icons.tsx";

interface Column {
  title: string;
  links: { title: string; url: string; external: boolean }[];
}

/** The columns from `footer.columns`, or one column with the main places of the features that are on. */
function footerColumns({ config }: Consify, lang: string): Column[] {
  const custom = typeof config.footer === "object" ? config.footer.columns : undefined;
  if (custom) {
    return custom.map((column) => ({
      title: localized(config, lang, column.title) ?? "",
      links: column.links.map((link) => resolveLeaf(config, lang, link)),
    }));
  }

  const links: Column["links"] = primaryLinks(config, lang).map((link) => ({
    title: link.title,
    url: link.url,
    external: link.external ?? false,
  }));
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
function footerData(consify: Consify, lang: string) {
  const { config } = consify;
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
    columns: footerColumns(consify, lang),
  };
}

/**
 * The footer of every page: the name of the site with a short text and social icons on the left,
 * columns of links on the right, the legal line at the bottom. Configured by `footer` in
 * `docs.config.ts`; `footer: false` removes it. The same on every page, full width; a feature never
 * calls it and never chooses how it looks.
 */
export function SiteFooter({ consify, lang }: { consify: Consify; lang: string }) {
  const data = footerData(consify, lang);
  if (!data) return null;
  const { config, footer, description, legal, columns } = data;

  return (
    <footer className="mt-auto border-t border-fd-border" data-consify-footer>
      {/* as wide as the header: the layout width of Fumadocs (97rem), and its padding */}
      <div className="mx-auto w-full max-w-[97rem] px-4 py-12 md:px-6 md:py-16">
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
            <nav aria-label="Footer" className="flex flex-wrap gap-x-16 gap-y-10 lg:justify-end">
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
