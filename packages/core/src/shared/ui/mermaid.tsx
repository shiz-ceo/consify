"use client";

import { useTheme } from "next-themes";
import { useEffect, useId, useRef, useState } from "react";

/** A CSS color (any syntax, including `oklch`) as something Mermaid can parse: `#rrggbb` or `rgba()`. */
function toRgb(value: string): string {
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return value;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 255] = context.getImageData(0, 0, 1, 1).data;
  if (a === 255) return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

/** The value of a token of the theme (`--color-fd-card`) as a color Mermaid understands. */
function token(name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return toRgb(value);
}

/**
 * Mermaid's `base` theme filled with the colors and the font of the site, so a diagram matches the
 * cards and code blocks around it, in the light and in the dark scheme, and follows `theme.colors`.
 */
function themeVariables(dark: boolean) {
  const background = token("--color-fd-background");
  const card = token("--color-fd-card");
  const muted = token("--color-fd-muted");
  const border = token("--color-fd-border");
  const foreground = token("--color-fd-foreground");
  const subtle = token("--color-fd-muted-foreground");
  const primary = token("--color-fd-primary");
  const fontFamily = getComputedStyle(document.body).fontFamily;

  return {
    darkMode: dark,
    background,
    fontFamily,
    fontSize: "14px",
    textColor: foreground,
    lineColor: subtle,
    primaryColor: card,
    primaryTextColor: foreground,
    primaryBorderColor: border,
    secondaryColor: muted,
    secondaryTextColor: foreground,
    secondaryBorderColor: border,
    tertiaryColor: background,
    tertiaryTextColor: foreground,
    tertiaryBorderColor: border,
    mainBkg: card,
    nodeBorder: border,
    nodeTextColor: foreground,
    clusterBkg: "transparent",
    clusterBorder: border,
    edgeLabelBackground: background,
    titleColor: foreground,
    // sequence diagrams
    actorBkg: card,
    actorBorder: border,
    actorTextColor: foreground,
    actorLineColor: border,
    signalColor: subtle,
    signalTextColor: foreground,
    labelBoxBkgColor: card,
    labelBoxBorderColor: border,
    labelTextColor: foreground,
    loopTextColor: foreground,
    noteBkgColor: muted,
    noteBorderColor: border,
    noteTextColor: foreground,
    activationBkgColor: muted,
    activationBorderColor: border,
    sequenceNumberColor: background,
    // state diagrams
    stateBkg: card,
    stateLabelColor: foreground,
    transitionColor: subtle,
    transitionLabelColor: foreground,
    specialStateColor: subtle,
    // the accent for whatever the diagram highlights
    git0: primary,
  };
}

/** Renders a Mermaid diagram. Also used for ```mermaid code fences. */
export function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // wait a frame: the class of the new scheme has to be on <html> before the tokens are read
    const frame = requestAnimationFrame(async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: themeVariables(resolvedTheme === "dark"),
          // plain SVG text instead of HTML labels: it is styled the same everywhere
          flowchart: {
            curve: "basis",
            padding: 12,
            nodeSpacing: 32,
            rankSpacing: 44,
            htmlLabels: false,
          },
          sequence: { actorMargin: 60, messageMargin: 36, mirrorActors: false },
        });
        const result = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [chart, id, resolvedTheme]);

  // Mermaid draws the groups first, so arrows are drawn over their titles. Drawing the groups last
  // (they have no fill) puts the titles on top, where a halo cuts them out of the lines.
  useEffect(() => {
    const groups = container.current?.querySelector("g.clusters");
    groups?.parentElement?.appendChild(groups);

    // On a narrow screen a wide diagram would shrink until its text cannot be read: it keeps at
    // least this width (or its own width, when it is smaller) and scrolls sideways instead.
    const svgElement = container.current?.querySelector("svg");
    const natural = Number.parseFloat(svgElement?.style.maxWidth ?? "");
    if (svgElement && Number.isFinite(natural))
      svgElement.style.minWidth = `${Math.min(natural, 560)}px`;
  }, [svg]);

  if (error) {
    return <pre className="my-4 rounded-lg border border-fd-error p-3 text-sm">{error}</pre>;
  }
  if (svg === null) return <div className="my-6 h-32 animate-pulse rounded-xl bg-fd-muted" />;
  // The SVG is produced by Mermaid in `strict` security mode.
  return (
    <div
      ref={container}
      className="docsivi-mermaid not-prose my-6 flex justify-center overflow-x-auto rounded-xl border border-fd-border bg-fd-card/40 p-5"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
