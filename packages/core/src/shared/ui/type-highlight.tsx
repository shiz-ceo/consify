import { Fragment, type ReactNode } from "react";

// A type or a value in a table (`Promise<Job<Data>> | undefined`, `"none"`, `100`) with a little
// color: not a highlighter, a few rules that tell the words apart. The colors are those of the code
// blocks (the classes `sl<n> sd<n>`, see mdx/shiki-classes.ts): blue for the built-in types and
// numbers, orange for the names of types, red for the words of the language and the signs between
// types, dark blue for a string, purple for a function.

const keywords = new Set([
  "keyof",
  "typeof",
  "extends",
  "infer",
  "readonly",
  "unique",
  "new",
  "as",
  "is",
  "in",
  "of",
  "asserts",
  "async",
  "await",
  "function",
  "const",
  "enum",
  "interface",
  "type",
  "import",
]);
const builtins = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "symbol",
  "object",
  "null",
  "undefined",
  "void",
  "never",
  "unknown",
  "any",
  "true",
  "false",
  "this",
]);

const token = new RegExp(
  [
    "(?<string>\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*'|`(?:[^`\\\\]|\\\\.)*`)",
    "(?<number>\\b\\d[\\d_]*(?:\\.\\d+)?n?\\b)",
    "(?<word>[A-Za-z_$][\\w$]*)",
    "(?<sign>=>|\\.\\.\\.|[|&?])",
  ].join("|"),
  "g",
);

// `light`/`dark` index the lists of colors: 2 red, 3 blue, 4 orange, 5 purple, 7 dark blue
const colors = {
  keyword: "sl2 sd2",
  builtin: "sl3 sd3",
  number: "sl3 sd3",
  name: "sl4 sd4",
  string: "sl7 sd7",
  call: "sl5 sd5",
  sign: "sl2 sd2",
} as const;

/** `text` with a color on its words. Anything that is not a string (a node) is left as it is. */
export function highlight(text: ReactNode): ReactNode {
  if (typeof text !== "string") return text;
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const { string, number, word, sign } = match.groups as Record<string, string | undefined>;
    const after = text.slice(at + match[0].length);
    let kind: keyof typeof colors | undefined;
    if (string !== undefined) kind = "string";
    else if (number !== undefined) kind = "number";
    else if (sign !== undefined) kind = "sign";
    else if (word !== undefined) {
      // a property (`start:`) or a parameter keeps the color of the text
      if (/^\??\s*:/.test(after)) kind = undefined;
      else if (keywords.has(word)) kind = "keyword";
      else if (builtins.has(word)) kind = "builtin";
      else if (/^[A-Z]/.test(word)) kind = "name";
      else if (/^\s*\(/.test(after)) kind = "call";
    }
    out.push(
      kind ? (
        <span key={at} className={`consify-tk ${colors[kind]}`}>
          {match[0]}
        </span>
      ) : (
        <Fragment key={at}>{match[0]}</Fragment>
      ),
    );
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
