// Versions of the docs: the option schema and what is read from it. Pure, no React.
import { z } from "zod";

const versionSchema = z.strictObject({
  /** Folder name inside the content folder of the feature (`content/<language>/<id>/<version>/`), also used in URLs. */
  id: z.string().regex(/^[\w.-]+$/, "must contain only letters, digits, `_`, `.` or `-`"),
  /** Label in the version switcher. Defaults to `id`. */
  label: z.string().optional(),
  /**
   * `deprecated` shows a banner that points to the latest version.
   *
   * @default "stable"
   */
  status: z.enum(["latest", "stable", "deprecated"]).default("stable"),
});

export const versionsSchema = z
  .strictObject({
    /**
     * The versions, in the order of the switcher.
     *
     * @default []
     */
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

export type Versions = z.output<typeof versionsSchema>;
type Version = Versions["list"][number];

/** The configured version a docs path belongs to (first URL segment after the feature address, `/docs` by default), if any. */
export function versionFromSlug(
  versions: Versions,
  slug: readonly string[] | undefined,
): Version | undefined {
  const id = slug?.[0];
  return id === undefined ? undefined : versions.list.find((v) => v.id === id);
}

/** Set when a page belongs to a deprecated version. `latest` is the version to point readers to. */
export function deprecationOf(
  versions: Versions,
  slug: readonly string[] | undefined,
): { version: Version; latest: Version | undefined } | undefined {
  const version = versionFromSlug(versions, slug);
  if (version?.status !== "deprecated") return undefined;
  const latest =
    versions.list.find((v) => v.id === versions.default) ??
    versions.list.find((v) => v.status === "latest");
  return { version, latest };
}
