import { z } from "zod";
import { type DocsConfig, type DocsConfigInput, docsConfigSchema } from "./schema.ts";

/**
 * Thrown when `docs.config.ts` is not valid. `message` is a readable list of the problems;
 * `issues` has the same problems as Zod issues, with their `path` in the config.
 */
export class DocsConfigError extends Error {
  override readonly name = "DocsConfigError";
  /** The problems found, each with the `path` of the wrong option. */
  readonly issues: z.core.$ZodIssue[];
  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message);
    this.issues = issues;
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    // Custom components and plugins are user objects; only plain data is frozen.
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === Array.prototype) {
      Object.freeze(value);
      for (const child of Object.values(value)) deepFreeze(child);
    }
  }
  return value;
}

/** Validates raw config and returns the normalized, frozen result. Throws `DocsConfigError`. */
export function parseDocsConfig(input: unknown): Readonly<DocsConfig> {
  const parsed = docsConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocsConfigError(
      `Invalid docs.config:\n${z.prettifyError(parsed.error)}`,
      parsed.error.issues,
    );
  }
  return deepFreeze(parsed.data);
}

/**
 * Entry point for `docs.config.ts`. The argument is typed for editor hints, and validated at runtime.
 *
 * @example
 * export default defineConfig({ site: { name: "My Product" } });
 */
export function defineConfig(input: DocsConfigInput): Readonly<DocsConfig> {
  return parseDocsConfig(input);
}
