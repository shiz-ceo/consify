import type { Feature } from "../../shared/feature.ts";

export const home: Feature = {
  id: "home",
  dir: import.meta.url,
  routes: () => [{ path: ":lang", file: "routes/home.tsx" }],
};
