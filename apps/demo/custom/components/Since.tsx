// <Since version="2.1" /> marks the version a feature appeared in.
export default function Since({ version }: { version: string }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-full border border-fd-border px-2 py-0.5 align-middle text-xs font-medium text-fd-muted-foreground">
      since {version}
    </span>
  );
}
