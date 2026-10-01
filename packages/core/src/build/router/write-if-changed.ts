import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Writes a file (and its folders) unless it already has this content, so watchers stay quiet. */
export function writeIfChanged(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && readFileSync(path, "utf8") === content) return;
  writeFileSync(path, content);
}
