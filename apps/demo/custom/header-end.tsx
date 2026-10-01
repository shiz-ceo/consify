import type { HeaderSlotProps } from "@consify/core";

/** Extra item on the right side, before the controls. */
export default function HeaderEnd({ consify }: HeaderSlotProps) {
  const repo = consify.config.site.github?.repo;
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
