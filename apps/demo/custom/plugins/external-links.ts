import { definePlugin } from "docsivi/plugins";

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

// Example rehype plugin: open absolute http(s) links in a new tab.
function rehypeExternalLinks() {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      const href = node.properties?.href;
      if (node.tagName === "a" && typeof href === "string" && /^https?:\/\//.test(href)) {
        node.properties = { ...node.properties, target: "_blank", rel: "noopener noreferrer" };
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}

export const externalLinks = definePlugin({
  name: "external-links",
  rehype: [rehypeExternalLinks],
});
