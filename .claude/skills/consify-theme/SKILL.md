---
name: consify-theme
description: Change the look of a consify site — presets, a brand color, individual color/radius/font tokens, custom CSS, and custom MDX/slot components that need to match the theme. Use when the user asks to change colors, use a preset, add a brand color, adjust fonts or radius, or style a custom component consistently with light/dark mode.
---

# consify-theme

This is configuration, not prose to write — there is no interview and no multi-page plan. Read
[references/tokens.md](references/tokens.md) for the exact keys, then edit `docs.config.ts` (and
`custom/theme.css` for anything a token cannot do).

## Decide what to change

| Ask | Do |
| --- | --- |
| "make it look like X" / "I like one of the built-in looks" | `theme.preset`: `neutral`, `ocean`, `forest`, `sunset`, `violet`, `paper`, `mono` |
| "our brand color is #..." | `theme.brand: "#..."` — one hex color, consify derives an accessible accent for both light and dark automatically |
| A specific token looks wrong (e.g. "the card background is too dark") | `theme.colors.{light,dark}.<token>` — see the token table |
| Rounder/sharper corners | `theme.radius` |
| A different font | `theme.fonts.{sans,mono}` |
| Something no token can do (letter spacing, a one-off selector) | `custom/theme.css`, loaded after the core theme so it wins |
| A custom component, header, footer or feature page needs to look native | Style it with the theme's CSS variables (`text-fd-muted-foreground`, `border-fd-border`, `bg-fd-card`, ...), never a fixed color, so it survives both color schemes |

Order of application: `preset`, then `brand`, then your own `colors`/`radius`/`fonts` — each step
overrides only what it sets, so a preset plus a brand color plus one token override is normal.

## Rules

- **Ask before changing anything the user did not explicitly request** — a brand color request does
  not imply changing the font too.
- Every text/background pair in a preset or a brand-derived accent is guaranteed WCAG AA (4.5:1) in
  both color schemes; a token you set by hand is **not** checked automatically — verify contrast
  yourself if you add one (a quick look in both light and dark is the minimum).
- Check any change in both light and dark mode, and at a narrow (phone) width if it touches layout,
  before reporting done.
- Do not touch the theme files in `node_modules/@consify/core`.

## Verify

```bash
bun run build
bun run dev
```

Open the site in both color schemes and confirm the changed surface reads correctly; there is no
separate content check for a theme-only change (`consify check` is for content, not styling).
