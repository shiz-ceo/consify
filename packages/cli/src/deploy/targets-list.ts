import { cloudflarePages } from "./targets/cloudflare-pages.ts";
import { docker } from "./targets/docker.ts";
import { githubPages } from "./targets/github-pages.ts";
import { netlify } from "./targets/netlify.ts";
import { nginx } from "./targets/nginx.ts";
import { vercel } from "./targets/vercel.ts";
import type { DeployTarget } from "./types.ts";

/** Every hosting target `consify deploy` knows, in the order `consify deploy list` shows them. */
export const deployTargets: readonly DeployTarget[] = [
  githubPages,
  cloudflarePages,
  netlify,
  vercel,
  docker,
  nginx,
];

export function findTarget(id: string): DeployTarget | undefined {
  return deployTargets.find((target) => target.id === id);
}
