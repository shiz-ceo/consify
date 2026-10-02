// The cards of the links between the entries of a feature: for every entry its title and a short
// text, and for every heading of it the heading and its first paragraph. A page loads this file when
// the pointer is first over a link (`LinkPreviews`). It is made from the text of the files, no MDX is
// compiled: a site with Twoslash would wait minutes for the first card otherwise.
import { structure } from "fumadocs-core/mdx-plugins";
import type { DocsConfig } from "../config/index.ts";
import type { Content, Feature } from "../feature/types.ts";
import { plainText } from "../mdx/structure.ts";
import { readEntries } from "./collection.ts";

/** What the page shows for a link to an entry: `t` the title, `d` a text, `s` its headings. */
export interface PagePreview {
  t: string;
  d?: string;
  /** Heading id → [the heading, its first paragraph]. */
  s?: Record<string, [string, string]>;
}

/** Entry address → its preview. */
export type Previews = Record<string, PagePreview>;

const limit = 180;

/** A text cut to a card: one line, at a word, with an ellipsis. */
export function excerpt(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= limit) return line;
  const cut = line.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}

/** The preview of one entry: its title and description, and every heading with its first paragraph. */
export function previewOf(
  title: string,
  description: string | undefined,
  body: string,
): PagePreview {
  const { headings, contents } = structure(body, [], { stringify: plainText as never }) as {
    headings: { id: string; content: string }[];
    contents: { heading?: string; content: string }[];
  };
  const first = new Map<string | undefined, string>();
  for (const { heading, content } of contents) {
    if (!first.has(heading) && content.trim()) first.set(heading, content);
  }
  const sections: Record<string, [string, string]> = {};
  for (const { id, content } of headings) {
    sections[id] = [excerpt(content), excerpt(first.get(id) ?? "")];
  }
  // a page without a description is told by its first paragraph
  const text = description?.trim() ? excerpt(description) : excerpt(first.get(undefined) ?? "");
  return {
    t: title,
    ...(text ? { d: text } : {}),
    ...(Object.keys(sections).length > 0 ? { s: sections } : {}),
  };
}

/** The cards of the links to the entries of a feature, in the language of `content`. */
export async function previewsResponse(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
): Promise<Response> {
  const previews: Previews = {};
  for (const entry of await readEntries(feature, content, config, lang)) {
    const text = (await content.markdown(entry.path)) ?? "";
    const title = typeof entry.data.title === "string" ? entry.data.title : entry.slug;
    const description =
      typeof entry.data.description === "string" ? entry.data.description : undefined;
    previews[entry.url] = previewOf(title, description, text);
  }
  return Response.json(previews, { headers: { "Cache-Control": "no-cache" } });
}
