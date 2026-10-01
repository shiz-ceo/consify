import { MediaFrame } from "./media.tsx";

/**
 * A video with controls in the frame of the site. `src` and `poster` are paths from `public/` or
 * URLs. It loads only the metadata until the reader presses play.
 *
 * @example
 * <Video src="/demo.mp4" poster="/demo.png" title="Demo" />
 */
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
