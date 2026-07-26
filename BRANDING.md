# Crown Point Glass — brand notes

Everything visual lives in one place: the custom-property block at the top of
[`public/styles.css`](public/styles.css). Change a value there and it applies
across all five pages.

---

## The idea

A glazing firm sells two things that pull in opposite directions: **careful
trade work** and **an emergency you need solving tonight**. The design keeps them
visually separate so neither drowns the other out.

- **Navy and glass-cyan** carry the ordinary business — services, coverage, the
  workshop story. Calm, clean, precise.
- **Amber is reserved exclusively for the 24-hour emergency service.** The bar
  at the top of every page, the emergency band on the home page, the emergency
  page header and its closing call-to-action. Nothing else is ever amber.

That rule is the whole system. It means the urgent thing is always the brightest
thing on screen, and a customer scanning in a panic finds the number without
reading a word.

---

## Colour

| Token | Value | Used for |
|---|---|---|
| `--ink` | `#0b1926` | Headings, buttons, the darkest surfaces |
| `--navy` | `#12293d` | Dark bands (cards section, callback strip, ticker) |
| `--navy-deep` | `#0c1e2e` | Footer |
| `--navy-mid` | `#33556e` | Body copy |
| `--steel` | `#6b8599` | Muted labels, fine print |
| `--glass` | `#2fb0c4` | The accent — rules, icons, active states |
| `--glass-deep` | `#17869a` | The same hue, dark enough to use as text on white |
| `--glass-pale` | `#dcf0f4` | Chips, image backgrounds, the hero wash |
| **`--amber`** | `#f5a623` | **Emergency only** |
| `--amber-deep` | `#a8680a` | Amber that passes contrast as text |
| `--paper` | `#f4f7f9` | Page background |
| `--paper-cool` | `#e9eff4` | Alternating band background |
| `--panel` | `#ffffff` | Cards |
| `--line` | `#ccd9e2` | Hairlines and borders |

Status colours (`--open`, `--closed`, `--soon`) drive the live open/closed pill.

### Contrast

Body copy, headings and small labels are all set against backgrounds that clear
WCAG AA. Two deliberate pairings to preserve if you re-tint anything:

- `--glass` is too light for text on white — use `--glass-deep` for any small
  cyan type. The palette keeps both for exactly this reason.
- Text on the amber bands is `--ink` or a dark brown (`#4a3406` / `#7a4a00`),
  never white. White on amber fails.

---

## Type

One self-hosted variable typeface, **DM Sans** (`public/assets/fonts/dmsans.woff2`,
weights 400–700). No display face, no second family, no network request.

- **Headings** — 700 weight, letter-spacing `-0.02em` to `-0.035em`. The tight
  tracking is what stops a plain sans reading as generic.
- **Body** — 400, line-height 1.6.
- **Labels and eyebrows** — 700, uppercase, letter-spacing `0.15em`, 11–12px,
  usually in `--glass-deep`.
- **Phone numbers** — always 700 and larger than the copy around them.

---

## Shape and depth

Deliberately sharper than a typical trade site: **6–10px radii**, 1px hairline
borders, and soft diffuse shadows (`--shadow`, `--shadow-lift`) rather than the
hard offset shadows in the template this was ported from. Buttons and pills are
fully rounded (`999px`) so calls-to-action read as pressable.

Hover lifts an element 4px and deepens its shadow. All of it is disabled under
`prefers-reduced-motion`.

---

## Recurring motif

**The four-pane window.** A rectangle with a cross through it — the logo mark,
the favicon, the app icon, the 404 page, the share card, the scroll indicator
that fills as you read. It's the cheapest possible way to say "glazier" and it
scales from 16px to 300px without redrawing.

---

## Imagery

`public/assets/work-*.svg` are flat line drawings in the palette: pale
background, navy strokes, a cyan detail, a navy caption strip along the bottom.
They exist so the layout is never broken or empty — **replace them with real job
photographs.**

For photographs, 4:3 landscape crops sit best (`.shot img` is `aspect-ratio: 4/3`,
`object-fit: cover`). Wide shots of finished work read better than close-ups of
glass, which tends to photograph as a grey rectangle.

---

## Voice

Plain trade English. Short sentences. Say what happens and when.

- "Boarded up the same night, new unit in by the end of the week."
- "No call-out charge to quote."
- "Don't email — ring us."

Avoid: *bespoke solutions*, *industry-leading*, *your local experts*. Say the
specific thing instead — the number answered at 3am, the glass cut in our own
works, the fitter who is on our own books.
