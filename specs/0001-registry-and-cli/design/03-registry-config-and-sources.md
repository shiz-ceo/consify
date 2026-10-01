# Component: `consify.registries.json` and specifier resolution

## Purpose

Let a project name a set of registries once (`@namespace` → a template URL, optionally with auth
headers) and refer to items from them by short specifier (`@namespace/name`) instead of a full URL
every time. Also defines how a *bare* name (no `@namespace`, no URL) resolves.

## File: `packages/core/src/build/registry/config.ts`

### On-disk format: `consify.registries.json`

Lives at the project root (same level as `docs.config.ts`), committed to git (it contains no
secrets — see the auth section below).

```json
{
  "registries": {
    "@shiz-ceo": {
      "url": "https://consify.shiz-ceo.ru/r/{name}.json",
      "default": true
    },
    "@acme": {
      "url": "https://acme.dev/r/{name}.json"
    },
    "@internal": {
      "url": "https://ui.company.internal/r/{name}.json",
      "headers": {
        "Authorization": "Bearer ${COMPANY_REGISTRY_TOKEN}"
      }
    }
  }
}
```

### Zod schema

```ts
// packages/core/src/build/registry/config.ts
const registrySourceSchema = z.object({
  /** Must contain the literal substring "{name}", replaced with the bare item name at fetch time. */
  url: z.string().refine((u) => u.includes("{name}"), { message: 'must contain "{name}"' }),
  /** At most one registry may set this to true — see the "exactly one default" rule below. */
  default: z.boolean().optional(),
  /** Raw header name/value pairs. A value containing "${VAR}" is resolved from process.env at
   *  fetch time (see resolve.ts's interpolateEnv) — never a literal secret stored on disk. */
  headers: z.record(z.string(), z.string()).optional(),
});

const registriesFileSchema = z.object({
  registries: z.record(
    z.string().regex(/^@[a-z][a-z0-9-]*$/, "namespace must look like @name"),
    registrySourceSchema,
  ),
}).superRefine((file, ctx) => {
  const defaults = Object.values(file.registries).filter((r) => r.default);
  if (defaults.length > 1) {
    ctx.addIssue({ code: "custom", message: "only one registry may be marked \"default\": true" });
  }
});
export type RegistriesFile = z.infer<typeof registriesFileSchema>;
```

### Read/write functions

```ts
const registriesFilePath = (cwd: string) => join(cwd, "consify.registries.json");

/** Empty { registries: {} } when the file does not exist yet — never an error; a project with no
 *  configured registries can still `consify add <full-url>` directly. */
export function readRegistriesFile(cwd: string): RegistriesFile {
  const path = registriesFilePath(cwd);
  if (!existsSync(path)) return { registries: {} };
  const parsed = registriesFileSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    throw new CliError(`consify.registries.json is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export function writeRegistriesFile(cwd: string, file: RegistriesFile): void {
  writeFileSync(registriesFilePath(cwd), `${JSON.stringify(file, null, 2)}\n`);
}
```

## Specifier resolution (`packages/core/src/build/registry/resolve.ts`)

`consify add <specifier>` (and every `registryDependencies` entry) accepts exactly three specifier
shapes:

1. **A full URL** (`specifier` starts with `http://` or `https://`) — used as-is, no registry lookup.
2. **`@namespace/name`** — look up `@namespace` in `consify.registries.json`'s `registries`; error
   (`CliError`, listing the configured namespaces) if it isn't there. Substitute `{name}` in that
   registry's `url` with `name`.
3. **A bare `name`** (no `@`, no `/`, not a URL) — resolve against whichever registry has
   `"default": true`. Error (`CliError`) if none is marked default, naming the specifier and
   suggesting `consify registry add-source` or using `@namespace/name` / a full URL explicitly.

```ts
export type ResolvedSpecifier = { url: string; headers: Record<string, string>; displaySpecifier: string };

export function resolveSpecifier(specifier: string, registries: RegistriesFile): ResolvedSpecifier {
  if (/^https?:\/\//.test(specifier)) {
    return { url: specifier, headers: {}, displaySpecifier: specifier };
  }
  const namespaceMatch = /^(@[a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)$/.exec(specifier);
  if (namespaceMatch) {
    const [, namespace, name] = namespaceMatch;
    const source = registries.registries[namespace as string];
    if (!source) {
      const known = Object.keys(registries.registries);
      throw new CliError(
        `Unknown registry "${namespace}". ` +
          (known.length > 0 ? `Configured: ${known.join(", ")}.` : "No registries configured yet.") +
          ` Run \`consify registry add-source ${namespace} <url>\` first.`,
      );
    }
    return {
      url: (source.url as string).replace("{name}", name as string),
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
          `\`consify registry add-source <namespace> <url> --default\` first.`,
      );
    }
    const [, source] = entry;
    return {
      url: source.url.replace("{name}", specifier),
      headers: interpolateEnv(source.headers ?? {}),
      displaySpecifier: specifier,
    };
  }
  throw new CliError(
    `"${specifier}" is not a valid specifier — expected a URL, "@namespace/name", or a bare name.`,
  );
}
```

### `interpolateEnv`

```ts
/** Replaces every "${VAR_NAME}" in every header value with process.env.VAR_NAME. Throws CliError
 *  naming the missing variable if any referenced one is unset — fails before any network request,
 *  not after a confusing 401. */
