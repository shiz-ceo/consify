// Where the files of a registry item land, by its type. Installing npm `dependencies` is common to
// all types and handled once in add.ts.
import { join } from "node:path";
import type { RegistryItem } from "./schema.ts";

/**
 * The folder every `files[].path` of an item is relative to. A `feature` item writes no files (it
 * installs an npm package), so it has none.
 */
export function resolveItemRoot(
  item: Exclude<RegistryItem, { type: "feature" }>,
  cwd: string,
): string {
  switch (item.type) {
    case "component":
      return join(cwd, "custom/components");
    case "plugin":
      return join(cwd, "custom/plugins");
    case "theme":
      // typically just "theme.css", landing at custom/theme.css
      return join(cwd, "custom");
    case "skill":
      // `consify skill sync` collects custom/skills/<name>/ into .claude/skills/
      return join(cwd, "custom/skills", item.name);
  }
}
