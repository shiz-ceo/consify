import { fileURLToPath } from "node:url";
import { index, type RouteConfig, route } from "@react-router/dev/routes";

/** `defineRouterConfig` sets this before the routes are read. */
const isStatic = process.env.DOCSIVI_DEPLOY_MODE === "static";

/** Route modules live in this package, so a project never has to copy them. */
const file = (name: string) => fileURLToPath(new URL(`./routes/${name}`, import.meta.url));

export default [
  index(file("root-redirect.tsx")),
  route(":lang", file("home.tsx")),
  route(":lang/docs/*", file("docs.tsx")),
  route(":lang/llms.txt", file("llms.ts")),
  route(":lang/llms-full.txt", file("llms-full.ts")),
  route(":lang/og/*", file("og.ts")),
  route("api/search", file("search.ts")),
  route("sitemap.xml", file("sitemap.ts")),
  route("robots.txt", file("robots.ts")),
  route("*", file(isStatic ? "not-found-static.tsx" : "not-found.tsx")),
] satisfies RouteConfig;
