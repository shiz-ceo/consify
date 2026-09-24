import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import type { DocsConfig } from "../config/index.ts";

/**
 * Redirect that works in both deploy modes. Server mode uses a real HTTP redirect. Static export
 * has no server, so it renders a page with `<meta http-equiv="refresh">` (React hoists it to
 * `<head>`) and a plain link as a fallback.
 */
export function redirectTo(config: Readonly<DocsConfig>, path: string): ReactElement {
  if (config.deploy.mode !== "static") redirect(path);
  const href = `${config.deploy.basePath ?? ""}${path}`;
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <link rel="canonical" href={href} />
      <p>
        Redirecting to <a href={href}>{href}</a>…
      </p>
    </>
  );
}
