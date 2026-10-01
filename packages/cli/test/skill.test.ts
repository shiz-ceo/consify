import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runSkillList, runSkillSync } from "../src/skill-command.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-skill-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function write(path: string, text: string) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
}

const skill = (name: string, text = "Body.") =>
  `---\nname: ${name}\ndescription: A test skill.\n---\n\n${text}\n`;

/** A project that depends on a consify package with one skill. */
function project(dependencies: Record<string, string> = { "@consify/fake": "1.0.0" }) {
  write("package.json", JSON.stringify({ name: "site", dependencies }));
  write(
    "node_modules/@consify/fake/package.json",
    JSON.stringify({ name: "@consify/fake", version: "1.0.0" }),
  );
  write("node_modules/@consify/fake/skills/fake-authoring/SKILL.md", skill("fake-authoring"));
}

const silent = <T>(run: () => T): { result: T; out: string } => {
  const log = console.log;
  const error = console.error;
  let out = "";
  console.log = (...parts: unknown[]) => void (out += `${parts.join(" ")}\n`);
  console.error = (...parts: unknown[]) => void (out += `${parts.join(" ")}\n`);
  try {
    return { result: run(), out };
  } finally {
    console.log = log;
    console.error = error;
  }
};

describe("consify skill sync", () => {
  test("copies the skills of the consify packages the project depends on", () => {
    project();
    const { result } = silent(() => runSkillSync({}, cwd));
    expect(result).toBe(0);
    expect(readFileSync(join(cwd, ".claude/skills/fake-authoring/SKILL.md"), "utf8")).toContain(
      "Body.",
    );
    const manifest = JSON.parse(
      readFileSync(join(cwd, ".claude/skills/.consify-skills.json"), "utf8"),
    );
    expect(manifest["fake-authoring"]).toEqual({ source: "@consify/fake", version: "1.0.0" });
  });

  test("the project's own custom/skills win by name", () => {
    project();
    write("custom/skills/fake-authoring/SKILL.md", skill("fake-authoring", "Ours."));
    silent(() => runSkillSync({}, cwd));
    expect(readFileSync(join(cwd, ".claude/skills/fake-authoring/SKILL.md"), "utf8")).toContain(
      "Ours.",
    );
  });

  test("removes a skill whose package is gone", () => {
    project();
    silent(() => runSkillSync({}, cwd));
    project({});
    const { out } = silent(() => runSkillSync({}, cwd));
    expect(out).toContain("removed fake-authoring");
    expect(existsSync(join(cwd, ".claude/skills/fake-authoring"))).toBe(false);
  });

  test("refuses to overwrite a folder it did not create, without --force", () => {
    project();
    write(".claude/skills/fake-authoring/SKILL.md", "hand-made");
    const { result, out } = silent(() => runSkillSync({}, cwd));
    expect(result).toBe(1);
    expect(out).toContain("--force");
    expect(readFileSync(join(cwd, ".claude/skills/fake-authoring/SKILL.md"), "utf8")).toBe(
      "hand-made",
    );
    silent(() => runSkillSync({ force: true }, cwd));
    expect(readFileSync(join(cwd, ".claude/skills/fake-authoring/SKILL.md"), "utf8")).toContain(
      "Body.",
    );
  });

  test("a skill name that is not a folder name is refused", () => {
    project();
    write("custom/skills/bad/SKILL.md", skill("../../src"));
    expect(() => silent(() => runSkillSync({}, cwd))).toThrow(/skill name/);
  });

  test("list prints without writing anything", () => {
    project();
    const { out } = silent(() => runSkillList(cwd));
    expect(out).toContain("fake-authoring");
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
  });
});
