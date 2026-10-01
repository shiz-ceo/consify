import { CliError } from "../cli/errors.ts";
import type { ResolvedSpecifier } from "./resolve.ts";
import { parseRegistryItem, type RegistryItem } from "./schema.ts";

export interface FetchedItem {
  item: RegistryItem;
  sourceUrl: string;
}

/**
 * One HTTP GET, JSON-parsed and schema-validated. Does not recurse into `registryDependencies` —
 * that's `add.ts`'s job, since it needs to track the whole in-flight set for cycle detection.
 */
export async function fetchRegistryItem(resolved: ResolvedSpecifier): Promise<FetchedItem> {
  let response: Response;
  try {
    response = await fetch(resolved.url, { headers: resolved.headers });
  } catch (error) {
    throw new CliError(`Could not reach ${resolved.url}: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new CliError(`${resolved.url} responded with ${response.status} ${response.statusText}`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new CliError(`${resolved.url} did not return valid JSON`);
  }
  return { item: parseRegistryItem(json, resolved.url), sourceUrl: resolved.url };
}
