// Shared package-resolution helper for the CLI's own introspection needs (`--version`, spawning
// `@react-router/dev`/`@react-router/serve`): resolving `pkg`'s `package.json`, preferring (in
// order) from inside the project's own installed `@consify/core` (since e.g. `@react-router/dev` is
// a dependency of `@consify/core`, not of `@consify/cli` itself, and may only be reachable by
// walking up from inside `@consify/core`'s own install directory), then from the project itself,
// then from `@consify/cli`'s own install location — covering every layout a package manager's
// hoisting might produce.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ownRequire = createRequire(import.meta.url);

function projectRequire(cwd: string): NodeJS.Require {
  return createRequire(pathToFileURL(join(cwd, "package.json")).href);
}

/** A `require` rooted at the project's own installed `@consify/core` package, when resolvable. */
function consifyRequire(cwd: string): NodeJS.Require | undefined {
  try {
    return createRequire(projectRequire(cwd).resolve("@consify/core/package.json"));
  } catch {
    return undefined;
  }
}

/** Resolves `pkg`'s `package.json` path, or `undefined` when it isn't installed anywhere reachable. */
export function resolvePackageJson(cwd: string, pkg: string): string | undefined {
  for (const require of [consifyRequire(cwd), projectRequire(cwd), ownRequire]) {
    try {
      if (require) return require.resolve(`${pkg}/package.json`);
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}
