import { useMemo } from "react";
import { HoverBox, useHoverCard } from "./hover-card.tsx";

/**
 * The popups of the Twoslash hovers of a page (`<button data-tw="3">` in its code blocks), one list
 * of HTML. Only one popup is shown at a time, so there is one element for it, not one for each
 * hover. It opens after a short delay on pointer hover, at once on focus or a tap.
 */
export function TwoslashPopups({ data }: { data: string }) {
  const popups = useMemo(() => data.split("\u0001"), [data]);
  const shown = useHoverCard<string>({
    pick: (target) => {
      const anchor = target.closest<HTMLElement>("button[data-tw]");
      return anchor ? { anchor, data: popups[Number(anchor.dataset.tw)] ?? "" } : null;
    },
    openDelay: 200,
    closeDelay: 100,
    toggleOnClick: true,
  });
  if (!shown) return null;
  return (
    <HoverBox
      anchor={shown.anchor}
      className="fd-twoslash-popover"
      role="dialog"
      html={shown.data}
    />
  );
}
