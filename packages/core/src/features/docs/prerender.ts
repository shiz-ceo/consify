import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { PrerenderPaths } from "../types.ts";
import { collectSlugs } from "./slugs.ts";

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, encoding: "utf8" }).map((f) =>
      f.split("\\").join("/"),
    );
  } catch {
    return [];
  }
}

/** Every docs page, its OG image and the llms files, per language. */
export const docsPrerender: PrerenderPaths = (config, cwd) => {
  const { languages } = config.i18n;
  const slugs = collectSlugs(listFiles(join(cwd, "content/docs")), languages);
  const isStatic = config.deploy.mode === "static";
  const paths: string[] = [];

  for (const lang of languages) {
    paths.push(`/${lang}/llms.txt`, `/${lang}/llms-full.txt`);
    // `/{lang}/docs` redirects to the default version. On a server that has to stay a real HTTP
    // redirect (pre-rendering it would give a page with a delayed meta refresh instead).
    if (isStatic || config.versions.default === undefined) paths.push(`/${lang}/docs`);
    for (const slug of slugs) {
      const path = slug.join("/");
      paths.push(`/${lang}/docs${path ? `/${path}` : ""}`);
      if (config.features.og) paths.push(`/${lang}/og/${path ? `${path}/` : ""}image.png`);
    }
  }
  return paths;
};
