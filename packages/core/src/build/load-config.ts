import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { DocsConfig } from "../config/index.ts";

const names = ["docs.config.ts", "docs.config.mts", "docs.config.js", "docs.config.mjs"];

/** Node cannot run this file (a `.tsx` slot, a `.css` import): Vite can. Any other error is the user's to fix. */
const nodeCannotLoad = new Set([
  "ERR_UNKNOWN_FILE_EXTENSION",
  "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX",
  "ERR_MODULE_NOT_FOUND",
  "ERR_IMPORT_ATTRIBUTE_MISSING",
]);

/** The config file that exists in `cwd`, whatever its extension. */
export function findConfigFile(cwd: string): string | undefined {
  return names.find((name) => existsSync(join(cwd, name)));
}

/**
 * Loads `docs.config.ts` of the project in `cwd`, for the commands that read the config. Node
 * loads it directly; when the config imports something Node cannot run (a `.tsx` component in a
 * slot), Vite loads it, as it does for the site itself.
 */
export async function loadConfig(cwd: string): Promise<Readonly<DocsConfig>> {
  const name = findConfigFile(cwd);
  const file = name && join(cwd, name);
  if (!file) {
    throw new Error("docs.config.ts was not found: run the command in the folder of the project");
  }
  try {
    return (
      (await import(/* @vite-ignore */ pathToFileURL(file).href)) as {
        default: Readonly<DocsConfig>;
      }
    ).default;
  } catch (error) {
    // a broken config (DocsConfigError, a syntax error) must not be retried through Vite: it would
    // only hide the real message behind a second, unrelated failure
    const code = (error as { code?: unknown } | null)?.code;
    if (typeof code !== "string" || !nodeCannotLoad.has(code)) throw error;
    const { createServer } = await import("vite");
    const server = await createServer({
      root: cwd,
      configFile: false,
      appType: "custom",
      logLevel: "silent",
      server: { middlewareMode: true, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true },
    });
    try {
      return ((await server.ssrLoadModule(file)) as { default: Readonly<DocsConfig> }).default;
    } finally {
      await server.close();
    }
  }
}
