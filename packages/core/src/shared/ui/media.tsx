import type { ComponentProps, ReactNode } from "react";

/**
 * A thin translucent border laid over the media (like Liveblocks does). It is not a solid color,
 * so it takes the tint of whatever is under it: dark on a dark edge, blue on a blue one. It works
 * the same for images, GIFs and videos, and needs no script.
 */
export function MediaFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`consify-media relative block w-fit max-w-full rounded-xl ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="consify-media-border pointer-events-none absolute inset-0 rounded-[inherit]"
      />
    </span>
  );
}

/** Replaces `<img>` in MDX. `<img plain />` keeps the plain image. */
export function MdxImage({
  plain,
  className = "",
  alt = "",
  ...props
}: ComponentProps<"img"> & { plain?: boolean }) {
  // fills the column, unless the author gave a size (icons, logos)
  const sized = props.width !== undefined;
  const image = (
    <img
      alt={alt}
      loading="lazy"
      decoding="async"
      {...props}
      className={`block h-auto max-w-full rounded-[inherit] ${sized ? "" : "w-full"} ${className}`}
    />
  );
  return plain ? (
    image
  ) : (
    <MediaFrame className={`my-6 ${sized ? "" : "w-full"}`}>{image}</MediaFrame>
  );
}

/** Replaces `<video>` in MDX. */
export function MdxVideo({
  plain,
  className = "",
  ...props
}: ComponentProps<"video"> & { plain?: boolean }) {
  const video = (
    <video
      playsInline
      {...props}
      className={`block h-auto w-full max-w-full rounded-[inherit] ${className}`}
    />
  );
  return plain ? video : <MediaFrame className="my-6 w-full">{video}</MediaFrame>;
}
