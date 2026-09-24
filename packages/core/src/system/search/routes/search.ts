import { createFromSource } from "fumadocs-core/search/server";
import { docsivi, isStatic } from "../../../shared/router.ts";

// zero config: the default `multilingual` mode works for every language
const server = createFromSource(docsivi.source);

/** `/api/search`. Static mode pre-renders the whole index, server mode answers queries. */
export async function loader({ request }: { request: Request }) {
  return isStatic ? server.staticGET() : server.GET(request);
}
