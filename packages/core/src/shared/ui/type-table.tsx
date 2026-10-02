import type { TypeTable as FumadocsTypeTable } from "fumadocs-ui/components/type-table";
import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { useMessages } from "../use-messages.ts";
import { HoverBox, useHoverCard } from "./hover-card.tsx";
import { inline } from "./inline-marks.tsx";
import { highlight } from "./type-highlight.tsx";

type Field = ComponentProps<typeof FumadocsTypeTable>["type"][string];

export interface TypeTableProps {
  /** The fields: the name is the key. The same fields as `<TypeTable>` of Fumadocs has. */
  type: Record<string, Field>;
  /** A title above the table (`Options`). */
  title?: string;
  /** Makes the address of a field `#<id>-<name>`. */
  id?: string;
  className?: string;
}

/** The "i" that opens the full type of a field. */
function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7.5" fill="currentColor" />
      <rect x="7.1" y="7" width="1.8" height="4.6" rx="0.5" fill="var(--color-fd-card)" />
      <circle cx="8" cy="4.8" r="1" fill="var(--color-fd-card)" />
    </svg>
  );
}

/**
 * A table of the fields of an object: for every field its name, type and default on one line, and
 * the description under it. A type that is too long for the line goes to `typeDescription`: it is in
 * a hint on the "i" next to the name. Markdown marks (`code`, **bold**, links) work in the texts.
 *
 * @example
 * <TypeTable title="Options" type={{ throttle: { type: "number", default: "100", description: "…" } }} />
 */
export function TypeTable({ type, title, id, className }: TypeTableProps) {
  const t = useMessages();
  const entries = Object.entries(type);
  const tips: ReactNode[] = [];
  const shown = useHoverCard<ReactNode>({
    pick: (target) => {
      const anchor = target.closest<HTMLElement>("[data-type-tip]");
      if (!anchor || !anchor.closest(".consify-types")?.contains(anchor)) return null;
      return { anchor, data: tips[Number(anchor.dataset.typeTip)] };
    },
    openDelay: 120,
    closeDelay: 80,
    toggleOnClick: true,
  });
  // the hints of this table: the card is one for all of them, and the pick above reads this list
  const tipOf = (node: ReactNode) => tips.push(node) - 1;

  return (
    <div id={id} className={`consify-types${className ? ` ${className}` : ""}`}>
      {title ? <div className="consify-types-title">{title}</div> : null}
      {entries.map(([name, field]) => {
        const {
          description,
          type: kind,
          typeDescription,
          typeDescriptionLink,
          default: byDefault,
          required,
          deprecated,
          parameters,
          returns,
        } = field;
        const tip = typeDescription ? tipOf(highlight(typeDescription)) : undefined;
        return (
          // a field opens and closes (open at first): a closed one is its line
          <details
            key={name}
            id={id ? `${id}-${name}` : undefined}
            className="consify-types-row"
            open
          >
            <summary className="consify-types-line">
              <span className="consify-types-head">
                <code className={`consify-types-name${deprecated ? " is-deprecated" : ""}`}>
                  {name}
                  {required ? "" : "?"}
                </code>
                {tip === undefined ? null : (
                  <button
                    type="button"
                    className="consify-types-info"
                    data-type-tip={tip}
                    aria-label={t.typeTableInfo}
                  >
                    <InfoIcon />
                  </button>
                )}
                {kind ? (
                  typeDescriptionLink ? (
                    <a className="consify-types-type" href={typeDescriptionLink}>
                      {kind}
                    </a>
                  ) : (
                    <code className="consify-types-type">{highlight(kind)}</code>
                  )
                ) : null}
                {byDefault ? (
                  <span className="consify-types-default">
                    {t.typeTableDefault.replace("{value}", "")}
                    <code>{highlight(byDefault)}</code>
                  </span>
                ) : null}
                {deprecated ? (
                  <span className="consify-types-deprecated">{t.typeTableDeprecated}</span>
                ) : null}
              </span>
              <ChevronDown className="consify-types-chevron" aria-hidden="true" />
            </summary>
            {description ? <div className="consify-types-text">{inline(description)}</div> : null}
            {parameters && parameters.length > 0 ? (
              <dl className="consify-types-params">
                <dt>{t.typeTableParameters}</dt>
                {parameters.map((parameter) => (
                  <dd key={parameter.name}>
                    <code>{parameter.name}</code>
                    {parameter.description ? <> – {inline(parameter.description)}</> : null}
                  </dd>
                ))}
              </dl>
            ) : null}
            {returns ? (
              <dl className="consify-types-params">
                <dt>{t.typeTableReturns}</dt>
                <dd>{inline(returns)}</dd>
              </dl>
            ) : null}
          </details>
        );
      })}
      {shown ? (
        <HoverBox
          anchor={shown.anchor}
          className="consify-type-tip"
          role="tooltip"
          prefer="above"
          arrow
        >
          {shown.data}
        </HoverBox>
      ) : null}
    </div>
  );
}
