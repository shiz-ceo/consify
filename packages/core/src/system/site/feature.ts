import type { Feature } from "../../shared/feature.ts";

/** The parts of the site that belong to no page: the language redirect and the 404 page. */
export const site: Feature = {
  id: "site",
  dir: import.meta.url,
  routes: ({ isStatic }) => [
    { index: true, file: "routes/root-redirect" },
    // In static mode a loader is only allowed on pre-rendered routes, so the 404 has none.
    { path: "*", file: isStatic ? "routes/not-found-static" : "routes/not-found" },
  ],
};
