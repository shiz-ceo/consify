import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { type Plugin, type PluginOption, searchForWorkspaceRoot } from "vite";
import type { DocsConfig } from "../../config/index.ts";
import { createMdxOptions } from "../../mdx/options.ts";
import { generatedDir, scaffold } from "../router/scaffold.ts";
import { scalarCreditPlugin } from "../../features/api-reference/scalar-credit.ts";

/**
 * Client dependencies of docsivi that Vite would otherwise discover one by one while the page
 * loads, re-optimizing and reloading in the middle of the first visit (which breaks hydration).
 * `docsivi > x` resolves `x` from the docsivi package, so a project does not have to depend on them.
 */
const prebundle = [
  "fumadocs-core/i18n",
  "fumadocs-core/search/client",
  "fumadocs-core/search/client/orama-static",
  "fumadocs-core/source",
  "fumadocs-core/source/client",
  "fumadocs-core/source/plugins/lucide-icons",
  "fumadocs-mdx/runtime/macro",
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
  "fumadocs-ui/layouts/docs",
  "fumadocs-ui/layouts/docs/page",
  "fumadocs-ui/layouts/home",
  "fumadocs-ui/mdx",
  "fumadocs-ui/provider/react-router",
  "@scalar/api-reference-react",
  "mermaid",
  "next-themes",
  "zod",
];

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
  scaffold(cwd, config);
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
        alias: {
          "docsivi:instance": join(cwd, generatedDir, "instance.ts"),
          "docsivi:blog": join(cwd, generatedDir, "blog.ts"),
          "docsivi:home": join(cwd, generatedDir, "home.ts"),
        },
        // route modules and the theme come from the docsivi package, keep one copy of React
        dedupe: ["react", "react-dom", "react-router"],
      },
      // The package ships TypeScript sources, so Vite has to compile it instead of externalizing it.
      ssr: { noExternal: ["docsivi"] },
      optimizeDeps: {
        include: prebundle.map((dep) => `docsivi > ${dep}`),
        // the pre-bundling of dependencies (dev) is a separate build, it needs the plugin too
        rolldownOptions: { plugins: [scalarCreditPlugin()] },
      },
      server: {
        fs: { allow: [searchForWorkspaceRoot(cwd), cwd, ...(linked ? [linked] : [])] },
      },
    }),
  };

  return [
    fumadocsMdx({ globalOptions: { mdxOptions: createMdxOptions(config) } }),
    tailwindcss(),
    reactRouter(),
    scalarCreditPlugin(),
    wiring,
  ];
}
