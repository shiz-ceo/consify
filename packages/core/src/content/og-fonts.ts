/// <reference path="./og-fonts.d.ts" />

// The font of social images. The one Takumi has inside covers Latin only, and a title in Russian
// came out as empty boxes. Geist (the font of the site) comes in pieces by script; each piece is
// registered as a subset of one family, and every letter is drawn by the piece that has it.
const subsets = {
  latin: () => import("@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?inline"),
  "latin-ext": () =>
    import("@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?inline"),
  cyrillic: () =>
    import("@fontsource-variable/geist/files/geist-cyrillic-wght-normal.woff2?inline"),
  "cyrillic-ext": () =>
    import("@fontsource-variable/geist/files/geist-cyrillic-ext-wght-normal.woff2?inline"),
  vietnamese: () =>
    import("@fontsource-variable/geist/files/geist-vietnamese-wght-normal.woff2?inline"),
};

interface OgFont {
  name: string;
  data: Uint8Array;
  subsetOf: string;
  generic: "sans-serif";
}

let loaded: Promise<OgFont[]> | undefined;

/** `fonts` for `generateOGImage`: Geist for Latin, Cyrillic and Vietnamese. Loaded once. */
export function ogFonts(): Promise<OgFont[]> {
  loaded ??= Promise.all(
    Object.entries(subsets).map(async ([name, load]) => {
      const { default: uri } = await load();
      return {
        name: `Geist ${name}`,
        data: new Uint8Array(Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64")),
        subsetOf: "Geist",
        generic: "sans-serif" as const,
      };
    }),
  );
  return loaded;
}
