import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { languagePattern } from "@consify/core";
import { loadConfig, renderLocaleTemplate } from "@consify/core/node";
import type { Command } from "commander";

export interface LocaleOptions {
  /** The language tag to write the pack for, e.g. `fr`. */
  language: string | undefined;
  /** Replace the file if it exists. */
  force?: boolean | undefined;
}

/** `consify locale <language> [--force]`: writes `custom/locales/<language>.ts`. Returns the exit code. */
export async function runLocale(options: LocaleOptions, cwd: string): Promise<number> {
  const { language: lang, force } = options;
  if (!lang || !languagePattern.test(lang)) {
    console.error("Usage: consify locale <language> [--force]   (a code such as de or pt-BR)");
    return 1;
  }
  const target = join(cwd, "custom/locales", `${lang}.ts`);
  if (existsSync(target) && !force) {
    console.error(`${target} exists. Pass --force to replace it.`);
    return 1;
  }
  const config = await loadConfig(cwd);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, renderLocaleTemplate(config, lang));
  console.log(
    `Wrote custom/locales/${lang}.ts. Translate it${
      config.i18n.languages.includes(lang)
        ? "."
        : `, then add "${lang}" to i18n.languages in docs.config.ts.`
    }`,
  );
  return 0;
}

/** Registers `locale` on the root program. Called once by cli/program.ts. */
export function registerLocaleCommand(program: Command): void {
  program
    .command("locale [language]")
    .description("Write custom/locales/<language>.ts, the interface strings to translate")
    .option("--force", "replace the file if it already exists")
    .action(async (language: string | undefined, options: { force?: boolean }) => {
      process.exitCode = await runLocale({ ...options, language }, process.cwd());
    });
}
