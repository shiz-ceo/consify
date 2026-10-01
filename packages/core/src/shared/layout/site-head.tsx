import type { Head } from "../../config/schema.ts";

/**
 * The tags of `head` from the config. It renders inside `<head>`, after the tags of consify, so a
 * page keeps working when a script is slow: scripts are yours to mark `async` or `defer`.
 */
export function SiteHead({ head }: { head: Head }) {
  return (
    <>
      {head.meta.map((meta, index) => (
        <meta
          // the list is fixed by the config, an index is a stable key
          key={`meta-${index}`}
          {...(meta.name ? { name: meta.name } : {})}
          {...(meta.property ? { property: meta.property } : {})}
          {...(meta.httpEquiv ? { httpEquiv: meta.httpEquiv } : {})}
          content={meta.content}
        />
      ))}
      {head.links.map((link, index) => (
        <link key={`link-${index}`} {...link} />
      ))}
      {head.scripts.map((script, index) =>
        "src" in script ? (
          <script
            key={`script-${index}`}
            src={script.src}
            {...(script.async ? { async: true } : {})}
            {...(script.defer ? { defer: true } : {})}
            {...(script.type ? { type: script.type } : {})}
            {...(script.integrity ? { integrity: script.integrity } : {})}
            {...(script.crossOrigin ? { crossOrigin: script.crossOrigin } : {})}
            {...Object.fromEntries(
              Object.entries(script.data ?? {}).map(([name, value]) => [`data-${name}`, value]),
            )}
          />
        ) : (
          <script
            key={`script-${index}`}
            {...(script.type ? { type: script.type } : {})}
            dangerouslySetInnerHTML={{ __html: script.inline }}
          />
        ),
      )}
    </>
  );
}
