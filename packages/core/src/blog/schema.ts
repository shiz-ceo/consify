import { z } from "zod";

/** Slugs of categories, authors and tags: lowercase words joined by `-`. */
export const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const id = z.string().regex(idPattern, "must be lowercase letters, digits and `-`");

/**
 * The header (frontmatter) of a post in `content/blog`. Categories and authors must exist in
 * `docs.config.ts` (checked when the site is built), tags are free.
 */
export const postFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  /** Publication date. A post dated in the future is not published until then. */
  date: z.coerce.date(),
  categories: z.array(id).default([]),
  tags: z.array(z.string().min(1)).default([]),
  /** Author ids from `blog.authors`. */
  authors: z.array(id).default([]),
  /** Path of the cover image in `public/`, e.g. `/blog/my-post/cover.png`. */
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  /** A draft is never published. */
  draft: z.boolean().default(false),
});

export type PostFrontmatter = z.output<typeof postFrontmatterSchema>;
export type PostFrontmatterInput = z.input<typeof postFrontmatterSchema>;
