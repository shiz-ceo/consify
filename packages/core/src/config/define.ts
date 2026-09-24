import { z } from "zod";
import { applyDeprecations } from "./deprecations.ts";
import { type DocsConfig, type DocsConfigInput, docsConfigSchema } from "./schema.ts";

export class DocsConfigError extends Error {
  override readonly name = "DocsConfigError";
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

export interface ParseOptions {
  /** Called once per deprecated option in use. Defaults to `console.warn`. */
  onWarning?: (message: string) => void;
}

/** Validates raw config and returns the normalized, frozen result. Throws `DocsConfigError`. */
export function parseDocsConfig(input: unknown, options: ParseOptions = {}): Readonly<DocsConfig> {
  const onWarning = options.onWarning ?? ((m: string) => console.warn(`[docsivi] ${m}`));
  let raw = input;
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    const result = applyDeprecations(input as Record<string, unknown>);
    for (const warning of result.warnings) onWarning(warning);
    raw = result.input;
  }

  const parsed = docsConfigSchema.safeParse(raw);
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
export function defineConfig(input: DocsConfigInput, options?: ParseOptions): Readonly<DocsConfig> {
  return parseDocsConfig(input, options);
}
