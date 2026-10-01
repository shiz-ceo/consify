import { linkCatalog } from "@consify/core";
import { loadConfig } from "@consify/core/node";
import type { Command } from "commander";

/**
 * `consify links [language]`: prints the places the features offer to link to, the ids that
 * `header.links` and `footer.columns` take. Returns the exit code.
 */
export async function runLinks(
  options: { language?: string | undefined },
  cwd: string,
): Promise<number> {
  const config = await loadConfig(cwd);
  const lang = options.language ?? config.i18n.defaultLanguage;
  if (!config.i18n.languages.includes(lang)) {
    console.error(
      `"${lang}" is not one of the languages of the site: ${config.i18n.languages.join(", ")}`,
    );
    return 1;
  }
  const catalog = linkCatalog(config, lang);
  if (catalog.length === 0) {
    console.log("No feature offers a link. Add features to docs.config.ts.");
    return 0;
  }
  const width = (pick: (o: (typeof catalog)[number]) => string) =>
    Math.max(...catalog.map((option) => pick(option).length));
  const idWidth = width((o) => o.id);
  const titleWidth = width((o) => o.title);
  const urlWidth = width((o) => o.url);
  console.log(`Places to link to (${lang}). Use the id in header.links and footer.columns:\n`);
  for (const option of catalog) {
    console.log(
      `  ${option.id.padEnd(idWidth)}  ${option.title.padEnd(titleWidth)}  ${option.url.padEnd(urlWidth)}  ${option.primary ? "in the header by default" : ""}`.trimEnd(),
    );
  }
  return 0;
}

/** Registers `links` on the root program. Called once by cli/program.ts. */
export function registerLinksCommand(program: Command): void {
  program
    .command("links [language]")
    .description("Print the places header.links and footer.columns can point to")
    .action(async (language: string | undefined) => {
      process.exitCode = await runLinks({ language }, process.cwd());
    });
}