function interpolateEnv(headers: Record<string, string>): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    resolved[key] = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name: string) => {
      const envValue = process.env[name];
      if (envValue === undefined) {
        throw new CliError(
          `consify.registries.json references $\{${name}\} in a header, but that environment ` +
            `variable is not set.`,
        );
      }
      return envValue;
    });
  }
  return resolved;
}
```

## `consify registry add-source` / `remove-source` / `list-sources`

File: `packages/core/src/build/registry/sources.ts`.

```ts
const addSourceOptionsSchema = z.object({
  namespace: z.string().regex(/^@[a-z][a-z0-9-]*$/, 'must look like "@name"'),
  url: z.string().refine((u) => u.includes("{name}"), { message: 'must contain "{name}"' }),
  header: z.array(z.string()).default([]), // raw "Name: value" strings from repeated --header flags
  default: z.boolean().default(false),
  force: z.boolean().default(false), // required to overwrite an already-configured namespace
});
```

`--header "Authorization: Bearer ${TOKEN}"` may be passed more than once (commander's
`.option("--header <value>", "...", collectInto, [])` pattern — collect into an array); each is
split on the first `:` into a header name/value pair, trimmed, and stored under `headers` in the
registry source entry.

Logic (`addSource(options, cwd)`):

1. Read the current `consify.registries.json` (`readRegistriesFile`).
2. If `options.namespace` already exists and `!options.force` → `CliError` telling the user to pass
   `--force` to replace it (mirrors the exact wording style of `consify skill sync`'s equivalent
   guard).
3. If `options.default` is true, clear `default` on every other existing entry first (only one
   default at a time — enforced here proactively rather than relying solely on the schema's
   `superRefine`, so the write always produces a valid file rather than requiring the caller to
   manually clear the old one).
4. Write the new/updated entry, call `writeRegistriesFile`.
5. Print what was written (namespace, URL template, whether it's now the default, whether it has
   headers — never print the *resolved* header values, only that headers are configured and which
   env vars they reference, to avoid ever echoing a secret to a terminal/log even accidentally).

`removeSource(namespace, cwd)`: reads the file, errors (`CliError`) if the namespace isn't
configured, deletes the entry, writes back. **Does not** touch any already-installed items that came
from that namespace — their lockfile entries are untouched (removing a *source* is not the same as
removing installed *items*; `consify remove` is the only thing that deletes installed files — see
`design/04`). Note this explicitly in the command's `--help` description so it isn't surprising.

`listSources(cwd)`: reads the file, prints a table — namespace, URL template, default (✓/blank),
auth (yes/no, never the value) — one line per configured registry. Prints
`"No registries configured. consify registry add-source <namespace> <url>"` when empty, not a bare
empty table.

## Edge cases

- **`consify.registries.json` doesn't exist at all** — every read path treats this as
  `{ registries: {} }`, never an error by itself; only resolving a specifier that actually needs a
  registry (namespaced or bare-default) fails, with a message that suggests creating one.
- **The file exists but is invalid JSON, or fails schema validation** — this **is** an error
  (`CliError`) for every command that reads it, including `consify add <full-url>` (even though that
  specific invocation doesn't need the registries file at all) — a broken config file should be
  surfaced immediately, not silently ignored only for the commands that happen to need it, since a
  broken file is itself a signal something is wrong that the user should fix.
- **A `{name}` placeholder appears more than once in a template URL** (`"https://x.dev/{name}/r/{name}.json"`)
  — `String.replace` only replaces the first occurrence; use `replaceAll` in the real implementation
  instead of `replace` (the pseudocode above simplifies this — call this out explicitly as an
  implementation correctness requirement, not a design choice, since using `.replace` here would be
  a genuine bug for a legitimate (if unusual) template URL).
- **A namespace collides with `@shiz-ceo`-the-official-default seeded by `create-consify`** — a user
  is free to `--force`-overwrite the seeded default entry; nothing pins it as special beyond being
  present in the generated file (see `design/04`/`tasks.md` for what `create-consify` actually seeds).
