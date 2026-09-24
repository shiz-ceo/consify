import { MediaFrame } from "./media.tsx";

export function Video({ src, poster, title }: { src: string; poster?: string; title?: string }) {
  return (
    <MediaFrame className="my-4 w-full">
      <video
        className="block w-full rounded-[inherit]"
        src={src}
        poster={poster}
        title={title}
        controls
        playsInline
        preload="metadata"
      />
    </MediaFrame>
  );
}
