import type { ComponentProps } from "react";

/** The `<code>` of a code block whose lines are made at build time (`rehypeCodeHtml`): `html` is them. */
export function CodeHtml({ html, ...props }: ComponentProps<"code"> & { html: string }) {
  return <code {...props} dangerouslySetInnerHTML={{ __html: html }} />;
}
