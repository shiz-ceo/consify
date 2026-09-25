// Pure functions that make the files of a new project. Kept apart from the prompts and the disk so
// they can be tested.

/** Names of the languages that the language switcher shows. */
export const languageNames = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  uk: "Українська",
  tr: "Türkçe",
  ar: "العربية",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
};

const languagePattern = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * Turns "en, ru" into ["en", "ru"]. Throws on a value that is not a language tag or is repeated.
 * @param {string} input
 * @returns {string[]}
 */
export function parseLanguages(input) {
  const languages = input
    .split(/[\s,]+/)
    .map((language) => language.trim())
    .filter(Boolean);
  if (languages.length === 0) throw new Error("Give at least one language, for example: en");
  for (const language of languages) {
    if (!languagePattern.test(language)) {
      throw new Error(`"${language}" is not a language code (examples: en, ru, pt-BR)`);
    }
  }
  if (new Set(languages).size !== languages.length) throw new Error("Languages must be unique");
  return languages;
}

/** A package name made from a folder name. @param {string} value */
export function toPackageName(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-_.]+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "") || "my-docs"
  );
}

/**
 * The `docs.config.ts` of a new project.
 * @param {{ siteName: string, languages: string[] }} options
 */
export function renderConfig({ siteName, languages }) {
  const [main = "en"] = languages;
  const labels = languages
    .map(
      (language) =>
        `${JSON.stringify(language)}: ${JSON.stringify(languageNames[language] ?? language)}`,
    )
    .join(", ");
  const multilingual = languages.length > 1;

  return `import { defineConfig } from "consify";

export default defineConfig({
  site: {
    name: ${JSON.stringify(siteName)},
    description: "Documentation for ${siteName.replace(/"/g, '\\"')}",
    // Set these before you publish:
    // url: "https://docs.example.com",
    // github: { repo: "owner/name" },
  },

  i18n: {
    defaultLanguage: ${JSON.stringify(main)},
    languages: [${languages.map((language) => JSON.stringify(language)).join(", ")}],${
      multilingual ? `\n    labels: { ${labels} },` : ""
    }
  },

  // Everything else has a default. Add a blog, a footer, versions or a theme when you need them:
  // blog: { authors: { me: { name: "Me" } } },
  // theme: { radius: "0.75rem" },
});
`;
}

/**
 * The `package.json` of a new project.
 * @param {{ name: string, consifyVersion: string, dependencies: Record<string, string>, devDependencies: Record<string, string> }} options
 */
export function renderPackageJson({ name, consifyVersion, dependencies, devDependencies }) {
  const sorted = (object) =>
    Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(
    {
      name,
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "consify dev",
        build: "consify build",
        start: "consify start",
        typecheck: "consify typegen && tsc --noEmit",
      },
      dependencies: sorted({ ...dependencies, consify: `^${consifyVersion}` }),
      devDependencies: sorted(devDependencies),
    },
    null,
    2,
  )}\n`;
}

/**
 * The `README.md` of a new project.
 * @param {{ siteName: string, run: (script: string) => string }} options
 */
export function renderReadme({ siteName, run }) {
  return `# ${siteName}

A documentation site made with [consify](https://github.com/shiz-ceo/consify).

\`\`\`bash
${run("dev")}      # development server
${run("build")}    # production build
${run("start")}    # serve the build (server mode)
\`\`\`

- \`docs.config.ts\`: every setting
- \`content/docs/\`: your pages (\`.mdx\`); folders are sections, \`meta.json\` sets the order
- \`custom/components/\`: React components that you can use in any page without importing them
- \`.claude/skills/consify-docs\`: a skill that helps Claude write and maintain these docs
`;
}
