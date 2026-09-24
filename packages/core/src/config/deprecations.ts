export interface Deprecation {
  /** Dot path of the old option, e.g. `theme.radius`. */
  path: string;
  /** Dot path of the new option. Omit if the option was removed without replacement. */
  replacedBy?: string;
  /** Core version in which the option became deprecated. */
  since: string;
  /** Extra hint shown to the user. */
  hint?: string;
}

/** Options that still work but will be removed. Empty until the first rename. */
export const deprecations: readonly Deprecation[] = [];

export interface DeprecationResult {
  input: Record<string, unknown>;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAt(root: Record<string, unknown>, keys: readonly string[]): unknown {
  let node: unknown = root;
  for (const key of keys) node = isRecord(node) ? node[key] : undefined;
  return node;
}

/**
 * Returns a copy of `root` with `keys` set (or deleted when `value` is `undefined` and `remove` is
 * true). Only objects along the path are copied, so functions and components elsewhere in the
 * config are left untouched (they cannot be deep-cloned).
 */
function withPath(
  root: Record<string, unknown>,
  keys: readonly string[],
  value: unknown,
  remove = false,
): Record<string, unknown> {
  const [head, ...rest] = keys as [string, ...string[]];
  const copy = { ...root };
  if (rest.length === 0) {
    if (remove) delete copy[head];
    else copy[head] = value;
    return copy;
  }
  const child = copy[head];
  copy[head] = withPath(isRecord(child) ? child : {}, rest, value, remove);
  return copy;
}

/**
 * Moves values from deprecated paths to their replacements (without overriding a value the user
 * already set at the new path) and reports one warning per deprecated option that was used.
 * The input object is not mutated.
 */
export function applyDeprecations(
  input: Record<string, unknown>,
  table: readonly Deprecation[] = deprecations,
): DeprecationResult {
  let output = input;
  const warnings: string[] = [];

  for (const entry of table) {
    const oldKeys = entry.path.split(".");
    const parent = getAt(output, oldKeys.slice(0, -1));
    const oldLeaf = oldKeys[oldKeys.length - 1] as string;
    if (!isRecord(parent) || !(oldLeaf in parent)) continue;

    const value = parent[oldLeaf];
    output = withPath(output, oldKeys, undefined, true);

    let message = `"${entry.path}" is deprecated since docsivi ${entry.since}`;
    if (entry.replacedBy !== undefined) {
      message += `, use "${entry.replacedBy}" instead`;
      const newKeys = entry.replacedBy.split(".");
      const newParent = getAt(output, newKeys.slice(0, -1));
      const newLeaf = newKeys[newKeys.length - 1] as string;
      if (!(isRecord(newParent) && newLeaf in newParent)) {
        output = withPath(output, newKeys, value);
      }
    } else {
      message += " and has no replacement";
    }
    if (entry.hint !== undefined) message += `. ${entry.hint}`;
    warnings.push(message);
  }

  return { input: output, warnings };
}
