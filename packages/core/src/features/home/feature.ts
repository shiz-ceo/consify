import type { Feature } from "../types.ts";

export const home: Feature = {
  id: "home",
  dir: import.meta.url,
  routes: () => [{ path: ":lang", file: "routes/home.tsx" }],
};
