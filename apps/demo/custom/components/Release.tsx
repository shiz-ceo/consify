import type { ReactNode } from "react";

// <Release version="2.1.0" date="2026-08-30">…notes…</Release> for the changelog page.
export default function Release({
  version,
  date,
  children,
}: {
  version: string;
  date: string;
  children: ReactNode;
}) {
  return (
    <section className="my-8 border-l-2 border-fd-border pl-5">
      <div className="mb-2 flex items-baseline gap-3">
        <h3 className="!m-0 text-lg font-semibold">{version}</h3>
        <time className="text-sm text-fd-muted-foreground">{date}</time>
      </div>
      {children}
    </section>
  );
}
