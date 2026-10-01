// `consify.registry-lock.json`: records what was installed, from where, and a content hash of
// every file at install time — so a later `consify add`/`consify remove` can tell "unmodified since
// install" from "user edited this" from "not ours at all," and so `consify list` has something to
// read. Committed to git, like bun.lock/package-lock.json.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { z } from "zod";
import { CliError } from "../cli/errors.ts";
import { registryItemTypes } from "./schema.ts";

const lockfileEntryFileSchema = z.object({ path: z.string(), hash: z.string() });

const lockfileEntrySchema = z.object({
  name: z.string(),
  type: z.enum(registryItemTypes),
  source: z.string(),
  installedAt: z.string(),
  files: z.array(lockfileEntryFileSchema),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  /** Only set for `type: "feature"` entries — the npm package `consify add` ran `bun add` for, so
   *  `consify remove` can name it in its "the npm package itself was not removed" note. */
  packageName: z.string().optional(),
});
export type LockfileEntry = z.infer<typeof lockfileEntrySchema>;

const lockfileSchema = z.object({
  version: z.literal(1),
  items: z.record(z.string(), lockfileEntrySchema),
});
export type Lockfile = z.infer<typeof lockfileSchema>;

/** A path as the lockfile stores it: relative to the project, always with `/` (the file is committed across OSes). */
export function lockPath(cwd: string, fullPath: string): string {
  return relative(cwd, fullPath).split(sep).join("/");
}

export function sha256(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

export function hashFile(path: string): string {
  return sha256(readFileSync(path, "utf8"));
}

const lockfilePath = (cwd: string) => join(cwd, "consify.registry-lock.json");

/** Small wrapper so add.ts/remove.ts don't manipulate the raw object shape directly. */
export class LockfileHandle {
  data: Lockfile;
  private readonly cwd: string;

  constructor(data: Lockfile, cwd: string) {
    this.data = data;
    this.cwd = cwd;
  }

  get items(): Lockfile["items"] {
    return this.data.items;
  }

  set(key: string, entry: LockfileEntry): void {
    this.data.items[key] = entry;
  }

  delete(key: string): void {
    delete this.data.items[key];
  }

  /** The lockfile record of the file at `fullPath`, if `consify add` wrote it (under any specifier). */
  findByPath(fullPath: string): LockfileEntry["files"][number] | undefined {
    const target = lockPath(this.cwd, fullPath);
    for (const entry of Object.values(this.data.items)) {
      const match = entry.files.find((f) => f.path === target);
      if (match) return match;
    }
    return undefined;
  }
}

/**
 * Reads `consify.registry-lock.json`, or an empty lockfile when it does not exist yet — never an
 * error by itself. An existing-but-invalid file throws `CliError`.
 */
export function readLockfile(cwd: string): LockfileHandle {
  const path = lockfilePath(cwd);
  let raw: unknown;
  if (!existsSync(path)) {
    raw = { version: 1, items: {} };
  } else {
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new CliError(`consify.registry-lock.json is invalid JSON: ${(error as Error).message}`);
    }
  }
  const parsed = lockfileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CliError(`consify.registry-lock.json is invalid:\n${z.prettifyError(parsed.error)}`);
  }
  return new LockfileHandle(parsed.data, cwd);
}

export function writeLockfile(cwd: string, handle: LockfileHandle): void {
  writeFileSync(lockfilePath(cwd), `${JSON.stringify(handle.data, null, 2)}\n`);
}

export function itemKeyFor(specifier: string): string {
  return specifier.trim();
}
