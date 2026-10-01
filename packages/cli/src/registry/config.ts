// `consify.registries.json`: lets a project name a set of registries once (`@namespace` -> a
// template URL, optionally with auth headers) and refer to items from them by short specifier
// (`@namespace/name`) instead of a full URL every time.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { CliError } from "../cli/errors.ts";

export const registrySourceSchema = z.object({
  /** Must contain the literal substring "{name}", replaced with the bare item name at fetch time. */
  url: z.string().refine((u) => u.includes("{name}"), { message: 'must contain "{name}"' }),
  /** At most one registry may set this to true — see registriesFileSchema's superRefine below. */
  default: z.boolean().optional(),
  /** Raw header name/value pairs. A value containing "${VAR}" is resolved from process.env at
   *  fetch time (see resolve.ts's interpolateEnv) — never a literal secret stored on disk. */
  headers: z.record(z.string(), z.string()).optional(),
});
export type RegistrySource = z.infer<typeof registrySourceSchema>;

export const registriesFileSchema = z
  .object({
    registries: z.record(
      z.string().regex(/^@[a-z][a-z0-9-]*$/, "namespace must look like @name"),
      registrySourceSchema,
    ),
  })
  .superRefine((file, ctx) => {
    const defaults = Object.values(file.registries).filter((r) => r.default);
    if (defaults.length > 1) {
      ctx.addIssue({ code: "custom", message: 'only one registry may be marked "default": true' });
    }
  });
export type RegistriesFile = z.infer<typeof registriesFileSchema>;

const registriesFilePath = (cwd: string) => join(cwd, "consify.registries.json");

/**
 * Empty `{ registries: {} }` when the file does not exist yet — never an error; a project with no
 * configured registries can still `consify add <full-url>` directly. An existing-but-invalid file
 * *is* an error for every caller, since a broken config file should be surfaced immediately.
 */
export function readRegistriesFile(cwd: string): RegistriesFile {
  const path = registriesFilePath(cwd);
  if (!existsSync(path)) return { registries: {} };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new CliError(`consify.registries.json is invalid JSON: ${(error as Error).message}`);
  }
  const parsed = registriesFileSchema.safeParse(json);
  if (!parsed.success) {
    throw new CliError(`consify.registries.json is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function writeRegistriesFile(cwd: string, file: RegistriesFile): void {
  writeFileSync(registriesFilePath(cwd), `${JSON.stringify(file, null, 2)}\n`);
}
