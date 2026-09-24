import { createDocsivi } from "docsivi";
import { defineDocs } from "fumadocs-mdx/macro";
import { customComponents } from "../.docsivi/components.generated";
import config from "../docs.config";

// The macro must be called in the project (Fumadocs compiles it statically).
const docs = defineDocs({
  dir: "content/docs",
  // Needed for llms.txt / llms-full.txt (page text as Markdown).
  docs: { postprocess: { includeProcessedMarkdown: true } },
});

export const docsivi = createDocsivi(config, docs, customComponents);
