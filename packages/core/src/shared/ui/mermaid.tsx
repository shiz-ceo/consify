"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

/** Renders a Mermaid diagram. Also used for ```mermaid code fences. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: resolvedTheme === "dark" ? "dark" : "default",
        });
        const result = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id, resolvedTheme]);

  if (error) {
    return <pre className="my-4 rounded-lg border border-fd-error p-3 text-sm">{error}</pre>;
  }
  if (svg === null) return <div className="my-4 h-24 animate-pulse rounded-lg bg-fd-muted" />;
  // The SVG is produced by Mermaid in `strict` security mode.
  return <div className="my-4 flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />;
}
