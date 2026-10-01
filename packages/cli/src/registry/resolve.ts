// Turns a `consify add <specifier>` (or a `registryDependencies` entry) into an actual URL and the
// headers to send with it. Accepts exactly three specifier shapes: a full URL, "@namespace/name",
// or a bare name resolved against the project's default registry.
import { CliError } from "../cli/errors.ts";
import type { RegistriesFile } from "./config.ts";

export interface ResolvedSpecifier {
  url: string;
  headers: Record<string, string>;
  displaySpecifier: string;
}

/**
 * Replaces every "${VAR_NAME}" in every header value with `process.env.VAR_NAME`. Throws
 * `CliError` naming the missing variable if any referenced one is unset — fails before any network
 * request, not after a confusing 401.
 */
export function interpolateEnv(headers: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    resolved[key] = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_match, name: string) => {
      const envValue = process.env[name];
      if (envValue === undefined) {
        throw new CliError(
          `consify.registries.json references \${${name}} in a header, but that environment variable is not set.`,
        );
      }
      return envValue;
    });
  }
  return resolved;
}

export function resolveSpecifier(specifier: string, registries: RegistriesFile): ResolvedSpecifier {
  if (/^https?:\/\//.test(specifier)) {
    return { url: specifier, headers: {}, displaySpecifier: specifier };
  }

  const namespaceMatch = /^(@[a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/.exec(specifier);
  if (namespaceMatch) {
    const [, namespace, name] = namespaceMatch as unknown as [string, string, string];
    const source = registries.registries[namespace];
    if (!source) {
      const known = Object.keys(registries.registries);
      throw new CliError(
        `Unknown registry "${namespace}". ` +
          (known.length > 0
            ? `Configured: ${known.join(", ")}.`
            : "No registries configured yet.") +
          ` Run \`consify registry add-source ${namespace} <url>\` first.`,
      );
    }
    return {
      // a {name} placeholder may legitimately appear more than once in a template URL — replaceAll,
      // not replace, or a second occurrence would be left unsubstituted
      url: source.url.replaceAll("{name}", name),
      headers: interpolateEnv(source.headers ?? {}),
      displaySpecifier: specifier,
    };
  }

  if (/^[a-z][a-z0-9-]*$/.test(specifier)) {
    const entry = Object.entries(registries.registries).find(([, source]) => source.default);
    if (!entry) {
      throw new CliError(
        `"${specifier}" has no namespace and no registry is marked as default. ` +
          `Use "@namespace/${specifier}", a full URL, or run ` +
          "`consify registry add-source <namespace> <url> --default` first.",
      );
    }
    const [, source] = entry;
    return {
      url: source.url.replaceAll("{name}", specifier),
      headers: interpolateEnv(source.headers ?? {}),
      displaySpecifier: specifier,
    };
  }

  throw new CliError(
    `"${specifier}" is not a valid specifier — expected a URL, "@namespace/name", or a bare name.`,
  );
}
