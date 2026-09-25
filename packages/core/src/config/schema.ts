import type { ComponentType } from "react";
import { z } from "zod";
import { idPattern } from "../features/blog/schema.ts";
import type { DocsPlugin } from "../plugins/types.ts";
import { messageKeys } from "../shared/messages.ts";

/** BCP-47-like language tag: `en`, `ru`, `pt-BR`. */
const languageCode = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, "must be a language tag like `en` or `pt-BR`");

const siteSchema = z.strictObject({
  /** Site name shown in the header and page titles. */
  name: z.string().min(1),
  description: z.string().optional(),
  /** Public origin, used for canonical links, sitemap and OG images. */
  url: z.url().optional(),
  /** Path or URL of the logo. */
  logo: z.string().optional(),
  /** Path (from `public/`) or URL of the favicon. Without it a letter icon is generated from the name. */
  favicon: z.string().optional(),
  /** Source repository, used for "Edit on GitHub". */
  github: z
    .strictObject({
      /** `owner/name`. */
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must look like `owner/name`"),
      branch: z.string().default("main"),
      /** Content directory inside the repository. */
      contentDir: z.string().default("content/docs"),
    })
    .optional(),
});

const i18nSchema = z
  .strictObject({
    defaultLanguage: languageCode.default("en"),
    languages: z.array(languageCode).min(1).default(["en"]),
    /**
     * What a page without a translation does. `notice` (default): the page of the default language
     * is shown with a note, marked in the sidebar and left out of the sitemap; `show`: it is shown as
     * if it were translated; `hide`: it is not shown (its address leads to the default language).
     */
    fallback: z.enum(["notice", "show", "hide"]).default("notice"),
    /** Display names for the language switcher, e.g. `{ ru: "Русский" }`. */
    labels: z.record(languageCode, z.string()).prefault({}),
    /** Overrides for docsivi UI strings per language, e.g. `{ ru: { documentation: "Доки" } }`. */
    messages: z.record(languageCode, z.partialRecord(z.enum(messageKeys), z.string())).prefault({}),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.languages).size !== value.languages.length) {
      ctx.addIssue({ code: "custom", path: ["languages"], message: "languages must be unique" });
    }
    if (!value.languages.includes(value.defaultLanguage)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultLanguage"],
        message: `defaultLanguage "${value.defaultLanguage}" must be one of: ${value.languages.join(", ")}`,
      });
    }
    for (const field of ["labels", "messages"] as const) {
      for (const key of Object.keys(value[field])) {
        if (!value.languages.includes(key)) {
          ctx.addIssue({
            code: "custom",
            path: [field, key],
            message: `${field === "labels" ? "label" : "messages"} for unknown language "${key}"`,
          });
        }
      }
    }
  });

const versionSchema = z.strictObject({
  /** Folder name under the docs content directory, also used in URLs. */
  id: z.string().regex(/^[\w.-]+$/, "must contain only letters, digits, `_`, `.` or `-`"),
  /** Label in the version switcher. Defaults to `id`. */
  label: z.string().optional(),
  /** `deprecated` shows a banner that points to the latest version. */
  status: z.enum(["latest", "stable", "deprecated"]).default("stable"),
});

const versionsSchema = z
  .strictObject({
    list: z.array(versionSchema).prefault([]),
    /** Version opened by default. Defaults to the one marked `latest`, else the first. */
    default: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const ids = value.list.map((v) => v.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["list"], message: "version ids must be unique" });
    }
    if (value.list.filter((v) => v.status === "latest").length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["list"],
        message: 'only one version can have status "latest"',
      });
    }
    if (value.default !== undefined && !ids.includes(value.default)) {
      ctx.addIssue({
        code: "custom",
        path: ["default"],
        message: `default version "${value.default}" is not in the list`,
      });
    }
  })
  .transform((value) => ({
    ...value,
    default:
      value.default ?? value.list.find((v) => v.status === "latest")?.id ?? value.list[0]?.id,
  }));

const feature = z.boolean().default(true);

const featuresSchema = z.strictObject({
  search: feature,
  toc: feature,
  breadcrumbs: feature,
  pagination: feature,
  llmsTxt: feature,
  og: feature,
  editOnGithub: feature,
  math: feature,
  twoslash: feature,
});

/** A CSS value inserted into a `<style>` tag: must not be able to close the rule or the tag. */
const cssValue = z
  .string()
  .refine((v) => !/[{}<>;]/.test(v), "must not contain `{`, `}`, `<`, `>` or `;`");
