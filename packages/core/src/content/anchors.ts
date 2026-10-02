// The ids of the headings (the anchors of the links): explicit, in English, the same in every language,
// and a registry of them for a version of the docs. Pure functions over the text of the files, no file
// system: `consify check`, `consify build` and `consify anchors` read the files and call these.
import { posix } from "node:path";
import GithubSlugger from "github-slugger";
import { type AnchorLevel, type AnchorsConfig, validId } from "./anchor-rules.ts";

export {
  type AnchorLevel,
  type AnchorsConfig,
  type AnchorsOptions,
  anchorRules,
  validId,
} from "./anchor-rules.ts";

export interface Heading {
  /** 1 for `#`, 2 for `##`, … */
  depth: number;
  /** The text of the heading as written, without the `[#id]` mark. */
  text: string;
  /** The id written after the text, `[#id]`. */
  explicit: string | undefined;
  /** 1-based line of the file. */
  line: number;
}

const idMark = /\s*\[#([^\]]+?)\]\s*$/;
const fenceStart = /^ {0,3}(`{3,}|~{3,})/;

/** The headings of a Markdown file (`#` form), not those inside a code block. */
export function headingsOf(source: string): Heading[] {
  const headings: Heading[] = [];
  let fence: string | undefined;
  source.split(/\r?\n/).forEach((line, index) => {
    const mark = fenceStart.exec(line)?.[1];
    if (mark) {
      if (!fence) fence = mark;
      else if (mark[0] === fence[0] && mark.length >= fence.length) fence = undefined;
      return;
    }
    if (fence) return;
    const match = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (!match) return;
    const raw = match[2] as string;
    const found = idMark.exec(raw);
    headings.push({
      depth: (match[1] as string).length,
      text: found ? raw.slice(0, found.index) : raw,
      explicit: found?.[1],
      line: index + 1,
    });
  });
  return headings;
}

/** The text of a heading without its Markdown marks, as the page tree has it (`flatten`). */
export function plainHeading(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .trim();
}

export interface HeadingId {
  heading: Heading;
  /** The id the page has: the one written, or the one made of the text of the heading. */
  id: string;
  /** The id is written in the file (`[#id]`). */
  explicit: boolean;
}

/** The ids of the headings of a file, the way the page makes them (same words, same numbers for repeats). */
export function idsOf(source: string): HeadingId[] {
  const slugger = new GithubSlugger();
  return headingsOf(source).map((heading) => ({
    heading,
    explicit: heading.explicit !== undefined,
    // an id that is written does not take part in the numbering of the others
    id: heading.explicit ?? slugger.slug(plainHeading(heading.text)),
  }));
}

/** A link to a heading: the page (a path inside the feature folder) and the id, decoded. */
export interface AnchorLink {
  path: string;
  hash: string;
  /** The text of the link as written, to rewrite it. */
  target: string;
  line: number;
}

/**
 * The links of a file to a heading (`./page.mdx#id`, `#id`), with the page they go to. A link to
 * another site, an address of the site (`/en/docs/…`) and one to a file that is not a page are
 * not here: the file of the link cannot say where they lead.
 */
export function linksOf(source: string, from: string): AnchorLink[] {
  const links: AnchorLink[] = [];
  let fence: string | undefined;
  source.split(/\r?\n/).forEach((line, index) => {
    const mark = fenceStart.exec(line)?.[1];
    if (mark) {
      if (!fence) fence = mark;
      else if (mark[0] === fence[0] && mark.length >= fence.length) fence = undefined;
      return;
    }
    if (fence) return;
    const text = line.replace(/`[^`]*`/g, (code) => " ".repeat(code.length));
    for (const match of text.matchAll(/\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      const target = match[1] as string;
      const resolved = resolveLink(target, from);
      if (resolved) links.push({ ...resolved, target, line: index + 1 });
    }
  });
  return links;
}

/** Where `target` (as written in the file `from`) goes: a page and an id. `undefined` when it is not such a link. */
export function resolveLink(
  target: string,
  from: string,
): { path: string; hash: string } | undefined {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/") || target.startsWith("//")) {
    return undefined;
  }
  const at = target.indexOf("#");
  if (at < 0) return undefined;
  const file = target.slice(0, at);
  let hash = target.slice(at + 1);
  if (!hash) return undefined;
  try {
    hash = decodeURIComponent(hash);
  } catch {
    // not an encoded text: it is compared as it is
  }
  if (file === "") return { path: from, hash };
  if (!/\.mdx?$/.test(file)) return undefined;
  const path = posix.normalize(posix.join(posix.dirname(from), file));
  return path.startsWith("..") ? undefined : { path, hash };
}

const russian: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ї: "yi",
  є: "ye",
  ґ: "g",
};

/**
 * A heading in Cyrillic as English letters (`Быстрый путь` → `bystryy-put`), for an id that has to be
 * written. `undefined` when there is nothing to make of it (another script, or only signs).
 * It is a start: the registry is where the ids are read and made better.
 */
export function transliterate(text: string): string | undefined {
  const latin = [...plainHeading(text).toLowerCase()].map((char) => russian[char] ?? char).join("");
  // anything that is still not Latin (Greek, Chinese, …) cannot be written as an id
  if (/[^\x00-\x7f]/.test(latin)) return undefined;
  const id = new GithubSlugger()
    .slug(latin)
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!id) return undefined;
  const words = id.split("-");
  let short = words[0] as string;
  for (const word of words.slice(1)) {
    if (`${short}-${word}`.length > 48) break;
    short += `-${word}`;
  }
  return validId.test(short) ? short : undefined;
}

/** A page of a feature in one language. */
export interface AnchorPage {
  lang: string;
  /** The path inside the folder of the feature, `v1/getting-started/quick-start.mdx`. */
  path: string;
  text: string;
}

/** The ids of the pages of a version: the path inside the folder of the version → the ids. */
export type Registry = Record<string, string[]>;

export interface AnchorsInput {
  defaultLanguage: string;
  config: AnchorsConfig;
  pages: AnchorPage[];
  /** The registry of each scope (`v1`, `""`): `undefined` when its `anchors.json` is not there, an `Error` when it is not valid. */
  registries: Map<string, Registry | Error | undefined>;
}

export interface AnchorDiagnostic {
  level: "error" | "warn";
  /** The file (`ru/v1/page.mdx:12`) or the registry the message is about. */
  where: string;
  message: string;
}

/** The key of a page in the registry of its scope: its path inside the folder of the version. */
export function registryKey(scope: string, path: string): string {
  return scope && path.startsWith(`${scope}/`) ? path.slice(scope.length + 1) : path;
}

/**
 * Checks the headings and the links of the pages of a feature against the registries of its versions:
 * every heading has an id that is in the registry, the translations have the ids of the original, no
 * id of the registry is lost, and every link goes to an id that exists.
 */
export function checkAnchors(input: AnchorsInput): AnchorDiagnostic[] {
  const { defaultLanguage, config, pages, registries } = input;
  const out: AnchorDiagnostic[] = [];
  const add = (level: AnchorLevel, where: string, message: string) => {
    if (level !== "off") out.push({ level, where, message });
  };
  const registryOf = (path: string) => {
    const scope = config.scope(path);
    const registry = registries.get(scope);
    return { scope, registry: registry instanceof Error ? undefined : registry };
  };
  const named = new Set<string>();

  for (const page of pages) {
    const { scope, registry } = registryOf(page.path);
    const file = `${page.lang}/${page.path}`;
    const known = registries.get(scope);
    if (known === undefined || known instanceof Error) {
      // said once for the version, not for every page of it; the headings are still checked
      const where = `${defaultLanguage}/${scope ? `${scope}/` : ""}anchors.json`;
      if (!named.has(where)) {
        named.add(where);
        add(
          "error",
          where,
          known instanceof Error
            ? `the registry of anchors is not valid: ${known.message}`
            : "there is no registry of anchors (run `consify anchors sync` to make it)",
        );
      }
    }
    const listed = new Set(registry?.[registryKey(scope, page.path)] ?? []);
    const seen = new Set<string>();
    for (const { heading, id, explicit } of idsOf(page.text)) {
      const where = `${file}:${heading.line}`;
      const text = plainHeading(heading.text);
      if (!explicit && !validId.test(id)) {
        add(
          config.missing,
          where,
          `the heading "${text}" has no id of its own: add \`[#english-id]\` to it (its own id is "${id}")`,
        );
        continue;
      }
      if (!validId.test(id)) {
        add(
          config.unknown,
          where,
          `the id "${id}" is not lowercase English words and digits joined by "-" or "."`,
        );
        continue;
      }
      if (seen.has(id)) add(config.unknown, where, `the id "${id}" is used twice on this page`);
      seen.add(id);
      // with no registry there is nothing to compare with: its absence is said once, above
      if (registry && !listed.has(id)) {
        add(
          config.unknown,
          where,
          `the id "${id}" is not in anchors.json (add it there, or run \`consify anchors sync\`)`,
        );
      }
    }
  }

  // the ids of the registry: all of them are on the page of the original, and in its translations
  const byLanguage = new Map<string, Map<string, AnchorPage>>();
  for (const page of pages) {
    const files = byLanguage.get(page.lang) ?? new Map<string, AnchorPage>();
    files.set(page.path, page);
    byLanguage.set(page.lang, files);
  }
  const originals = byLanguage.get(defaultLanguage) ?? new Map<string, AnchorPage>();
  for (const [scope, registry] of registries) {
    if (!registry || registry instanceof Error) continue;
    const where = `${defaultLanguage}/${scope ? `${scope}/` : ""}anchors.json`;
    for (const [key, ids] of Object.entries(registry)) {
      const path = scope ? `${scope}/${key}` : key;
      const original = originals.get(path);
      if (!original) {
        add(config.unused, where, `"${key}" is in the registry, but there is no such page`);
        continue;
      }
      const have = new Set(idsOf(original.text).map((entry) => entry.id));
      for (const id of ids) {
        if (!have.has(id)) {
          add(
            config.unused,
            where,
            `"${key}": the id "${id}" is not on the page any more (a heading was removed or renamed: links to it are lost)`,
          );
        }
      }
      for (const [lang, files] of byLanguage) {
        const translated = files.get(path);
        if (lang === defaultLanguage || !translated) continue;
        const present = new Set(idsOf(translated.text).map((entry) => entry.id));
        for (const id of ids.filter((id) => have.has(id) && !present.has(id))) {
          add(
            config.translated,
            `${lang}/${path}`,
            `the page has no heading with the id "${id}" that the original has`,
          );
        }
      }
    }
  }

  // a link goes to an id of the registry of its page
  for (const page of pages) {
    for (const link of linksOf(page.text, page.path)) {
      const { scope, registry } = registryOf(link.path);
      if (!registry) continue;
      const known = new Set(registry[registryKey(scope, link.path)] ?? []);
      if (!known.has(link.hash)) {
        add(
          config.links,
          `${page.lang}/${page.path}:${link.line}`,
          `the link ${link.target} goes to "${link.hash}", which is not an id of ${link.path} in anchors.json`,
        );
      }
    }
  }
  return out;
}
