import { definePlugin } from "docsivi/plugins";

// Remark plugin: GitHub-style alerts in plain Markdown become <Callout>.
//
//   > [!NOTE]
//   > Text of the note.
//
// Supported: NOTE, TIP, WARNING, IMPORTANT, CAUTION.
type Node = { type: string; value?: string; children?: Node[]; [key: string]: unknown };

const types: Record<string, { type: string; title: string }> = {
  NOTE: { type: "info", title: "Note" },
  TIP: { type: "idea", title: "Tip" },
  IMPORTANT: { type: "info", title: "Important" },
  WARNING: { type: "warn", title: "Warning" },
  CAUTION: { type: "error", title: "Caution" },
};

function remarkGithubAlerts() {
  return (tree: Node) => {
    const visit = (node: Node) => {
      const children = node.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as Node;
        const firstText =
          child.type === "blockquote" ? child.children?.[0]?.children?.[0] : undefined;
        const match =
          firstText?.type === "text" ? /^\[!(\w+)\]\s*/.exec(firstText.value ?? "") : null;
        const alert = match ? types[(match[1] as string).toUpperCase()] : undefined;
        if (child.type === "blockquote" && match && alert) {
          (firstText as Node).value = (firstText?.value ?? "").slice(match[0].length);
          children[i] = {
            type: "mdxJsxFlowElement",
            name: "Callout",
            attributes: [
              { type: "mdxJsxAttribute", name: "type", value: alert.type },
              { type: "mdxJsxAttribute", name: "title", value: alert.title },
            ],
            children: child.children ?? [],
          };
        } else {
          visit(child);
        }
      }
    };
    visit(tree);
  };
}

export const githubAlerts = definePlugin({
  name: "github-alerts",
  remark: [remarkGithubAlerts],
});
