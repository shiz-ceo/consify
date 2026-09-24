import { useState } from "react";

const targets = [
  {
    name: "X",
    url: (link: string, title: string) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "LinkedIn",
    url: (link: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`,
  },
  {
    name: "Bluesky",
    url: (link: string, title: string) =>
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${link}`)}`,
  },
];

const button =
  "inline-flex h-8 items-center rounded-full border border-fd-border px-3 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground";

/** Links that open the share window of X, LinkedIn and Bluesky, and a button that copies the link. */
export function ShareButtons({
  link,
  title,
  label,
  copied,
}: {
  link: string;
  title: string;
  label: string;
  copied: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-fd-muted-foreground">{label}</span>
      {targets.map((target) => (
        <a
          key={target.name}
          className={button}
          href={target.url(link, title)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {target.name}
        </a>
      ))}
      <button
        type="button"
        className={button}
        onClick={() => {
          void navigator.clipboard?.writeText(link).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          });
        }}
      >
        {done ? copied : "Link"}
      </button>
    </div>
  );
}