const tokenName = /^[a-z][\w-]*$/;
const cssColors = z.record(z.string(), cssValue);

const themeSchema = z
  .strictObject({
    /** Base corner radius, e.g. `0.5rem`. Maps to `--radius`. */
    radius: cssValue.optional(),
    /** Overrides for color tokens (without the leading `--`), per color scheme. */
    colors: z
      .strictObject({ light: cssColors.prefault({}), dark: cssColors.prefault({}) })
      .prefault({}),
    /** CSS `font-family` values. Geist is used when unset. */
    fonts: z.strictObject({ sans: cssValue.optional(), mono: cssValue.optional() }).prefault({}),
  })
  .superRefine((theme, ctx) => {
    for (const scheme of ["light", "dark"] as const) {
      for (const name of Object.keys(theme.colors[scheme])) {
        if (!tokenName.test(name)) {
          ctx.addIssue({
            code: "custom",
            path: ["colors", scheme, name],
            message: `token name "${name}" must be written without \`--\`, e.g. \`primary\``,
          });
        }
      }
    }
  });

const homeSchema = z.strictObject({
  hero: z.strictObject({
    title: z.string().min(1),
    description: z.string().optional(),
    /** `/docs` opens the default version, other `/...` paths get the language prefix. */
    actions: z
      .array(
        z.strictObject({
          label: z.string().min(1),
          href: z.string().min(1),
          variant: z.enum(["primary", "secondary"]).default("primary"),
        }),
      )
      .prefault([]),
  }),
  features: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        description: z.string().min(1),
        /** Lucide icon name, e.g. `Zap`. */
        icon: z.string().optional(),
        href: z.string().optional(),
      }),
    )
    .prefault([]),
});

const openapiSchema = z.strictObject({
  /** OpenAPI schema file(s) or URL(s). Files are relative to the project root. */
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  /** Label of the link in the top navigation. */
  title: z.string().min(1).default("API"),
});

const localizedText = z.union([z.string().min(1), z.record(languageCode, z.string().min(1))]);

const component = z.custom<ComponentType<any>>(
  (value) => typeof value === "function" || (typeof value === "object" && value !== null),
  "must be a React component",
);

export const pageIds = ["home", "docs", "api-reference", "blog"] as const;

const headerSchema = z.strictObject({
  /** Pages that have no search in the header, by the id of their section. */
  hideSearchOn: z.array(z.enum(pageIds)).default([]),
});

const slotsSchema = z.strictObject({
  home: component.optional(),
  header: component.optional(),
  headerEnd: component.optional(),
  footer: component.optional(),
});

export const socialTypes = [
  "github",
  "x",
  "bluesky",
  "linkedin",
  "discord",
  "youtube",
  "rss",
] as const;

const footerLinkSchema = z.strictObject({
  title: localizedText,
  /** Like `nav`: `/docs` opens the docs, `/x` gets the language, absolute URLs are kept. */
  url: z.string().min(1),
  external: z.boolean().optional(),
});

const footerSchema = z.strictObject({
  /** A short text under the name of the site. */
  description: localizedText.optional(),
  /** Columns of links. Without them the footer lists the sections of the site that are on. */
  columns: z
    .array(z.strictObject({ title: localizedText, links: z.array(footerLinkSchema).min(1) }))
    .optional(),
  /** Icons with links to the accounts of the project. */
  social: z
    .array(z.strictObject({ type: z.enum(socialTypes), url: z.string().min(1) }))
    .default([]),
  /** The line at the bottom. Defaults to `© {year} {site name}`. */
  legal: localizedText.optional(),
});

const blogSchema = z
  .strictObject({
    /** Heading of the blog page. Defaults to the translated word "Blog". */
    title: localizedText.optional(),
    description: localizedText.optional(),
    /** Posts per page of the list. */
    perPage: z.number().int().min(1).max(100).default(12),
    /** Categories of the list filter. A post lists the ids it belongs to. */
    categories: z
      .array(
        z.strictObject({
          id: z.string().regex(idPattern, "must be lowercase letters, digits and `-`"),
          label: localizedText,
        }),
      )
      .prefault([]),
    /** People who write posts, by id. A post lists the ids of its authors. */
    authors: z
      .record(
        z.string(),
        z.strictObject({
          name: z.string().min(1),
          role: z.string().optional(),
          /** Path or URL of the avatar. */
          avatar: z.string().optional(),
          url: z.string().optional(),
        }),
      )
      .prefault({}),
    /** Share buttons (X, LinkedIn, Bluesky) on a post. */
    share: z.boolean().default(true),
    /** An RSS feed at `/{lang}/blog/rss.xml`. */
    rss: z.boolean().default(true),
  })
  .superRefine((blog, ctx) => {
    const ids = blog.categories.map((c) => c.id);
    const dup = ids.find((c, i) => ids.indexOf(c) !== i);
    if (dup !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: `duplicate category id "${dup}"`,
      });
    }
    for (const authorId of Object.keys(blog.authors)) {
      if (!idPattern.test(authorId)) {
        ctx.addIssue({
          code: "custom",
          path: ["authors", authorId],
          message: `author id "${authorId}" must be lowercase letters, digits and \`-\``,
        });
      }
    }
  });

