// A Twoslash popup (`<PopupContent>`: a highlighted type) repeats on a page for every use of the same
// type, and each copy is compiled into the page code in full. The same popup is one element,
// so the page makes it once and shows it wherever it is needed (a React element can be used twice).
type Node = { type: string; [key: string]: unknown };

const positions = new Set(["start", "end", "loc", "range"]);

const isPopupContent = (node: unknown): node is Node => {
  const call = node as { type?: string; callee?: Node; arguments?: Node[] };
  return (
    call.type === "CallExpression" &&
    (call.callee?.name === "_jsx" || call.callee?.name === "_jsxs") &&
    call.arguments?.[0]?.name === "PopupContent"
  );
};

/** Calls `fn` for every object of the tree, children first; `fn` may return a node to put in its place. */
function replace(parent: Record<string, unknown>, fn: (node: Node) => Node | undefined): void {
  for (const [key, value] of Object.entries(parent)) {
    if (positions.has(key) || typeof value !== "object" || value === null) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item !== "object" || item === null) return;
        replace(item as Record<string, unknown>, fn);
        value[i] = fn(item as Node) ?? item;
      });
    } else {
      replace(value as Record<string, unknown>, fn);
      parent[key] = fn(value as Node) ?? value;
    }
  }
}

/** Recma plugin: every `<PopupContent>` used more than once on a page is made once, before the page. */
export function recmaHoistPopups() {
  return (tree: { body: unknown[] }) => {
    const key = (node: Node) => JSON.stringify(node, (k, v) => (positions.has(k) ? undefined : v));
    const count = new Map<string, number>();
    replace(tree as never, (node) => {
      if (isPopupContent(node)) count.set(key(node), (count.get(key(node)) ?? 0) + 1);
      return undefined;
    });

    const names = new Map<string, string>();
    const hoisted: Node[] = [];
    replace(tree as never, (node) => {
      if (!isPopupContent(node) || (count.get(key(node)) ?? 0) < 2) return undefined;
      let name = names.get(key(node));
      if (!name) {
        name = `_popup${names.size}`;
        names.set(key(node), name);
        hoisted.push({
          type: "VariableDeclaration",
          kind: "const",
          declarations: [
            { type: "VariableDeclarator", id: { type: "Identifier", name }, init: node },
          ],
        });
      }
      return { type: "Identifier", name };
    });
    if (hoisted.length === 0) return;

    // the popups use `_jsx` and the components of the page: they are made right before it is returned
    const page = (tree.body as Node[]).find(
      (n) => n.type === "FunctionDeclaration" && (n.id as Node).name === "_createMdxContent",
    );
    const body = (page?.body as { body: Node[] } | undefined)?.body;
    const last = body?.findLastIndex((n) => n.type === "ReturnStatement") ?? -1;
    if (body && last >= 0) body.splice(last, 0, ...hoisted);
  };
}
