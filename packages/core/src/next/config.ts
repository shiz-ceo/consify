import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, parse, resolve, sep } from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import type { DocsConfig } from "../config/index.ts";
import { syncCustomComponents, watchCustomComponents } from "./custom-components.ts";

/** Deepest directory that contains both paths. */
export function commonAncestor(a: string, b: string): string {
  const left = resolve(a).split(sep);
  const right = resolve(b).split(sep);
  const shared: string[] = [];
  for (let i = 0; i < Math.min(left.length, right.length) && left[i] === right[i]; i++) {
    shared.push(left[i] as string);
  }
  return shared.join(sep) || parse(resolve(a)).root;
}

/**
 * With `bun link` / `npm link` the docsivi package lives outside the project, and Turbopack refuses
 * to compile files outside its root. Returns the root that covers both, or `undefined` when the
 * package is installed normally (inside the project's `node_modules`).
 */
export function linkedRoot(cwd = process.cwd()): string | undefined {
  try {
    const pkgDir = dirname(
      realpathSync(createRequire(`${cwd}${sep}`).resolve("docsivi/package.json")),
    );
    const inside = pkgDir === cwd || pkgDir.startsWith(`${cwd}${sep}`);
    return inside ? undefined : commonAncestor(cwd, pkgDir);
  } catch {
    return undefined;
  }
}

/**
 * Wraps the project's Next.js config: enables Fumadocs MDX, compiles the docsivi package (it ships
 * TypeScript sources) and applies `deploy` from `docs.config.ts` (static export, base path).
 */
export function withDocsivi(
  docsConfig: Readonly<DocsConfig>,
  nextConfig: NextConfig = {},
): NextConfig {
  const { mode, basePath } = docsConfig.deploy;
  // Registry of custom/components/*, regenerated on file changes in dev.
  syncCustomComponents();
  if (process.env.NODE_ENV === "development") watchCustomComponents();

  const root = linkedRoot();
  const withMDX = createMDX();
  return withMDX({
    reactStrictMode: true,
    ...(mode === "static" ? { output: "export" as const, images: { unoptimized: true } } : {}),
    ...(basePath ? { basePath } : {}),
    ...(root ? { turbopack: { root } } : {}),
    ...nextConfig,
    // Twoslash runs the TypeScript compiler on the server.
    serverExternalPackages: ["typescript", ...(nextConfig.serverExternalPackages ?? [])],
    transpilePackages: ["docsivi", ...(nextConfig.transpilePackages ?? [])],
  });
}
