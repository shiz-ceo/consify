// `consify registry add-source` / `remove-source` / `list-sources`: manage the entries of
// consify.registries.json.
import type { Command } from "commander";
import { z } from "zod";
import { CliError, runAction } from "../cli/errors.ts";
import { color } from "../colors.ts";
import { type RegistriesFile, readRegistriesFile, writeRegistriesFile } from "./config.ts";

const addSourceOptionsSchema = z.object({
  namespace: z.string().regex(/^@[a-z][a-z0-9-]*$/, 'must look like "@name"'),
  url: z.string().refine((u) => u.includes("{name}"), { message: 'must contain "{name}"' }),
  header: z.array(z.string()).default([]), // raw "Name: value" strings from repeated --header flags
  default: z.boolean().default(false),
  force: z.boolean().default(false), // required to overwrite an already-configured namespace
});
export type AddSourceOptions = z.infer<typeof addSourceOptionsSchema>;

/** Splits "Name: value" into a trimmed [name, value] pair. Throws CliError on a malformed header. */
function parseHeader(raw: string): [string, string] {
  const colonIndex = raw.indexOf(":");
  if (colonIndex === -1) {
    throw new CliError(`--header "${raw}" is not "Name: value"`);
  }
  return [raw.slice(0, colonIndex).trim(), raw.slice(colonIndex + 1).trim()];
}

export function addSource(rawOptions: unknown, cwd: string): void {
  const options = addSourceOptionsSchema.parse(rawOptions);
  const file = readRegistriesFile(cwd);

  if (file.registries[options.namespace] && !options.force) {
    throw new CliError(`"${options.namespace}" is already configured. Pass --force to replace it.`);
  }

  if (options.default) {
    for (const source of Object.values(file.registries)) delete source.default;
  }

  const headers =
    options.header.length > 0 ? Object.fromEntries(options.header.map(parseHeader)) : undefined;
  file.registries[options.namespace] = {
    url: options.url,
    ...(options.default ? { default: true } : {}),
    ...(headers ? { headers } : {}),
  };
  writeRegistriesFile(cwd, file);

  console.log(`${color.green("added")} ${options.namespace} -> ${options.url}`);
  if (options.default) console.log("  (now the default registry)");
  if (headers) {
    console.log(
      `  headers: ${Object.entries(headers)
        .map(
          ([name, value]) => `${name} (from ${envVarsIn(value).join(", ") || "a literal value"})`,
        )
        .join(", ")}`,
    );
  }
}

function envVarsIn(value: string): string[] {
  return [...value.matchAll(/\$\{([A-Z_][A-Z0-9_]*)\}/g)].map((m) => m[1] as string);
}

export function removeSource(namespace: string, cwd: string): void {
  const file = readRegistriesFile(cwd);
  if (!file.registries[namespace]) {
    throw new CliError(`"${namespace}" is not configured. See \`consify registry list-sources\`.`);
  }
  delete file.registries[namespace];
  writeRegistriesFile(cwd, file);
  console.log(
    `${color.red("removed")} ${namespace}. Items already installed from it are untouched — ` +
      "use `consify remove <specifier>` to uninstall one.",
  );
}

export function listSources(cwd: string): void {
  const file: RegistriesFile = readRegistriesFile(cwd);
  const entries = Object.entries(file.registries);
  if (entries.length === 0) {
    console.log("No registries configured. consify registry add-source <namespace> <url>");
    return;
  }
  const nsWidth = Math.max(...entries.map(([ns]) => ns.length));
  const urlWidth = Math.max(...entries.map(([, source]) => source.url.length));
  for (const [namespace, source] of entries) {
    const defaultFlag = source.default ? "✓" : " ";
    const authFlag = source.headers && Object.keys(source.headers).length > 0 ? "yes" : "no";
    console.log(
      `  ${namespace.padEnd(nsWidth)}  ${source.url.padEnd(urlWidth)}  default: ${defaultFlag}  auth: ${authFlag}`,
    );
  }
}

/** Registers `registry add-source` / `remove-source` / `list-sources` on the root program. */
export function registerRegistrySourceCommands(registry: Command): void {
  registry
    .command("add-source <namespace> <url>")
    .description('Configure a registry ("@name" -> a template URL containing "{name}")')
    .option(
      "--header <value>",
      '"Name: value" (repeatable) — a value may reference "${ENV_VAR}"',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option("--default", "make this the registry a bare name resolves against")
    .option("--force", "replace an already-configured namespace")
    .action(async (namespace: string, url: string, rawOptions: Record<string, unknown>) => {
      process.exitCode = await runAction(async () => {
        addSource({ ...rawOptions, namespace, url }, process.cwd());
        return 0;
      });
    });

  registry
    .command("remove-source <namespace>")
    .description("Forget a configured registry (installed items are untouched)")
    .action(async (namespace: string) => {
      process.exitCode = await runAction(async () => {
        removeSource(namespace, process.cwd());
        return 0;
      });
    });

  registry
    .command("list-sources")
    .description("List the configured registries")
    .action(async () => {
      process.exitCode = await runAction(async () => {
        listSources(process.cwd());
        return 0;
      });
    });
}
