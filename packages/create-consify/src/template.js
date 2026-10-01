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

  return `import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";

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

  // The features of the site, in the order of the header. More are installed on their own:
  //   bun add @consify/blog            then  blog({ authors: { me: { name: "Me" } } })
  //   bun add @consify/api-reference   then  apiReference({ input: "./openapi.json" })
  // Your own is one file with defineFeature, see custom/features/ in the docs.
  // Versions of the docs go into the options: docs({ versions: { list: [{ id: "v1" }] } })
  features: [docs()],

  // Everything else has a default. Add a footer or a theme when you need them:
  // theme: { radius: "0.75rem" },
});
`;
}

/** Languages whose interface strings ship with consify. */
export const builtinLanguages = ["en", "ru"];

/**
 * `consify.registries.json`, seeded with the one official registry — the same for every new
 * project, unlike docs.config.ts which varies per answer. `{name}` in the URL is replaced with the
 * item name by `consify add`. The registry may not serve any items yet: `consify add <name>` then
 * fails with a clear 404 until items are published, which is expected.
 */
export function registrySeed() {
  return `${JSON.stringify(
    {
      registries: {
        "@shiz-ceo": { url: "https://consify.shiz-ceo.ru/r/{name}.json", default: true },
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * `.npmrc`, seeded so a package manager knows to fetch `@consify/*` packages from GitHub Packages
 * instead of the default npm registry — required for `bun install`/`npm install` to resolve them at
 * all, since GitHub Packages only serves scoped packages and is never the default registry for a
 * scope it wasn't told about explicitly.
 */
export function npmrcSeed() {
  return "@consify:registry=https://npm.pkg.github.com\n";
}

/**
 * A language pack for a language that consify has no strings for: a name for the switcher and a
 * comment on how to get every string to translate.
 * @param {{ lang: string, label: string }} options
 */
export function renderLocaleStub({ lang, label }) {
  return `import { defineLocale } from "@consify/core";

// The strings of the interface in ${lang} (404 page, footer, buttons). Until they are translated the
// site shows them in English. Run \`consify locale ${lang} --force\` to list every string here.
export default defineLocale({
  label: ${JSON.stringify(label)},
  messages: {},
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
      dependencies: sorted({ ...dependencies, "@consify/core": `^${consifyVersion}` }),
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

Consify's own packages are published as \`@consify/*\` on GitHub Packages, not the default npm
registry — this project's \`.npmrc\` already points \`@consify\` there, but installing on a new
machine still needs a GitHub token with \`read:packages\` in \`NODE_AUTH_TOKEN\` (or npm/bun's own
auth config) before \`bun install\`/\`npm install\` can fetch them.

- \`docs.config.ts\`: every setting
- \`content/<language>/docs/\`: your pages (\`.mdx\`); folders are sections, \`meta.json\` sets the order
- \`content/<language>/\`: one folder per language holds its docs, blog and home page (\`consify lang add <language>\`)
- \`custom/components/\`: React components that you can use in any page without importing them
- \`.claude/skills/\`: skills that help Claude write and maintain these docs, one per feature you use (\`consify skill sync\` to update after adding one)
`;
}
