"use client";

import type { SharedProps } from "fumadocs-ui/components/dialog/search";
import DefaultSearchDialog from "fumadocs-ui/components/dialog/search-default";
import { type ComponentType, useEffect } from "react";
import { useLocation } from "react-router";
import StaticSearchDialog from "./static-search.tsx";

/**
 * Opens the search of the Scalar API reference by clicking its (hidden) search button. Scalar has
 * no API for this. Returns `false` when the button is not there (Scalar not rendered yet, or its
 * markup changed in a newer version).
 */
export function openScalarSearch(): boolean {
  const button =
    document.querySelector<HTMLButtonElement>(
      ".scalar-app .t-doc__sidebar button.bg-sidebar-b-search",
    ) ??
    [...document.querySelectorAll<HTMLButtonElement>(".scalar-app button")].find((b) =>
      /search/i.test(b.textContent ?? ""),
    );
  button?.click();
  return button !== undefined;
}

/** `/{lang}/api`: the page where the search of the header belongs to the API reference. */
function useIsApiPage(): boolean {
  return /^\/[^/]+\/api\/?$/.test(useLocation().pathname);
}

/**
 * The search dialog of the site. On the API page the header search opens Scalar's search (the
 * one that knows the operations and models), everywhere else it is the docs search.
 */
function SearchBridge({ Docs, ...props }: SharedProps & { Docs: ComponentType<SharedProps> }) {
  const onApi = useIsApiPage();
  const { open, onOpenChange } = props;

  useEffect(() => {
    if (!onApi || !open) return;
    openScalarSearch();
    onOpenChange(false);
  }, [onApi, open, onOpenChange]);

  return onApi ? null : <Docs {...props} />;
}

/** Server mode: the docs search asks the server. */
export function ServerSearchDialog(props: SharedProps) {
  return <SearchBridge {...props} Docs={DefaultSearchDialog} />;
}

/** Static mode: the docs search runs in the browser. */
export function StaticSearchBridge(props: SharedProps) {
  return <SearchBridge {...props} Docs={StaticSearchDialog} />;
}
