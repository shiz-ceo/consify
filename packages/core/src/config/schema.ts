import type { ComponentType } from "react";
import { z } from "zod";
import { isFeature } from "../feature/define.ts";
import type { Feature } from "../feature/types.ts";
import type { DocsPlugin } from "../plugins/types.ts";
import { linkIds } from "../shared/catalog.ts";
import { coreMessageKeys, featureMessageKeys } from "../shared/messages.ts";
import { presetNames } from "../theme/presets.ts";

/** BCP-47-like language tag: `en`, `ru`, `pt-BR`. */
export const languagePattern = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const languageCode = z
  .string()
  .regex(languagePattern, "must be a language tag like `en` or `pt-BR`");

const siteSchema = z.strictObject({
  /** Site name shown in the header and page titles. */
  name: z.string().min(1),
  /** One sentence about the site, used as the default `<meta name="description">`. */
  description: z.string().optional(),
  /** Public origin, e.g. `https://docs.example.com`. Used for canonical links, the sitemap and OG images. */
  url: z.url().optional(),
  /** Path (from `public/`) or URL of the logo. The built-in header does not render it yet; use it from a custom header (`slots.header`). */
  logo: z.string().optional(),
  /** Path (from `public/`) or URL of the favicon. Without it a letter icon is generated from the name. */
  favicon: z.string().optional(),
  /** Source repository, used for "Edit on GitHub". */
  github: z
    .strictObject({
      /** `owner/name`. */
      repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "must look like `owner/name`"),
      /**
       * Branch the "Edit on GitHub" links point to.
       *
       * @default "main"
       */
      branch: z.string().default("main"),
    })
    .optional(),
});

