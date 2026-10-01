// `consify skill sync`: collects the skills of the consify packages a project uses, and its own,
// into the project's `.claude/skills/`, so Claude Code discovers them. A package offers skills in
// `skills/<name>/SKILL.md`; a project in `custom/skills/<name>/SKILL.md`.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { packageDirs } from "@consify/core/node";
import type { Command } from "commander";

interface SkillEntry {
  /** The folder name under `.claude/skills/`, read from the skill's own `SKILL.md` front matter. */
  name: string;
  /** Where it came from, for `consify skill list` and the manifest — a package name or `custom:<id>`. */
  source: string;
  version: string;
  dir: string;
}

type Manifest = Record<string, { source: string; version: string }>;

function readManifest(path: string): Manifest {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Manifest;
  } catch {
    return {};
  }
}

function packageNameAndVersion(dir: string): { name: string; version: string } {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      name?: string;
      version?: string;
    };
    return { name: pkg.name ?? dir, version: pkg.version ?? "0.0.0" };
  } catch {
    return { name: dir, version: "0.0.0" };
  }
}

/** A skill name is a folder under `.claude/skills/` that sync deletes and recreates. */
const skillNamePattern = /^[a-z0-9][a-z0-9-]*$/;

function skillName(skillMd: string): string | undefined {
  const text = readFileSync(skillMd, "utf8");
  const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const name = /^name:\s*(.+)$/m.exec(header)?.[1]?.trim();
  if (name === undefined) return undefined;
  if (!skillNamePattern.test(name)) {
    throw new Error(`${skillMd}: skill name "${name}" must be lowercase letters, digits and \`-\``);
  }
  return name;
}

/** The skills in `skills/<name>/SKILL.md` of a folder. */
function skillsIn(root: string, source: string, version: string): SkillEntry[] {
  const skillsDir = join(root, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).flatMap((entry) => {
    const dir = join(skillsDir, entry);
    const skillMd = join(dir, "SKILL.md");
    const name = existsSync(skillMd) ? skillName(skillMd) : undefined;
    return name ? [{ name, source, version, dir }] : [];
  });
}

/**
 * Every skill the project has: those of the consify packages it depends on (`skills/` of
 * `@consify/core`, `@consify/blog`, …), then its own (`custom/skills/`), which win by name.
 */
function collect(cwd: string): SkillEntry[] {
  const found = new Map<string, SkillEntry>();
  for (const dir of packageDirs(cwd)) {
    const { name, version } = packageNameAndVersion(dir);
    for (const entry of skillsIn(dir, name, version)) found.set(entry.name, entry);
  }
  for (const entry of skillsIn(join(cwd, "custom"), "custom", "0.0.0")) {
    found.set(entry.name, entry);
  }
  return [...found.values()];
}

/** `consify skill list`: the skills that would be synced. */
export function runSkillList(cwd: string): number {
  const entries = collect(cwd);
  if (entries.length === 0) {
    console.log("No skills found: no consify package of the project ships one.");
    return 0;
  }
  const width = Math.max(...entries.map((e) => e.name.length));
  for (const entry of entries) {
    console.log(`  ${entry.name.padEnd(width)}  from ${entry.source}@${entry.version}`);
  }
  return 0;
}

/** `consify skill sync [--force]`. Returns the exit code. */
export function runSkillSync(options: { force?: boolean | undefined }, cwd: string): number {
  const entries = collect(cwd);
  const force = options.force ?? false;
  const targetRoot = join(cwd, ".claude/skills");
  const manifestPath = join(targetRoot, ".consify-skills.json");
  const previous = readManifest(manifestPath);

  mkdirSync(targetRoot, { recursive: true });
  const manifest: Manifest = {};
  let skipped = 0;
  for (const entry of entries) {
    const target = join(targetRoot, entry.name);
    const weOwnIt = entry.name in previous || !existsSync(target);
    if (!weOwnIt && !force) {
      console.error(
        `skipped ${entry.name}: .claude/skills/${entry.name} already exists and was not put there by \`consify skill sync\` — pass --force to replace it.`,
      );
      skipped++;
      continue;
    }
    rmSync(target, { recursive: true, force: true });
    cpSync(entry.dir, target, { recursive: true });
    manifest[entry.name] = { source: entry.source, version: entry.version };
    console.log(`synced ${entry.name} (from ${entry.source}@${entry.version})`);
  }

  for (const name of Object.keys(previous)) {
    // the manifest is a file of the project, anything in it is checked before it is deleted
    if (skillNamePattern.test(name) && !entries.some((e) => e.name === name)) {
      rmSync(join(targetRoot, name), { recursive: true, force: true });
      console.log(`removed ${name} (its package is no longer used)`);
    }
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${Object.keys(manifest).length} skill(s) in .claude/skills/.`);
  return skipped > 0 ? 1 : 0;
}

/** Registers `skill sync` (default) and `skill list` on the root program. */
export function registerSkillCommand(program: Command): void {
  const skill = program.command("skill").description("Sync the skills of the consify packages");
  skill
    .command("sync", { isDefault: true })
    .description(
      "Collect the skills of the consify packages and custom/skills into .claude/skills/",
    )
    .option(
      "--force",
      "replace a folder under .claude/skills/ that consify skill sync did not create",
    )
    .action((options: { force?: boolean }) => {
      process.exitCode = runSkillSync(options, process.cwd());
    });
  skill
    .command("list")
    .description("List the skills that would be synced")
    .action(() => {
      process.exitCode = runSkillList(process.cwd());
    });
}
