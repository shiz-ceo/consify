import { TypeTable as FumadocsTypeTable } from "fumadocs-ui/components/type-table";
import { type ComponentProps, Fragment, type ReactNode } from "react";

type Props = ComponentProps<typeof FumadocsTypeTable>;
type Item = Props["type"][string];

// `code`, **bold**, *italic* and [text](address): what a description of a field has in it
const marks = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * A text of a table with its Markdown marks made: the table shows a string as it is, so a
 * `{ domain: false }` came out with its backticks. Other values (nodes) are left as they are.
 */
export function inline(text: ReactNode): ReactNode {
  if (typeof text !== "string") return text;
  return text.split(marks).map((part, index) => {
    const key = `${index}`;
    if (part.startsWith("`") && part.length > 2) return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.length > 4) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.length > 2) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} href={link[2] as string}>
          {link[1]}
        </a>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

/** `<TypeTable>` of Fumadocs, with Markdown marks in the descriptions of its fields. */
export function TypeTable({ type, ...props }: Props) {
  const fields = Object.fromEntries(
    Object.entries(type).map(([name, item]): [string, Item] => [
      name,
      {
        ...item,
        description: inline(item.description),
        typeDescription: inline(item.typeDescription),
        returns: inline(item.returns),
        ...(item.parameters
          ? {
              parameters: item.parameters.map((parameter) => ({
                ...parameter,
                description: inline(parameter.description),
              })),
            }
          : {}),
      },
    ]),
  );
  return <FumadocsTypeTable type={fields} {...props} />;
}
