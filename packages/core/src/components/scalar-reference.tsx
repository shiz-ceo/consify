import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "next-themes";

/** The Scalar API reference: operations, models and the API client, in one page. Browser only. */
export default function ScalarReference({
  source,
}: {
  source: { url: string } | { content: string };
}) {
  const { resolvedTheme } = useTheme();
  return (
    <ApiReferenceReact
      configuration={{
        ...source,
        // follow the site theme, the toggle inside Scalar would fight with it
        forceDarkModeState: resolvedTheme === "dark" ? "dark" : "light",
        hideDarkModeToggle: true,
        // no Scalar cloud buttons (Configure, Share, Deploy)
        showDeveloperTools: "never",
        // no Ask AI and no "Generate MCP" (Scalar cloud features)
        agent: { disabled: true },
        mcp: { disabled: true },
        withDefaultFonts: false,
      }}
    />
  );
}
