import { Fragment, type ReactNode } from "react";

// What a description of a field has in it: the inline Markdown. A table shows a string as it is, so
// without this a `{ domain: false }` came out with its backticks.
//
// `code`, **bold** and __bold__, *italic* and _italic_, ~~struck~~, [text](address "title"),
// <https://address>, and a backslash before a mark (\*) shows the mark. The marks nest
// (**bold `code`**, [*a link*](/a)), except inside `code`.

type Render = (match: RegExpExecArray, key: string) => ReactNode;

const rules: [RegExp, Render][] = [
  [/\\([\\`*_{}[\]()#+\-.!~<>|])/, (m) => m[1]],
  [
    /(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,
    (m, key) => <code key={key}>{(m[2] as string).trim()}</code>,
  ],
  [
    /!?\[((?:[^[\]\\]|\\.|\[[^\]]*\])+)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/,
    (m, key) => (
      <a key={key} href={m[2] as string} {...(m[3] ? { title: m[3] } : {})}>
        {parse(m[1] as string)}
      </a>
    ),
  ],
  [
    /<(https?:\/\/[^>\s]+)>/,
    (m, key) => (
      <a key={key} href={m[1] as string}>
        {m[1]}
      </a>
    ),
  ],
  [
    /\*\*\*(?=\S)([\s\S]*?\S)\*\*\*|___(?=\S)([\s\S]*?\S)___/,
    (m, key) => (
      <strong key={key}>
        <em>{parse((m[1] ?? m[2]) as string)}</em>
      </strong>
    ),
  ],
  [
    /\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)|(?<!\w)__(?=\S)([\s\S]*?\S)__(?!\w)/,
    (m, key) => <strong key={key}>{parse((m[1] ?? m[2]) as string)}</strong>,
  ],
  [/~~(?=\S)([\s\S]*?\S)~~/, (m, key) => <del key={key}>{parse(m[1] as string)}</del>],
  [
    /\*(?=[^\s*])((?:\*\*[^*]+\*\*|[^*])+?)(?<=\S)\*(?!\*)|(?<![\w_])_(?=[^\s_])([^_]*?[^\s_])_(?![\w_])/,
    (m, key) => <em key={key}>{parse((m[1] ?? m[2]) as string)}</em>,
  ],
];

function parse(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    // the mark that starts first wins; of two at the same place, the one that is listed first
    let best: { at: number; length: number; node: (key: string) => ReactNode } | undefined;
    for (const [pattern, render] of rules) {
      const match = pattern.exec(rest);
      if (match && (!best || match.index < best.at)) {
        best = { at: match.index, length: match[0].length, node: (key) => render(match, key) };
      }
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.at > 0) out.push(rest.slice(0, best.at));
    out.push(<Fragment key={`m${n}`}>{best.node(`n${n}`)}</Fragment>);
    n++;
    rest = rest.slice(best.at + best.length);
  }
  return out;
}

/**
 * A text of a table with its Markdown marks made. Other values (nodes) are left as they are.
 */
export function inline(text: ReactNode): ReactNode {
  if (typeof text !== "string") return text;
  return parse(text);
}
