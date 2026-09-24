import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { type Plugin, type PluginOption, searchForWorkspaceRoot } from "vite";
import type { DocsConfig } from "../config/index.ts";
import { createMdxOptions } from "../mdx/options.ts";
import { generatedDir, scaffold } from "../react-router/scaffold.ts";

/** Directory of the docsivi package when it is linked from outside the project (`bun link`). */
function linkedPackageDir(cwd: string): string | undefined {
  try {
    const dir = dirname(
      realpathSync(createRequire(`${cwd}${sep}`).resolve("docsivi/package.json")),
    );
    return dir === cwd || dir.startsWith(`${cwd}${sep}`) ? undefined : dir;
  } catch {
    return undefined;
  }
}

/**
 * The only Vite plugin a project needs: MDX (Fumadocs), Tailwind, React Router and the wiring that
 * connects them to `docs.config.ts`.
 *
 * @example
 * import { docsivi } from "docsivi/vite";
 * import { defineConfig } from "vite";
 * import config from "./docs.config";
 *
 * export default defineConfig({ plugins: [docsivi(config)] });
 */
export function docsivi(config: Readonly<DocsConfig>): PluginOption[] {
  const cwd = process.cwd();
  scaffold(cwd);
  const linked = linkedPackageDir(cwd);
  const basePath = config.deploy.basePath;

  // A file inside the docsivi package: imports of Fumadocs made by generated code are resolved from here.
  const fromCore = fileURLToPath(import.meta.url);

  const wiring: Plugin = {
    name: "docsivi:wiring",
    // The content macro injects `import ... from "fumadocs-mdx/runtime/macro"` into
    // `.docsivi/instance.ts`. The project does not depend on fumadocs-mdx, docsivi does.
    resolveId: {
      order: "pre",
      async handler(source, importer, options) {
        if (!importer || !source.startsWith("fumadocs-mdx/")) return null;
        if (!importer.includes(`/${generatedDir}/`)) return null;
        return this.resolve(source, fromCore, { ...options, skipSelf: true });
      },
    },
    config: () => ({
      ...(basePath ? { base: `${basePath}/` } : {}),
      resolve: {
        alias: { "docsivi:instance": join(cwd, generatedDir, "instance.ts") },
        // route modules and the theme come from the docsivi package, keep one copy of React
        dedupe: ["react", "react-dom", "react-router"],
      },
      // The package ships TypeScript sources, so Vite has to compile it instead of externalizing it.
      ssr: { noExternal: ["docsivi"] },
      server: {
        fs: { allow: [searchForWorkspaceRoot(cwd), cwd, ...(linked ? [linked] : [])] },
      },
    }),
  };

  return [
    fumadocsMdx({ globalOptions: { mdxOptions: createMdxOptions(config) } }),
    tailwindcss(),
    reactRouter(),
    wiring,
  ];
}
