export function Video({ src, poster, title }: { src: string; poster?: string; title?: string }) {
  return (
    <video
      className="my-4 w-full rounded-lg border border-fd-border"
      src={src}
      poster={poster}
      title={title}
      controls
      playsInline
      preload="metadata"
    />
  );
}
