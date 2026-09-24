/**
 * Page slugs found in the content folder, without the language: `index.ru.mdx` and `index.mdx`
 * both give the slug of `index`. A page is served in every language (untranslated ones fall back
 * to the default language), so the union over all files is what has to be rendered.
 */
export function collectSlugs(files: readonly string[], languages: readonly string[]): string[][] {
  const seen = new Set<string>();
  const slugs: string[][] = [];
  for (const file of files) {
    if (!file.endsWith(".mdx")) continue;
    const parts = file.slice(0, -".mdx".length).split("/");
    const last = parts.pop() as string;
    const dot = last.lastIndexOf(".");
    const name = dot > 0 && languages.includes(last.slice(dot + 1)) ? last.slice(0, dot) : last;
    if (name !== "index") parts.push(name);
    const key = parts.join("/");
    if (!seen.has(key)) {
      seen.add(key);
      slugs.push(parts);
    }
  }
  return slugs;
}
