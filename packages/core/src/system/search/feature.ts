import type { Feature } from "../../shared/feature.ts";

export const search: Feature = {
  id: "search",
  dir: import.meta.url,
  routes: () => [{ path: "api/search", file: "routes/search" }],
};
