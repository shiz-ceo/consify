import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "fumadocs-ui/components/dialog/search";
import { useI18n } from "fumadocs-ui/contexts/i18n";
import { useEffect } from "react";
import { useMatches } from "react-router";
import type { FeatureSearch } from "../../feature/types.ts";
import { consify, isStatic } from "../../shared/router.ts";
import { pageSearch } from "../../shared/search.ts";

/** The dialog for one search: the hook of the feature fills it, the look is the same for every feature. */
function Engine({
  useSearch,
  ...props
}: SharedProps & { useSearch: NonNullable<FeatureSearch["useSearch"]> }) {
  const { locale } = useI18n();
  const { search, setSearch, isLoading, items } = useSearch({
    lang: locale ?? consify.i18n.defaultLanguage,
    isStatic,
  });
  return (
    <SearchDialog search={search} onSearchChange={setSearch} isLoading={isLoading} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList items={items} />
      </SearchDialogContent>
    </SearchDialog>
  );
}

/** A page with a search of its own: the field of the site opens that one, no dialog is shown. */
function Takeover({ open, onOpenChange, spec }: SharedProps & { spec: FeatureSearch }) {
  useEffect(() => {
    if (!open) return;
    spec.open?.();
    onOpenChange(false);
  }, [open, onOpenChange, spec]);
  return null;
}

/**
 * The search dialog of the site. Every feature has its own search (the docs search their pages, the
 * blog its posts), so the dialog is the one of the feature the reader is on. It looks the same
 * everywhere.
 */
export default function SiteSearchDialog(props: SharedProps) {
  const page = useMatches()
    .map((match) => (match.handle as { page?: string } | undefined)?.page)
    .findLast((value) => value !== undefined);
  const spec = pageSearch(consify, page);
  if (!spec) return null;
  if (spec.open) return <Takeover spec={spec} {...props} />;
  // keyed by feature: a hook must not change between renders of one component
  return spec.useSearch ? <Engine key={page} useSearch={spec.useSearch} {...props} /> : null;
}
