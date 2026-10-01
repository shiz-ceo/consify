# Theme reference

```ts title="docs.config.ts"
theme: {
  preset: "ocean",
  brand: "#0ea5e9",
  radius: "0.75rem",
  colors: {
    light: { primary: "oklch(0.55 0.2 260)", "primary-foreground": "white" },
    dark: { primary: "oklch(0.75 0.15 260)" },
  },
  fonts: { sans: "Inter, sans-serif", mono: "'JetBrains Mono', monospace" },
},
```

Token names are written without the leading `--`. Values are CSS, so any color syntax works
(`oklch`, `hsl`, hex, `var(...)`). Values that could close a rule or a tag (`{`, `}`, `<`, `>`, `;`)
are rejected.

## Presets

`theme.preset` is one of these. `neutral` is the default and adds nothing:

| Preset | Character |
| --- | --- |
| `neutral` | Black and white, the default |
| `ocean` | Cool blues |
| `forest` | Greens |
| `sunset` | Warm orange and red |
| `violet` | Purple |
| `paper` | Warm paper, a serif system font, a smaller radius (`0.25rem`) |
| `mono` | High contrast, sharp corners (`0.125rem`) |

A preset sets the colors of both color schemes.

## Brand color

`theme.brand` is one hex color: `"#0ea5e9"`, `#rgb` or `#rrggbb`. The accent is derived from it for
both color schemes:

- the primary color: its lightness is adjusted, keeping hue and chroma, until it reads on the page
  background at 4.5:1;
- the text on the primary color: black or white, whichever reads better;
- the hover and selected background: the page color tinted with the brand;
- the focus ring.

## Tokens

| Token | Used for |
| --- | --- |
| `background`, `foreground` | Page background and text |
| `card`, `card-foreground` | Cards and panels |
| `popover`, `popover-foreground` | Menus and dialogs |
| `primary`, `primary-foreground` | Buttons and accents |
| `secondary`, `muted`, `accent` | Quiet surfaces and hover states |
| `muted-foreground` | Secondary text |
| `border`, `input`, `ring` | Lines and focus rings |

## Order of application

The last one wins:

1. `preset`
2. `brand`
3. `colors`, `radius` and `fonts` of your `theme`

## Accessibility

Every text pair of every preset, and of any brand color, passes WCAG AA (4.5:1) in both color
schemes — this is tested in consify itself, not something you need to verify for a preset or brand
color. A token you set yourself in `colors` is **not** adjusted; check its contrast yourself. The
highlighted code themes (`github-light-high-contrast`, `github-dark-default`) pass too.

## Your own CSS

For anything a token cannot do, add `custom/theme.css`. It is loaded after the theme of consify, so
it wins:

```css title="custom/theme.css"
.prose h2 {
  letter-spacing: -0.02em;
}
```

## Styling a custom component to match

Use the theme's own CSS variables, never a fixed color, so a component reads correctly in both
color schemes:

```tsx title="custom/components/Since.tsx"
export default function Since({ version }: { version: string }) {
  return (
    <span className="rounded-full border border-fd-border bg-fd-card px-2 py-0.5 text-xs text-fd-muted-foreground">
      since {version}
    </span>
  );
}
```
