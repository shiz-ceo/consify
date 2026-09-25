import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** `home.mdx` and `home.{lang}.mdx` files of `content/`, for the languages of the site. */
export function homeFiles(cwd: string, languages: readonly string[]): string[] {
  try {
    return (
      readdirSync(join(cwd, "content"))
        .filter((file) => {
          const match = /^home(?:\.([a-zA-Z-]+))?\.mdx$/.exec(file);
          return match !== null && (match[1] === undefined || languages.includes(match[1]));
        })
        // the order of a directory listing depends on the file system: keep the output stable
        .sort()
    );
  } catch {
    return [];
  }
}

/** Whether the project has its own home component (`custom/home.tsx` or `.jsx`). */
export function hasCustomHome(cwd: string): boolean {
  return ["tsx", "jsx"].some((ext) => existsSync(join(cwd, `custom/home.${ext}`)));
}
