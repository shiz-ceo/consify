import { icons } from "lucide-react";
import type { ComponentProps } from "react";
import { Link } from "react-router";
import { resolveHref } from "../../../shared/links.ts";
import { useHome } from "./context.tsx";

function Anchor({ to, ...props }: { to: string } & ComponentProps<"a">) {
  return /^(https?:)?\/\//.test(to) ? <a href={to} {...props} /> : <Link to={to} {...props} />;
}

export interface HeroProps {
  title: string;
  description?: string | undefined;
  actions?: { label: string; href: string; variant?: "primary" | "secondary" | undefined }[];
}

/** The big heading of a home page with its buttons. Links get the language of the page. */
export function Hero({ title, description, actions = [] }: HeroProps) {
  const { consify, lang } = useHome();
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
            to={resolveHref(consify.config, lang, action.href)}
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
  items: {
    title: string;
    description: string;
    /** Name of a Lucide icon, e.g. `Rocket`. */
    icon?: string | undefined;
    href?: string | undefined;
  }[];
}

/** A grid of cards. */
export function Features({ items }: FeaturesProps) {
  const { consify, lang } = useHome();
  if (items.length === 0) return null;
  return (
    <section className="not-prose grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((feature) => {
        const Icon = feature.icon ? icons[feature.icon as keyof typeof icons] : undefined;
        const body = (
          <>
            {Icon ? <Icon className="mb-3 size-5 text-fd-muted-foreground" /> : null}
            <h3 className="mb-1 font-semibold">{feature.title}</h3>
            <p className="text-sm text-fd-muted-foreground">{feature.description}</p>
          </>
        );
        const className =
          "block rounded-xl border border-fd-border bg-fd-card p-5 text-fd-card-foreground";
        return feature.href ? (
          <Anchor
            key={feature.title}
            to={resolveHref(consify.config, lang, feature.href)}
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
