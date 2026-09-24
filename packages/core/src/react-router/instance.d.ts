// `docsivi:instance` is an alias (set by the docsivi Vite plugin) to `.docsivi/instance.ts` of the project.
declare module "docsivi:instance" {
  import type { Docsivi } from "docsivi";
  export const docsivi: Docsivi;
}
