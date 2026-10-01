import type { DocsConfig } from "@consify/core";

/** What every `deploy <target>` command is handed. */
export interface DeployContext {
  config: Readonly<DocsConfig>;
  cwd: string;
  /** A short, URL/filename-safe name for this site: `site.name`, kebab-cased, or `--name`. */
  slug: string;
  /** The domain to put in a generated nginx server block, when the target needs one. */
  domain?: string | undefined;
  /** A path prefix instead of a domain (`location /docs/` sharing an existing domain). */
  path?: string | undefined;
  /** The TCP port `consify start` listens on, for a target that proxies to a local process. */
  port?: number | undefined;
  /** A Unix socket path instead of a TCP port — several instances can share a machine this way. */
  socket?: string | undefined;
  /** Also write a GitHub Actions workflow that checks, builds and deploys on every push. */
  ci?: boolean | undefined;
}

/** A file a target wants written, relative to the project root. */
export interface DeployFile {
  path: string;
  content: string;
}

export interface DeployTarget {
  id: string;
  label: string;
  /** One line, shown by `consify deploy list`. */
  description: string;
  /** `deploy.mode` values this target makes sense for. A static-only host lists `["static"]`. */
  modes: readonly ("static" | "server")[];
  /**
   * Extra flags this target reads from `args`, shown by the wizard and `deploy list`.
   * `"--name <value>"` asks for a value; a flag with no `<value>` (like `"--ci"`) asks yes/no.
   */
  flags?: readonly string[];
  write(ctx: DeployContext): DeployFile[];
  /** Printed after the files are written: what to configure on the host, secrets, DNS, etc. */
  notes(ctx: DeployContext): string[];
}
