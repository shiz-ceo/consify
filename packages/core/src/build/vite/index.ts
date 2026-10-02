import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { type Plugin, type PluginOption, searchForWorkspaceRoot } from "vite";
import type { DocsConfig } from "../../config/index.ts";
import { contentDir } from "../../content/files.ts";
import { snippetDirs } from "../../content/snippet-rules.ts";
import { generatedDir, packageDirs, scaffold } from "../router/scaffold.ts";

/**
 * Client dependencies of consify that Vite would otherwise discover one by one while the page
 * loads, re-optimizing and reloading in the middle of the first visit (which breaks hydration).
 * `@consify/core > x` resolves `x` from the consify package, so a project does not have to depend on them.
 */
const prebundle = [
  "fumadocs-core/i18n",
  "fumadocs-core/search/client",
  "fumadocs-core/search/client/fetch",
  "fumadocs-core/search/client/orama-static",
  "fumadocs-twoslash/ui",
  "fumadocs-ui/components/accordion",
  "fumadocs-ui/components/banner",
  "fumadocs-ui/components/callout",
  "fumadocs-ui/components/dialog/search",
  "fumadocs-ui/components/files",
  "fumadocs-ui/components/steps",
  "fumadocs-ui/components/tabs",
  "fumadocs-ui/components/type-table",
  "fumadocs-ui/contexts/i18n",
  "fumadocs-ui/i18n",
  "fumadocs-ui/layouts/notebook",
  "fumadocs-ui/layouts/notebook/page",
  "fumadocs-ui/layouts/notebook/slots/sidebar",
  "fumadocs-ui/layouts/shared/slots/search-trigger",
  "fumadocs-ui/mdx",
  "fumadocs-ui/provider/react-router",
  "lucide-react",
  "lucide-react/dynamic",
  "mermaid",
  "next-themes",
  "zod",
];

/**
 * What the consify packages of the project ask to pre-bundle: `"consify": { "prebundle": [...] }`
 * in their `package.json`, dependencies their pages load in the browser.
 */
function packagePrebundle(dirs: readonly string[]): string[] {
  return dirs.flatMap((dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      name: string;
      consify?: { prebundle?: string[] };
    };
    return (manifest.consify?.prebundle ?? []).map((dep) => `${manifest.name} > ${dep}`);
  });
}

/** The names of the consify packages of the project. */
function packageNames(dirs: readonly string[]): string[] {
  return dirs.map(
    (dir) => (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { name: string }).name,
  );
}

/** Directory of the consify package when it is linked from outside the project (`bun link`). */
function linkedPackageDir(cwd: string): string | undefined {
  try {
    const dir = dirname(
      realpathSync(createRequire(`${cwd}${sep}`).resolve("@consify/core/package.json")),
    );
    return dir === cwd || dir.startsWith(`${cwd}${sep}`) ? undefined : dir;
  } catch {
    return undefined;
  }
}

/**
 * The only Vite plugin a project needs: Tailwind, React Router and the wiring that connects them
 * to `docs.config.ts`.
 *
 * @example
 * import { consify } from "@consify/core/vite";
 * import { defineConfig } from "vite";
 * import config from "./docs.config";
 *
 * export default defineConfig({ plugins: [consify(config)] });
 */
export function consify(config: Readonly<DocsConfig>): PluginOption[] {
  const cwd = process.cwd();
  const snippets = snippetDirs(config);
  scaffold(cwd, snippets);
  const linked = linkedPackageDir(cwd);
  const basePath = config.deploy.basePath;
  // the folders read by the loaders: the content, and the snippets its pages put in place
  const watched = [contentDir, ...snippets].map((dir) => join(cwd, dir));
  const packages = packageDirs(cwd);

  const wiring: Plugin = {
    name: "consify:wiring",
    config: () => ({
      ...(basePath ? { base: `${basePath}/` } : {}),
      resolve: {
        alias: [
          { find: /^consify:instance$/, replacement: join(cwd, generatedDir, "instance.ts") },
          { find: /^consify:content$/, replacement: join(cwd, generatedDir, "content.ts") },
        ],
        // pages come from the consify packages, keep one copy of React
        dedupe: ["react", "react-dom", "react-router"],
      },
      // the consify packages ship TypeScript sources, so Vite has to compile them
      ssr: { noExternal: [/^@consify\//, /^consify-/] },
      optimizeDeps: {
        include: [
          ...prebundle.map((dep) => `@consify/core > ${dep}`),
          ...packagePrebundle(packages),
        ],
        // compiled by Vite like the project, so what only the server needs is left out of the browser
        exclude: packageNames(packages),
      },
      server: {
        fs: {
          allow: [searchForWorkspaceRoot(cwd), cwd, ...(linked ? [linked] : []), ...packages],
        },
      },
    }),
    // content is read by the loaders, not imported: reload the page when a file of it changes (a
    // changed snippet makes the pages that use it compile again, see compileMdx)
    configureServer(server) {
      server.watcher.add(watched);
      const reload = (file: string) => {
        if (watched.some((dir) => file.startsWith(`${dir}${sep}`))) {
          server.ws.send({ type: "full-reload" });
        }
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };

  return [tailwindcss(), reactRouter(), wiring];
}
