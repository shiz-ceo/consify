/**
 * Ready-made palettes for `theme.preset`. A preset sets the color tokens of both color schemes (and
 * for some the corner radius and the font); what a project writes in `theme` is applied on top.
 * Every pair that carries text passes WCAG AA (4.5:1), `test/theme.test.ts` checks it.
 */

export const presetNames = [
  "neutral",
  "ocean",
  "forest",
  "sunset",
  "violet",
  "paper",
  "mono",
] as const;
export type PresetName = (typeof presetNames)[number];

/** The few colors a palette is made of. */
export interface Palette {
  background: string;
  foreground: string;
  /** Cards, code blocks, the secondary surface. */
  card: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  /** Hover and selected backgrounds. */
  accent: string;
  ring: string;
}

export interface Preset {
  label: string;
  light: Palette;
  dark: Palette;
  radius?: string;
  fonts?: { sans?: string; mono?: string };
}

/** The full set of shadcn tokens for a palette: what the CSS variables are called. */
export function tokensOf(p: Palette): Record<string, string> {
  return {
    background: p.background,
    foreground: p.foreground,
    card: p.card,
    "card-foreground": p.foreground,
    popover: p.background,
    "popover-foreground": p.foreground,
    primary: p.primary,
    "primary-foreground": p.primaryForeground,
    secondary: p.card,
    "secondary-foreground": p.foreground,
    muted: p.card,
    "muted-foreground": p.mutedForeground,
    accent: p.accent,
    "accent-foreground": p.foreground,
    border: p.border,
    input: p.border,
    ring: p.ring,
    sidebar: p.background,
    "sidebar-foreground": p.foreground,
    "sidebar-primary": p.primary,
    "sidebar-primary-foreground": p.primaryForeground,
    "sidebar-accent": p.accent,
    "sidebar-accent-foreground": p.foreground,
    "sidebar-border": p.border,
    "sidebar-ring": p.ring,
  };
}

/** Without a preset the stylesheet of consify applies: this is what it holds, for the math of `brand`. */
export const neutral: Preset = {
  label: "Neutral",
  light: {
    background: "#ffffff",
    foreground: "#1b1b1b",
    card: "#f6f6f6",
    mutedForeground: "#6b6b6b",
    border: "#dfdfdf",
    primary: "#000000",
    primaryForeground: "#ffffff",
    accent: "#f6f6f6",
    ring: "#8e8e8e",
  },
  dark: {
    background: "#000000",
    foreground: "#e7e7e7",
    card: "#0f0f0f",
    mutedForeground: "#a4a4a4",
    border: "#2d2d2d",
    primary: "#ffffff",
    primaryForeground: "#000000",
    accent: "#0f0f0f",
    ring: "#797979",
  },
};

export const presets: Record<PresetName, Preset> = {
  neutral,
  ocean: {
    label: "Ocean",
    light: {
      background: "#ffffff",
      foreground: "#0f1b26",
      card: "#f3f7fa",
      mutedForeground: "#556575",
      border: "#d8e2ea",
      primary: "#0369a1",
      primaryForeground: "#ffffff",
      accent: "#e5f0f7",
      ring: "#0284c7",
    },
    dark: {
      background: "#0b1220",
      foreground: "#e6edf5",
      card: "#111a2b",
      mutedForeground: "#9db0c4",
      border: "#1f2c42",
      primary: "#38bdf8",
      primaryForeground: "#04202f",
      accent: "#16243a",
      ring: "#38bdf8",
    },
  },
  forest: {
    label: "Forest",
    light: {
      background: "#ffffff",
      foreground: "#14201a",
      card: "#f4f8f4",
      mutedForeground: "#526457",
      border: "#d9e5db",
      primary: "#15803d",
      primaryForeground: "#ffffff",
      accent: "#e6f2e9",
      ring: "#16a34a",
    },
    dark: {
      background: "#0c130f",
      foreground: "#e5efe8",
      card: "#121c16",
      mutedForeground: "#9db3a4",
      border: "#1f2e25",
      primary: "#4ade80",
      primaryForeground: "#052e16",
      accent: "#17281e",
      ring: "#4ade80",
    },
  },
  sunset: {
    label: "Sunset",
    light: {
      background: "#fffdfb",
      foreground: "#241a14",
      card: "#fbf4ee",
      mutedForeground: "#6f5b51",
      border: "#eadcd2",
      primary: "#c2410c",
      primaryForeground: "#ffffff",
      accent: "#fae8db",
      ring: "#ea580c",
    },
    dark: {
      background: "#14100d",
      foreground: "#f3e9e2",
      card: "#1c1612",
      mutedForeground: "#bba398",
      border: "#2e241d",
      primary: "#fb923c",
      primaryForeground: "#2b1000",
      accent: "#2a1d15",
      ring: "#fb923c",
    },
  },
  violet: {
    label: "Violet",
    light: {
      background: "#ffffff",
      foreground: "#1a1626",
      card: "#f6f4fb",
      mutedForeground: "#625b78",
      border: "#e2ddef",
      primary: "#6d28d9",
      primaryForeground: "#ffffff",
      accent: "#eee9fb",
      ring: "#7c3aed",
    },
    dark: {
      background: "#100d18",
      foreground: "#ebe7f5",
      card: "#171322",
      mutedForeground: "#aaa2c0",
      border: "#282038",
      primary: "#a78bfa",
      primaryForeground: "#1a0b3d",
      accent: "#211a33",
      ring: "#a78bfa",
    },
  },
  paper: {
    label: "Paper",
    light: {
      background: "#fbf8f1",
      foreground: "#2b2620",
      card: "#f3eee1",
      mutedForeground: "#675d51",
      border: "#e0d8c6",
      primary: "#7c2d12",
      primaryForeground: "#fbf8f1",
      accent: "#ece4d0",
      ring: "#a16207",
    },
    dark: {
      background: "#1b1813",
      foreground: "#ece5d6",
      card: "#231f19",
      mutedForeground: "#b3a894",
      border: "#352f25",
      primary: "#f0b866",
      primaryForeground: "#1b1813",
      accent: "#2c261d",
      ring: "#f0b866",
    },
    radius: "0.25rem",
    fonts: { sans: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' },
  },
  mono: {
    label: "Mono",
    light: {
      background: "#ffffff",
      foreground: "#000000",
      card: "#f2f2f2",
      mutedForeground: "#4a4a4a",
      border: "#767676",
      primary: "#000000",
      primaryForeground: "#ffffff",
      accent: "#e6e6e6",
      ring: "#000000",
    },
    dark: {
      background: "#000000",
      foreground: "#ffffff",
      card: "#0d0d0d",
      mutedForeground: "#c7c7c7",
      border: "#8a8a8a",
      primary: "#ffffff",
      primaryForeground: "#000000",
      accent: "#1f1f1f",
      ring: "#ffffff",
    },
    radius: "0.125rem",
  },
};
