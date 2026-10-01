// The exact, versioned, zod-validated shape a registry author's JSON must have — the one format
// every registry (official or third-party) is expected to produce. `consify add` never accepts
// anything that doesn't validate against this.
import { z } from "zod";
import { CliError } from "../cli/errors.ts";

export const registryItemTypes = ["component", "plugin", "feature", "skill", "theme"] as const;
export type RegistryItemType = (typeof registryItemTypes)[number];

export const registryItemFileSchema = z.object({
  /** Where it lands, relative to the appropriate root for the item's type — see item-types.ts. */
  path: z
    .string()
    .min(1)
    .refine((p) => !p.startsWith("/") && !p.includes(".."), {
      message: "path must be relative and must not contain '..'",
    }),
  /** The full text content of the file, inline. */
  content: z.string(),
  /** Optional — a hint for editors/registries that generate the JSON; consify itself does not
   *  branch on this today, but it is part of the shadcn-compatible shape and costs nothing to
   *  accept and pass through into the lockfile for humans reading it later. */
  type: z.string().optional(),
});
export type RegistryItemFile = z.infer<typeof registryItemFileSchema>;

/**
 * An npm package name with an optional version range (`zod`, `@scope/pkg@^1.2.0`). No `file:`, git or
 * URL specs, and nothing that starts with `-`: the value becomes an argument of `bun add`/`npm install`.
 */
const packageNamePattern = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
// Only characters of single-token ranges (`1.2.3`, `^1.2`, `~1`, `1.x`, `*`). No `| < > & %`: on Windows
// the value reaches `cmd.exe` (see `package-manager.ts`), so anything it interprets stays out. `^` is
// cmd.exe's escape character and is escaped there.
const versionRangePattern = /^[0-9A-Za-z.^~*+-]+$/;

function isPackageSpec(spec: string): boolean {
  const at = spec.indexOf("@", 1);
  if (at === -1) return packageNamePattern.test(spec);
  return packageNamePattern.test(spec.slice(0, at)) && versionRangePattern.test(spec.slice(at + 1));
}

const packageSpecSchema = z
  .string()
  .refine(isPackageSpec, "must be an npm package name with an optional version range");

/** Fields shared by every item type, regardless of whether it writes files or installs a package. */
const baseItemFields = {
  /** Bare name, no namespace — the namespace is a property of *how* it was fetched (which
   *  registry it came from), not of the item's own identity. */
  name: z.string().regex(/^[a-z][a-z0-9-]*$/, "must be lowercase letters, digits and '-'"),
  /** One-line, shown by `consify list` / `consify registry list`. */
  description: z.string().optional(),
  /** npm packages this item needs, e.g. `"shiki"` or `"@scope/pkg@^2.0.0"`. */
  dependencies: z.array(packageSpecSchema).default([]),
  /** Other registry items this one needs, resolved and installed first. Each entry is a
   *  specifier in the same format `consify add` itself accepts. */
  registryDependencies: z.array(z.string()).default([]),
};

/** `component` / `plugin` / `theme` / `skill`: a copy of files into `custom/`. */
const fileItemSchema = z.object({
  type: z.enum(["component", "plugin", "theme", "skill"]),
  ...baseItemFields,
  files: z.array(registryItemFileSchema).min(1),
});

/**
 * `feature` — always an npm package plus a `features: [...]` factory call, never a file copy.
 * `.strict()` so an old-shape `featureId`/`files` payload (from before this type became
 * package-only) is rejected with a clear "unrecognized key" error instead of being silently
 * dropped or, worse, silently accepted and ignored.
 */
const featureItemSchema = z
  .object({
    type: z.literal("feature"),
    ...baseItemFields,
    /** The npm package to install, e.g. "@consify/blog". */
    packageName: z.string().regex(packageNamePattern, "must be an npm package name"),
    /** An npm range, e.g. "^0.1.0" — defaults to "*" (latest) when omitted. */
    packageVersion: z
      .string()
      .regex(versionRangePattern, "must be an npm version range")
      .optional(),
    /** The named export to import and call as a factory, e.g. "blog". */
    exportName: z.string().regex(/^[A-Za-z_$][\w$]*$/, "must be a JavaScript identifier"),
  })
  .strict();

export const registryItemSchema = z
  .discriminatedUnion("type", [fileItemSchema, featureItemSchema])
  .refine(
    (item) =>
      !("files" in item) || new Set(item.files.map((f) => f.path)).size === item.files.length,
    { message: "duplicate path in files", path: ["files"] },
  );
export type RegistryItem = z.infer<typeof registryItemSchema>;

/**
 * Fetches nothing — pure validation of an already-parsed JSON value. Used by fetch.ts right after
 * `JSON.parse`, and by tests. Throws `CliError` (not a raw ZodError) with a human message.
 */
export function parseRegistryItem(json: unknown, sourceUrl: string): RegistryItem {
  const result = registryItemSchema.safeParse(json);
  if (!result.success) {
    throw new CliError(
      `${sourceUrl} is not a valid registry item:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
