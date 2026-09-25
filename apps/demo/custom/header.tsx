import type { HeaderSlotProps } from "docsivi";
import { Link } from "react-router";

/**
 * The middle of the header. The name of the site on the left and the controls on the right (search,
 * language, theme) are always there. `links` are the links the header shows by default; on a phone
 * the menu keeps them, whatever this component renders.
 */
export default function Header({ links }: HeaderSlotProps) {
  return (
    <>
      {links.map((link) => (
        <Link
          key={link.url}
          to={link.url}
          className="text-sm text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          {link.text}
        </Link>
      ))}
    </>
  );
}

/** Extra item on the right side, before the controls. */
export function End({ docsivi }: HeaderSlotProps) {
  const repo = docsivi.config.site.github?.repo;
  if (!repo) return null;
  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hidden whitespace-nowrap rounded-full border border-fd-border px-3 py-1 text-xs font-medium transition-colors hover:bg-fd-accent md:inline-block"
    >
      ★ Star on GitHub
    </a>
  );
}
