import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { index, type RouteConfig, route } from "@react-router/dev/routes";
import type { DocsConfig } from "../../config/index.ts";
import { siteAddresses } from "../../feature/addresses.ts";
import { allFeatures } from "../../feature/builtin.ts";
import { type ContentFileKind, contentFiles } from "../../feature/content-files.ts";
import { routePattern } from "../../feature/paths.ts";
import { generatedDir, header } from "./scaffold.ts";
import { writeIfChanged } from "./write-if-changed.ts";

/** A route module of core: `.tsx`/`.ts` in the sources, `.js` in the published package. */
function builtin(path: string): string {
  const base = fileURLToPath(new URL(`../../builtin/${path}`, import.meta.url));
  const file = [".tsx", ".ts", ".js"].map((ext) => base + ext).find((f) => existsSync(f));
  if (!file) throw new Error(`consify: no route module ${base}`);
  return file;
}

/** The route module of a page: every export comes from the feature, by its id and key. */
export function pageModule(id: string, key: string): string {
  const args = `${JSON.stringify(id)}, ${JSON.stringify(key)}`;
  return `${header}
import { pageComponent, pageHandle, pageMeta } from "@consify/core/runtime";
import { pageLoader } from "@consify/core/runtime/server";

export const handle = pageHandle(${JSON.stringify(id)});
export const loader = pageLoader(${args});
export const meta = pageMeta(${args});
export default pageComponent(${args});
`;
}

/** The route module of a file: only a loader. */
export function fileModule(id: string, key: string): string {
  return `${header}
import { fileLoader } from "@consify/core/runtime/server";

export const loader = fileLoader(${JSON.stringify(id)}, ${JSON.stringify(key)});
`;
}

/** The route module of a file core serves for the content of a feature. */
export function contentFileModule(id: string, kind: ContentFileKind): string {
  return `${header}
import { contentFileLoader } from "@consify/core/runtime/server";

export const loader = contentFileLoader(${JSON.stringify(id)}, ${JSON.stringify(kind)});
`;
}

/**
 * The routes of the site: a small generated module for every page and file of every feature
 * (`.consify/routes/<feature>/<n>.tsx`), and the parts of core (`/` → language, 404, sitemap,
 * robots). A static site cannot have a route with nothing to pre-render, so there a route without
 * any address (a page whose `paths` is empty) is left out. Used by `.consify/app/routes.ts`.
 */
export async function routes(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
): Promise<RouteConfig> {
  const isStatic = config.deploy.mode === "static";
  const present = isStatic
    ? new Set((await siteAddresses(config, cwd)).map((a) => `${a.feature.id}\0${a.key}`))
    : undefined;
  const dir = join(cwd, generatedDir, "routes");

  const list: RouteConfig = [];
  const written = new Set<string>();
  for (const feature of allFeatures(config)) {
    const entries = [
      ...Object.keys(feature.pages).map((key) => ({
        key,
        module: pageModule(feature.id, key),
        ext: "tsx",
      })),
      ...Object.keys(feature.files).map((key) => ({
        key,
        module: fileModule(feature.id, key),
        ext: "ts",
      })),
      ...Object.entries(contentFiles(feature)).map(([key, kind]) => ({
        key,
        module: contentFileModule(feature.id, kind),
        ext: "ts",
      })),
    ];
    for (const [n, entry] of entries.entries()) {
      if (present && !present.has(`${feature.id}\0${entry.key}`)) continue;
      const file = join(dir, feature.id, `${n}.${entry.ext}`);
      writeIfChanged(file, entry.module);
      written.add(file);
      list.push(route(routePattern(feature, entry.key), file));
    }
  }
  // modules of features and pages that are gone
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
      const file = join(entry.parentPath, entry.name);
      if (entry.isFile() && !written.has(file)) rmSync(file);
    }
  }

  return [
    index(builtin("site/routes/root-redirect")),
    ...list,
    route("sitemap.xml", builtin("seo/routes/sitemap")),
    route("robots.txt", builtin("seo/routes/robots")),
    // a static site has no server for a 404 status, and no loader is allowed on a route that is not pre-rendered
    route("*", builtin(isStatic ? "site/routes/not-found-static" : "site/routes/not-found")),
  ];
}
