import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { isPublished, parsePostPath } from "./posts.ts";
import { type PostFrontmatter, postFrontmatterSchema } from "./schema.ts";

export const blogDir = "content/blog";

export interface PostFile {
  /** Path inside `content/blog`, e.g. `hello.ru.mdx`. */
  path: string;
  slug: string;
  /** `undefined` for the file without a language suffix. */
  lang: string | undefined;
  frontmatter: PostFrontmatter;
}

/** The YAML between the first two `---` lines of an MDX file. */
export function readFrontmatter(source: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return match ? parse(match[1] as string) : {};
}

/**
 * Reads the header of every post file. A header that does not match the schema stops the build
 * with a message that names the file, so mistakes are found before the site runs.
 */
export function scanPosts(cwd: string, languages: readonly string[]): PostFile[] {
  const root = join(cwd, blogDir);
  let files: string[];
  try {
    files = readdirSync(root, { recursive: true, encoding: "utf8" }).map((f) =>
      f.split("\\").join("/"),
    );
  } catch {
    return [];
  }

  const posts: PostFile[] = [];
  for (const path of files.sort()) {
    const parsed = parsePostPath(path, languages);
    if (!parsed) continue;
    const result = postFrontmatterSchema.safeParse(
      readFrontmatter(readFileSync(join(root, path), "utf8")),
    );
    if (!result.success) {
      const problems = result.error.issues
        .map((i) => `  - ${i.path.join(".") || "(header)"}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid header in ${blogDir}/${path}:\n${problems}`);
    }
    posts.push({ path, ...parsed, frontmatter: result.data });
  }
  return posts;
}

/**
 * The files that are compiled into the site: no drafts and no posts dated in the future. What is
 * not compiled cannot leak into the browser bundle or the build output.
 * `CONSIFY_DRAFTS=1` includes everything, to preview drafts while writing.
 */
export function publishedFiles(posts: readonly PostFile[], now: Date = new Date()): PostFile[] {
  if (process.env.CONSIFY_DRAFTS === "1") return [...posts];
  return posts.filter((p) => isPublished(p.frontmatter, now));
}

/**
 * Checks the categories and authors that posts use against `docs.config.ts`. Returns the problems
 * (empty when all is well); the build stops on them.
 */
export function checkPosts(
  posts: readonly PostFile[],
  known: { categories: readonly string[]; authors: readonly string[] },
): string[] {
  const problems: string[] = [];
  for (const post of posts) {
    for (const category of post.frontmatter.categories) {
      if (!known.categories.includes(category)) {
        problems.push(
          `${blogDir}/${post.path}: unknown category "${category}" (add it to blog.categories in docs.config.ts)`,
        );
      }
    }
    for (const author of post.frontmatter.authors) {
      if (!known.authors.includes(author)) {
        problems.push(
          `${blogDir}/${post.path}: unknown author "${author}" (add it to blog.authors in docs.config.ts)`,
        );
      }
    }
  }
  return problems;
}
