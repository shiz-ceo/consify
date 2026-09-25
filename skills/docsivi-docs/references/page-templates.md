# Page templates and writing rules

Choose the template by the reader's question. Take facts from the code, not from memory: read the
implementation and its TSDoc, and check with a test or a run.

## Terms

Pick one word for each concept and use it everywhere. Collect the terms from the code and the
interview and keep the list consistent across pages and languages. If the list is long, offer to save
it as `DOCS-GLOSSARY.md` in the project root (ask first).

## Quick start

Goal in one sentence, requirements, installation (`Tabs` for package managers), the smallest example
that works, what the reader should see, where to go next. Every command must work from first to last.

## Guide (how to do X)

1. The goal in one sentence.
2. What the reader needs.
3. Steps (`Steps` / `Step`), each with the code to type.
4. The result, and how to check it.
5. Common mistakes (`Callout type="warn"`) and links to the reference.

## Concept

The problem it solves, how it is built (a `mermaid` diagram when there is a flow), when to use it,
limits. No step-by-step instructions and no option lists (link to the reference).

## Reference: function or method (from TSDoc)

Group related functions on one page by topic. For each:

1. Heading with the name and parentheses: `## findUser()`.
2. One sentence from the TSDoc summary.
3. The signature in a code block, copied from the code.
4. Parameters in a `TypeTable` (type, description, `default`, `required`).
5. What it returns, including the empty case, and what it throws.
6. An example: the `@example` of the TSDoc if it runs, otherwise your own working one.
7. Links to related entries.

Write the description from what the code **does**, using the TSDoc as the base. Do not paste it word
for word, and do not restate the signature in words.

## Reference: type or options

A `TypeTable` with every field, the default of each, and an example object.

## Reference: CLI

A table of commands. For each: purpose, flags (table), an example call and its output.

## Reference: configuration

An example of the file, a table of options (type, default), behavior and limits.

## Migration

What changed, what to use instead (before and after, with `// [!code --]` and `// [!code ++]`), since
which version, and how to check the result.

## Troubleshooting

Per problem: the symptom (the exact error text), the cause, the fix.

## Choosing a component

| Need | Use |
| --- | --- |
| Options and properties | `TypeTable` |
| Step-by-step instructions | `Steps`, `Step` |
| Variants (package managers, platforms) | `Tabs`, `Tab` |
| A folder layout | a `text` code block, or `Files` |
| A trap, a warning | `Callout type="warn"` |
| A helpful aside | `Callout type="info"` |
| A flow or structure | a `mermaid` block |
| A file name above code | `title="file.ts"` in the code fence |
| Highlight, diff | `{2,4-5}`, `// [!code ++]` |

Do not put a component inside a heading: the table of contents is built outside the page and cannot
see it.

## Style

- Third person for reference text, "you" for guides. Present tense.
- Short sentences. One idea per sentence, one topic per section.
- Tables for parallel facts, prose for reasoning.
- Mention performance or safety consequences where they matter.
- Do not describe internals in guides.
- Never leave an exported symbol without a description.
