// The text of a page for the search index (Fumadocs' `StructuredData`): Fumadocs writes it with
// `mdast-util-to-markdown`, replacing every handler of it, and with `mdast-util-to-markdown@2.1.3`
// that never ends ("Maximum call stack size exceeded" on any bold text). A fresh install gets that
// version, and a library cannot pin what another one depends on. The index needs words, not Markdown,
// so the text is taken from the tree directly.

interface Node {
  type: string;
  value?: string;
  children?: Node[];
  data?: { structuredData?: { contents: unknown[] } };
}

/** Nodes whose children are lines of their own, not a run of text. */
const blocks = new Set([
  "root",
  "blockquote",
  "list",
  "listItem",
  "table",
  "tableRow",
  "mdxJsxFlowElement",
  "footnoteDefinition",
]);
const literal = new Set(["text", "inlineCode", "code", "html"]);
const skipped = new Set([
  "image",
  "imageReference",
  "definition",
  "mdxFlowExpression",
  "mdxTextExpression",
]);

function textOf(node: Node): string {
  if (literal.has(node.type)) return node.value ?? "";
  if (skipped.has(node.type)) return "";
  if (node.type === "break") return "\n";
  const parts = (node.children ?? []).map(textOf).filter(Boolean);
  return parts.join(blocks.has(node.type) ? "\n" : "");
}

/** `stringify` option of `remarkStructure`: the plain text of a node of the tree. */
export function plainText(
  node: Node,
  ctx: { addContent: (...content: unknown[]) => void },
): string {
  // a node that brings its own content (an OpenAPI operation) says so
  if (node.data?.structuredData) ctx.addContent(...node.data.structuredData.contents);
  return textOf(node);
}
