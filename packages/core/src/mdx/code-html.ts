// A code block is thousands of tokens, and in compiled MDX every token is a call
// (`_jsx(_components.span, { className: "sl2 sd2", children: "import" })`, ~60 bytes) that React then
// creates and hydrates. As HTML (`<span class='sl2 sd2'>import</span>`, ~35 bytes) it is a string
// the browser parses itself. So the lines of a block are one `html` prop of `CodeHtml`.
//
// A Twoslash hover is a React component with a popup (a Popover for every identifier: a page has
// hundreds), and the same popup is on a page many times. Here a hover is a button with the number of
// its popup, and the popups of the page are one list, `TwoslashPopups`, that shows one at a time.

interface Node {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
}

const escapeText = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// attributes are in single quotes: the compiled code is a string in double quotes, and has no escapes for them
const attribute = (name: string, value: string) =>
  ` ${name}='${value.replace(/&/g, "&amp;").replace(/'/g, "&#39;")}'`;

/** What a hast node can say that HTML says too, besides the classes and the style. */
const plain =
  /^(?:href|title|target|rel|id|role|type|lang|dir|tabindex|aria[A-Z]\w*|data[A-Z]\w*)$/;
const void_ = new Set(["br", "hr", "img", "wbr"]);

/** The popups of a page, once each: their HTML, and the number of the HTML. */
interface Popups {
  list: string[];
  index: Map<string, number>;
}

/** `className` and `class`: a string, and an array once a class was added to it. */
function classesOf(properties: Record<string, unknown>): string {
  return [properties.class, properties.className]
    .flatMap((value) =>
      Array.isArray(value) ? value.map(String) : typeof value === "string" ? [value] : [],
    )
    .join(" ");
}

/** The name of a hast property as an HTML attribute: `ariaLabel` is `aria-label`. */
const attributeName = (key: string) => key.replace(/([A-Z])/g, "-$1").toLowerCase();

/**
 * The HTML of `node`, or `undefined` when it has something HTML does not say (a component).
 */
function elementHtml(node: Node, popups?: Popups): string | undefined {
  const name = node.tagName ?? "";
  if (name === "Popup" && popups) return popupHtml(node, popups);
  if (!/^[a-z][a-z0-9]*$/.test(name)) return undefined;
  let attributes = "";
  const { class: _class, className: _className, style, ...rest } = node.properties ?? {};
  const classes = classesOf(node.properties ?? {});
  if (classes) attributes += attribute("class", classes);
  if (style !== undefined) {
    if (typeof style !== "string") return undefined;
    attributes += attribute("style", style);
  }
  for (const [key, value] of Object.entries(rest)) {
    if (!plain.test(key) || (typeof value !== "string" && typeof value !== "number")) {
      return undefined;
    }
    attributes += attribute(attributeName(key), String(value));
  }
  if (void_.has(name)) return `<${name}${attributes}>`;
  const inner = nodesHtml(node.children ?? [], popups);
  return inner === undefined ? undefined : `<${name}${attributes}>${inner}</${name}>`;
}

function nodesHtml(nodes: Node[], popups?: Popups): string | undefined {
  let html = "";
  for (const node of nodes) {
    if (node.type === "text") html += escapeText(node.value ?? "");
    else if (node.type === "element") {
      const element = elementHtml(node, popups);
      if (element === undefined) return undefined;
      html += element;
    } else return undefined;
  }
  return html;
}

/** `<Popup>` (`PopupContent` and `PopupTrigger`) as a button; its popup goes to `popups`. */
function popupHtml(popup: Node, popups: Popups): string | undefined {
  const parts = popup.children ?? [];
  const content = parts.find((part) => part.tagName === "PopupContent");
  const trigger = parts.find((part) => part.tagName === "PopupTrigger");
  if (parts.length !== 2 || !content || !trigger) return undefined;
  const body = nodesHtml(content.children ?? []);
  const text = nodesHtml(trigger.children ?? []);
  if (body === undefined || text === undefined) return undefined;
  let index = popups.index.get(body);
  if (index === undefined) {
    index = popups.list.push(body) - 1;
    popups.index.set(body, index);
  }
  return `<button${attribute("type", "button")}${attribute("class", "twoslash-hover")}${attribute("aria-haspopup", "dialog")}${attribute("data-tw", String(index))}>${text}</button>`;
}

function visit(node: Node, fn: (node: Node) => void): void {
  for (const child of node.children ?? []) {
    fn(child);
    visit(child, fn);
  }
}

/**
 * Rehype plugin: the `<code>` of a highlighted block becomes `<CodeHtml html="…">`, and the popups
 * of its hovers become one `<TwoslashPopups>` at the end of the page. A block with anything else in
 * it (a component, an error line of Twoslash) stays as it is.
 */
export function rehypeCodeHtml() {
  return (tree: Node) => {
    const popups: Popups = { list: [], index: new Map() };
    visit(tree, (pre) => {
      if (pre.type !== "element" || pre.tagName !== "pre") return;
      for (const code of pre.children ?? []) {
        if (code.type !== "element" || code.tagName !== "code") continue;
        const html = nodesHtml(code.children ?? [], popups);
        if (html === undefined) continue;
        code.tagName = "CodeHtml";
        code.properties = { ...code.properties, html };
        code.children = [];
      }
    });
    if (popups.list.length > 0) {
      tree.children = [
        ...(tree.children ?? []),
        {
          type: "element",
          tagName: "TwoslashPopups",
          properties: { data: popups.list.join("\u0001") },
          children: [],
        },
      ];
    }
  };
}