const deploySchema = z.strictObject({
  /**
   * `server`: a Node server (`docsivi start`, Docker). `static`: plain files for any static host.
   * Static mode has no server: `/` and `/docs` are pages that redirect, and search runs in the
   * browser.
   */
  mode: z.enum(["server", "static"]).default("server"),
  /** Set when the site is served from a sub path, e.g. `/docs`. */
  basePath: z
    .string()
    .regex(/^\/[^/].*[^/]$|^\/[^/]$/, "must start with `/` and must not end with `/`")
    .optional(),
});

const navItemSchema = z.strictObject({
  title: z.string().min(1),
  url: z.string().min(1),
  external: z.boolean().optional(),
});

const pluginSchema = z.strictObject({
  name: z.string().min(1),
  remark: z.array(z.custom<NonNullable<DocsPlugin["remark"]>[number]>()).optional(),
  rehype: z.array(z.custom<NonNullable<DocsPlugin["rehype"]>[number]>()).optional(),
  shiki: z
    .strictObject({
      transformers: z
        .array(z.custom<NonNullable<NonNullable<DocsPlugin["shiki"]>["transformers"]>[number]>())
        .optional(),
      langs: z.array(z.string()).optional(),
    })
    .optional(),
  components: z.record(z.string(), z.custom<ComponentType<never>>()).optional(),
});

const twoslashSchema = z.strictObject({
  /** `compilerOptions` of a tsconfig, applied to every `twoslash` code block. */
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
  /** Cache type-check results between builds. */
  cache: z.boolean().default(true),
});

export const docsConfigSchema = z
  .strictObject({
    site: siteSchema,
    i18n: i18nSchema.prefault({}),
    versions: versionsSchema.prefault({}),
    features: featuresSchema.prefault({}),
    theme: themeSchema.prefault({}),
    twoslash: twoslashSchema.prefault({}),
    /** Home page content per language. Missing languages fall back to the default language. */
    home: z.record(languageCode, homeSchema).optional(),
    /** API reference generated from an OpenAPI schema, on its own page at `/{lang}/api`. */
    openapi: openapiSchema.optional(),
    /** A blog: articles in `content/blog`, a list with filters and search, an RSS feed. */
    blog: blogSchema.optional(),
    /**
     * Replacements for parts of the site: `{ home, header, headerEnd, footer }`, React components.
     * The files `custom/home.tsx`, `custom/header.tsx` and `custom/footer.tsx` do the same; this
     * wins when both exist.
     */
    slots: slotsSchema.optional(),
    /** Options of the header (the same on every page). */
    header: headerSchema.optional(),
    /** The footer of every page. On by default (a column of the sections), `false` removes it. */
    footer: z.union([z.literal(false), footerSchema]).optional(),
    deploy: deploySchema.prefault({}),
    /** Custom MDX components, keyed by the name used in `.mdx` files. */
    components: z.record(z.string(), z.unknown()).default({}),
    plugins: z.array(pluginSchema).default([]),
    nav: z.array(navItemSchema).default([]),
  })
  .superRefine((value, ctx) => {
    for (const name of Object.keys(value.components)) {
      if (!/^[A-Z]\w*$/.test(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["components", name],
          message: `component name "${name}" must start with a capital letter (MDX treats lowercase tags as HTML)`,
        });
      }
    }
    const names = value.plugins.map((p) => p.name);
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["plugins"],
        message: `duplicate plugin name "${dup}"`,
      });
    }
  });

/** What a user writes in `docs.config.ts`. */
export type DocsConfigInput = z.input<typeof docsConfigSchema>;
/** Normalized config with all defaults applied. */
export type DocsConfig = z.output<typeof docsConfigSchema>;
