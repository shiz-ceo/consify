import { FullSearchTrigger } from "fumadocs-ui/layouts/shared/slots/search-trigger";

/**
 * The search field of the site: a button that looks like an input, with the hotkey. It sits at the
 * top of a sidebar (the docs, the API reference) and opens the search of the feature. Every
 * feature uses this one, so the field has the same size and look everywhere.
 */
export function SearchField({ className }: { className?: string }) {
  return <FullSearchTrigger hideIfDisabled className={`w-full ${className ?? ""}`.trim()} />;
}