const i18nSchema = z
  .strictObject({
    /**
     * The language of `/` and of every page that has no translation. Must be one of `languages`.
     *
     * @default "en"
     */
    defaultLanguage: languageCode.default("en"),
    /**
     * Every language of the site, e.g. `["en", "ru"]`. With more than one, the header shows a
     * language switcher and addresses start with the language (`/ru/docs`).
     *
     * @default ["en"]
     */
    languages: z.array(languageCode).min(1).default(["en"]),
    /**
     * What a page without a translation does. `notice` (default): the page of the default language
     * is shown with a note, marked in the sidebar and left out of the sitemap; `show`: it is shown as
     * if it were translated; `hide`: it is not shown (its address leads to the default language).
     */
    fallback: z.enum(["notice", "show", "hide"]).default("notice"),
    /**
     * Display names for the language switcher, e.g. `{ ru: "Русский" }`. Without one, the name from
     * the language pack (`custom/locales/<language>.ts`, or the built-in one) is used, else the code.
     *
     * @default {}
     */
    labels: z.record(languageCode, z.string()).prefault({}),
    /**
     * Overrides for consify UI strings per language, e.g. `{ ru: { documentation: "Доки" } }`. The
     * keys are checked against the strings of consify and of the features.
     *
     * @default {}
     */
    messages: z.record(languageCode, z.record(z.string(), z.string())).prefault({}),
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

/** A CSS value inserted into a `<style>` tag: must not be able to close the rule or the tag. */
const cssValue = z
  .string()
  .refine((v) => !/[{}<>;]/.test(v), "must not contain `{`, `}`, `<`, `>` or `;`");
const tokenName = /^[a-z][\w-]*$/;
const cssColors = z.record(z.string(), cssValue);

const themeSchema = z
  .strictObject({
    /**
     * A ready-made palette for both color schemes: `neutral` (the default look), `ocean`, `forest`,
     * `sunset`, `violet`, `paper` (warm, with a serif font) or `mono` (high contrast). The other
     * options of `theme` are applied on top of it.
     */
    preset: z.enum(presetNames).optional(),
    /**
     * One color (`#0ea5e9`) that the accent of the site is made from: the primary color, the text
     * on it, the hover backgrounds and the focus ring, in both color schemes, with the lightness
     * adjusted until it is readable on the page (WCAG AA).
     */
    brand: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color like `#0ea5e9`")
      .optional(),
    /** Base corner radius, e.g. `0.5rem`. Maps to `--radius`. The preset's radius is used when unset. */
    radius: cssValue.optional(),
    /**
     * Overrides for color tokens (without the leading `--`), per color scheme. These win over
     * `preset` and `brand`.
     *
     * @example
     * colors: { light: { primary: "#0ea5e9" }, dark: { primary: "#38bdf8" } }
     *
     * @default { light: {}, dark: {} }
     */
    colors: z
      .strictObject({ light: cssColors.prefault({}), dark: cssColors.prefault({}) })
      .prefault({}),
    /**
     * CSS `font-family` values for body text (`sans`) and code (`mono`). Geist is used when unset.
     *
     * @example
     * fonts: { sans: "Inter, system-ui, sans-serif" }
     */
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

const localizedText = z.union([z.string().min(1), z.record(languageCode, z.string().min(1))]);

const headMetaSchema = z
  .strictObject({
    /** For `<meta name="…">`, e.g. `"theme-color"`. */
    name: z.string().optional(),
    /** For `<meta property="…">` (Open Graph), e.g. `"og:site_name"`. */
    property: z.string().optional(),
    /** For `<meta http-equiv="…">`. */
    httpEquiv: z.string().optional(),
    /** The value of the tag. */
    content: z.string(),
  })
  .refine(
    (meta) => meta.name ?? meta.property ?? meta.httpEquiv,
    "needs `name`, `property` or `httpEquiv`",
  );

const headLinkSchema = z.strictObject({
  /** The relation, e.g. `"preconnect"`, `"stylesheet"`, `"icon"`. */
  rel: z.string().min(1),
  /** The address of the resource. */
  href: z.string().min(1),
  /** The kind of resource for `rel: "preload"`, e.g. `"font"`. */
  as: z.string().optional(),
  /** MIME type of the resource. */
  type: z.string().optional(),
  /** Media query the link applies to. */
  media: z.string().optional(),
  /** Icon sizes, e.g. `"32x32"`. */
  sizes: z.string().optional(),
  /** Language of the linked page (for `rel: "alternate"`). */
  hrefLang: z.string().optional(),
  /** CORS mode; fonts need `"anonymous"`. */
  crossOrigin: z.enum(["anonymous", "use-credentials"]).optional(),
});

const headScriptSchema = z.union([
  z.strictObject({
    /** The address of an external script. */
    src: z.string().min(1),
    /** Run as soon as loaded, without waiting for the page. */
    async: z.boolean().optional(),
    /** Run after the page is parsed. */
    defer: z.boolean().optional(),
    /** Script type, e.g. `"module"`. */
    type: z.string().optional(),
    /** Subresource Integrity hash (`sha384-…`). */
    integrity: z.string().optional(),
    /** CORS mode, needed together with `integrity`. */
    crossOrigin: z.enum(["anonymous", "use-credentials"]).optional(),
    /** `data-*` attributes, written without the prefix: `{ domain: "x" }` gives `data-domain="x"`. */
    data: z.record(z.string(), z.string()).optional(),
  }),
  z.strictObject({
    /** The text of an inline script. It is your own code; mind your Content-Security-Policy. */
    inline: z.string().min(1),
    /** Script type, e.g. `"module"` or `"application/ld+json"`. */
    type: z.string().optional(),
  }),
]);

/** What goes into the `<head>` of every page: meta tags, links (fonts, icons) and scripts (analytics). */
export const headSchema = z.strictObject({
  /**
   * `<meta>` tags. Each needs `name`, `property` or `httpEquiv`.
   *
   * @default []
   */
  meta: z.array(headMetaSchema).default([]),
  /**
   * `<link>` tags: fonts, icons, preconnects.
   *
   * @default []
   */
  links: z.array(headLinkSchema).default([]),
  /**
   * `<script>` tags: an external `src` or an `inline` text, e.g. for analytics.
   *
   * @default []
   */
  scripts: z.array(headScriptSchema).default([]),
});

export type HeadInput = z.input<typeof headSchema>;
export type Head = z.output<typeof headSchema>;

const bannerSchema = z.strictObject({
  /** The text of the announcement. */
  text: localizedText,
  /** Where the text leads: the id of a place a feature offers (`"blog"`) or an address. */
  href: z.string().min(1).optional(),
  /**
   * A reader who closes the banner does not see it again until this changes. Without it the text
   * is the identity, so a new text is shown again.
   */
  id: z
    .string()
    .regex(/^[\w-]+$/, "must contain only letters, digits, `_` or `-`")
    .optional(),
  /**
   * `warning` uses the warning colors of the theme.
   *
   * @default "info"
   */
  variant: z.enum(["info", "warning"]).default("info"),
});

const component = z.custom<ComponentType<any>>(
  (value) => typeof value === "function" || (typeof value === "object" && value !== null),
  "must be a React component",
);

/**
 * A link the site chose: the id of a place a feature offers (`"blog"`, `"blog:rss"`), such an id
 * with another title or description, or an address of its own (`/x` gets the language, absolute
 * URLs are kept).
 */
const leafLinkSchema = z.union([
  z.string().min(1),
  z.strictObject({
    id: z.string().min(1),
    title: localizedText.optional(),
    description: localizedText.optional(),
  }),
  z.strictObject({
    title: localizedText,
    description: localizedText.optional(),
    url: z.string().min(1),
    external: z.boolean().optional(),
  }),
]);

/** A link, or a drop-down menu of links. */
const linkItemSchema = z.union([
  leafLinkSchema,
  z.strictObject({
    title: localizedText,
    description: localizedText.optional(),
    items: z.array(leafLinkSchema).min(1),
  }),
]);

const headerSchema = z.strictObject({
  /**
   * The links of the top navigation, in order: ids of places the features offer (`"docs"`,
   * `"blog"`), links of your own, drop-down menus. Without it the header lists the main place of
   * every feature. `consify links` prints the ids.
   */
  links: z.array(linkItemSchema).optional(),
});

const slotsSchema = z.strictObject({
  /** Replaces the whole header. */
  header: component.optional(),
  /** Added at the end of the header, after the search and theme buttons. */
  headerEnd: component.optional(),
  /** Replaces the whole footer. */
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

const footerSchema = z.strictObject({
  /** A short text under the name of the site. */
  description: localizedText.optional(),
  /** Columns of links. Without them the footer lists the main places of the features that are on. */
  columns: z
    .array(z.strictObject({ title: localizedText, links: z.array(leafLinkSchema).min(1) }))
    .optional(),
  /**
   * Icons with links to the accounts of the project, e.g. `{ type: "github", url: "https://github.com/me/x" }`.
   *
   * @default []
   */
  social: z
    .array(
      z.strictObject({
        /** Which icon to show. */
        type: z.enum(socialTypes),
        /** Where the icon leads. */
        url: z.string().min(1),
      }),
    )
    .default([]),
  /** The line at the bottom. Defaults to `© {year} {site name}`. */
  legal: localizedText.optional(),
});

const deploySchema = z.strictObject({
  /**
   * `server`: a Node server (`consify start`, Docker). `static`: plain files for any static host.
   * Static mode has no server: `/` and `/docs` are pages that redirect, and search runs in the
   * browser.
   *
   * @default "server"
   */
  mode: z.enum(["server", "static"]).default("server"),
  /**
   * Set when the site is served from a sub path, e.g. `/docs` for `https://me.github.io/docs`.
   * Starts with `/`, does not end with `/`. Without it the site is served from the root.
   */
  basePath: z
    .string()
    .regex(/^\/[^/].*[^/]$|^\/[^/]$/, "must start with `/` and must not end with `/`")
    .optional(),
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
  messages: z.record(languageCode, z.record(z.string(), z.string())).optional(),
});

const featureSchema = z.custom<Feature>(
  isFeature,
  "must be a feature made with `defineFeature` (for example `blog()` from `@consify/blog`)",
);

const twoslashSchema = z.strictObject({
  /** `compilerOptions` of a tsconfig, applied to every `twoslash` code block. */
  compilerOptions: z.record(z.string(), z.unknown()).optional(),
  /**
   * Cache type-check results between builds.
   *
   * @default true
   */
  cache: z.boolean().default(true),
});

/** Everything about `.mdx` files. */
const mdxSchema = z.strictObject({
  /**
   * `$…$` and `$$…$$` formulas (KaTeX).
   *
   * @default true
   */
  math: z.boolean().default(true),
  /**
   * Type-checked `twoslash` code blocks: `true`, `false`, or options (`{ compilerOptions }`).
   * Turn it off to build faster when your code blocks are not TypeScript.
   *
   * @default true
   */
  twoslash: z
    .union([z.boolean(), twoslashSchema])
    .default(true)
    .transform((value) =>
      value === false ? false : twoslashSchema.parse(value === true ? {} : value),
    ),
  /**
   * Components for every `.mdx` file, by the name used in it (capitalized, as in `<Chart />`).
   * `custom/components/*.tsx` adds more.
   *
   * @default {}
   */
  components: z.record(z.string(), z.custom<ComponentType<never>>()).default({}),
  /**
   * Plugins made with `definePlugin`: remark, rehype and Shiki additions, components and
   * messages. Applied in order, after the built-in ones. Names must be unique.
   *
   * @default []
   */
  plugins: z.array(pluginSchema).default([]),
});

export const docsConfigSchema = z
  .strictObject({
    /** The site itself: name, address, logo, source repository. */
    site: siteSchema,
    /** Languages of the site and what happens to a page that is not translated. */
    i18n: i18nSchema.prefault({}),
    /** Colors, radius and fonts. Everything is optional; the default look is the `neutral` preset. */
    theme: themeSchema.prefault({}),
    /**
     * Tags for the `<head>` of every page: meta, links and scripts (analytics, fonts). Give a
     * function of the language to change them per language.
     */
    head: z
      .union([
        headSchema,
        z.custom<(lang: string) => HeadInput>(
          (value) => typeof value === "function",
          "must be an object or a function of the language",
        ),
      ])
      .optional(),
    /** An announcement above the header of every page that a reader can close. */
    banner: bannerSchema.optional(),
    /**
     * The features of the site: `docs()` from `@consify/docs`, `blog()` from `@consify/blog`, or your
     * own made with `defineFeature`. Their links are in the header in this order.
     *
     * @example
     * features: [docs(), blog()]
     *
     * @default []
     */
    features: z.array(featureSchema).default([]),
    /**
     * Replacements for parts of the site: `{ header, headerEnd, footer }`, React components. The
     * files `custom/header.tsx` and `custom/footer.tsx` do the same; this wins when both exist.
     */
    slots: slotsSchema.optional(),
    /** Options of the header (the same on every page). */
    header: headerSchema.optional(),
    /** The footer of every page. On by default (a column of the features), `false` removes it. */
    footer: z.union([z.literal(false), footerSchema]).optional(),
    /** How the site is built and served: a Node server or static files, and a sub path. */
    deploy: deploySchema.prefault({}),
    /** What `.mdx` files can do: math, type-checked code blocks, components, plugins. */
    mdx: mdxSchema.prefault({}),
  })
  .superRefine((value, ctx) => {
    for (const name of Object.keys(value.mdx.components)) {
      if (!/^[A-Z]\w*$/.test(name)) {
        ctx.addIssue({
          code: "custom",
          path: ["mdx", "components", name],
          message: `component name "${name}" must start with a capital letter (MDX treats lowercase tags as HTML)`,
        });
      }
    }
    const ids = value.features.map((f) => f.id);
    const paths = value.features.map((f) => f.path);
    for (const [index, id] of ids.entries()) {
      if (ids.indexOf(id) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["features", index],
          message: `duplicate feature "${id}"`,
        });
      } else if (paths.indexOf(paths[index] as string) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["features", index],
          message: `"${id}" has the same address as "${ids[paths.indexOf(paths[index] as string)]}", set \`path\``,
        });
      }
    }
    const known = new Set([
      ...coreMessageKeys,
      ...featureMessageKeys(value.features),
      ...value.mdx.plugins.flatMap((plugin) =>
        Object.values(plugin.messages ?? {}).flatMap((strings) => Object.keys(strings)),
      ),
    ]);
    for (const [lang, strings] of Object.entries(value.i18n.messages)) {
      for (const key of Object.keys(strings)) {
        if (!known.has(key)) {
          ctx.addIssue({
            code: "custom",
            path: ["i18n", "messages", lang, key],
            message: `unknown message "${key}"`,
          });
        }
      }
    }
    const knownLinks = new Set(linkIds(value as DocsConfig));
    const chosen = [
      ...(value.header?.links ?? []).flatMap((item) =>
        typeof item === "object" && "items" in item ? item.items : [item],
      ),
      ...(typeof value.footer === "object" ? (value.footer.columns ?? []) : []).flatMap(
        (column) => column.links,
      ),
    ];
    for (const item of chosen) {
      const id = typeof item === "string" ? item : "id" in item ? item.id : undefined;
      if (id !== undefined && !knownLinks.has(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["header"],
          message: `unknown link "${id}" (available: ${[...knownLinks].join(", ") || "none"})`,
        });
      }
    }
    const names = value.mdx.plugins.map((p) => p.name);
    const dup = names.find((n, i) => names.indexOf(n) !== i);
    if (dup !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["mdx", "plugins"],
        message: `duplicate plugin name "${dup}"`,
      });
    }
  });

/** What a user writes in `docs.config.ts`. */
export type DocsConfigInput = z.input<typeof docsConfigSchema>;
/** Normalized config with all defaults applied. */
export type DocsConfig = z.output<typeof docsConfigSchema>;
