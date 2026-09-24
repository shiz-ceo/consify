import type { Feature } from "../types.ts";

/** The parts of the site that belong to no page: the language redirect and the 404 page. */
export const site: Feature = {
  id: "site",
  dir: import.meta.url,
  routes: ({ isStatic }) => [
    { index: true, file: "routes/root-redirect.tsx" },
    // In static mode a loader is only allowed on pre-rendered routes, so the 404 has none.
    { path: "*", file: isStatic ? "routes/not-found-static.tsx" : "routes/not-found.tsx" },
  ],
};
