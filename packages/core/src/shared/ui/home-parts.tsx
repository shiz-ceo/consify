import { DynamicIcon, type IconName, iconNames } from "lucide-react/dynamic";
import type { ComponentProps } from "react";
import { Link, useParams } from "react-router";
import { resolveHref } from "../links.ts";
import { consify } from "../router.ts";

/** The address of a link of the config (`/docs`, an id like `blog`) in the language of the page. */
function useHref(): (href: string) => string {
  const { lang = consify.config.i18n.defaultLanguage } = useParams();
  return (href) => resolveHref(consify.config, lang, href);
}

function Anchor({ to, ...props }: { to: string } & ComponentProps<"a">) {
  return /^(https?:)?\/\//.test(to) ? <a href={to} {...props} /> : <Link to={to} {...props} />;
}

/**
 * `Rocket` / `ArrowRight` / `Trash2` → `rocket` / `arrow-right` / `trash-2`. `DynamicIcon` loads one
 * icon per chunk on demand; `import { icons }` would put all of Lucide into the client bundle.
 */
function iconName(name: string): IconName | undefined {
  const kebab = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .toLowerCase();
  return iconNames.find((known) => known === kebab);
}

// keeps the space of the icon while it loads (and on the server), so the cards do not jump
const iconSpace = () => <span className="mb-3 block size-5" />;

export interface HeroProps {
  /** The big heading. */
  title: string;
  /** A sentence under the heading. */
  description?: string | undefined;
  /** Buttons under the text. `href` is an address or a link id like `"docs"`; `secondary` is an outline button. */
  actions?: { label: string; href: string; variant?: "primary" | "secondary" | undefined }[];
}

/**
 * A big heading with buttons, for a front page. Links get the language of the page.
 *
 * @example
 * <Hero title="Ship docs" description="Fast." actions={[{ label: "Start", href: "docs" }]} />
 */
export function Hero({ title, description, actions = [] }: HeroProps) {
  const href = useHref();
  return (
    <section className="not-prose flex flex-col items-center gap-6 py-6 text-center">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-lg text-fd-muted-foreground text-balance">{description}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        {actions.map((action) => (
          <Anchor
            key={action.href + action.label}
            to={href(action.href)}
            className={
              (action.variant ?? "primary") === "primary"
                ? "rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                : "rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
            }
          >
            {action.label}
          </Anchor>
        ))}
      </div>
    </section>
  );
}

export interface FeaturesProps {
  /** The cards, in order. */
  items: {
    title: string;
    description: string;
    /** Name of a Lucide icon, e.g. `Rocket`. */
    icon?: string | undefined;
    /** Makes the whole card a link: an address or a link id like `"docs"`. */
    href?: string | undefined;
  }[];
}

/**
 * A grid of cards, for a front page.
 *
 * @example
 * <Features items={[{ title: "Fast", description: "Static output.", icon: "Zap" }]} />
 */
export function Features({ items }: FeaturesProps) {
  const href = useHref();
  if (items.length === 0) return null;
  return (
    <section className="not-prose grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((feature) => {
        const icon = feature.icon ? iconName(feature.icon) : undefined;
        const body = (
          <>
            {icon ? (
              <DynamicIcon
                name={icon}
                fallback={iconSpace}
                className="mb-3 size-5 text-fd-muted-foreground"
              />
            ) : null}
            <h3 className="mb-1 font-semibold">{feature.title}</h3>
            <p className="text-sm text-fd-muted-foreground">{feature.description}</p>
          </>
        );
        const className =
          "block rounded-xl border border-fd-border bg-fd-card p-5 text-fd-card-foreground";
        return feature.href ? (
          <Anchor
            key={feature.title}
            to={href(feature.href)}
            className={`${className} transition-colors hover:bg-fd-accent`}
          >
            {body}
          </Anchor>
        ) : (
          <div key={feature.title} className={className}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
