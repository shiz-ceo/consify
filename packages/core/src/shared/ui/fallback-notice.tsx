import { Callout } from "fumadocs-ui/components/callout";
import { languageLabel } from "../fallback.ts";
import { format } from "../messages.ts";
import { consify } from "../router.ts";
import { useMessages } from "../use-messages.ts";

/**
 * The note on a page shown without a translation: it is the page of the default language, with a
 * link to its own address.
 */
export function FallbackNotice({
  original,
  className,
}: {
  original?: string | undefined;
  className?: string | undefined;
}) {
  const messages = useMessages();
  const language = languageLabel(consify.config, consify.config.i18n.defaultLanguage);
  return (
    <Callout type="info" {...(className ? { className } : {})}>
      {format(messages.notTranslated, { language })}
      {original ? (
        <>
          {" "}
          <a className="font-medium underline" href={original}>
            {format(messages.openOriginal, { language })}
          </a>
        </>
      ) : null}
    </Callout>
  );
}
