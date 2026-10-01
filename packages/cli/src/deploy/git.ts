import { execFileSync } from "node:child_process";

/**
 * `owner/repo` from the `origin` remote, lowercased (GHCR only accepts lowercase image names).
 * Used to bake a concrete image name into a generated file instead of a placeholder — `undefined`
 * outside a git repo, without a remote, or for a remote that is not GitHub.
 */
export function githubRepoSlug(cwd: string): string | undefined {
  let url: string;
  try {
    url = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
  const match = /github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/i.exec(url);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined;
}
