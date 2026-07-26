# Crown Point Glass — website

Static site for **Crown Point Glass Limited** — glaziers and glass manufacturers
covering Greater Manchester and Cheshire, with a 24-hour emergency board-up
service.

Built with [Astro](https://astro.build). Every word and number on the site comes
from the YAML files in [`content/`](content/), validated at build time — so a
typo fails the build instead of breaking the live site.

This project was ported from the [`rannys`](https://github.com/KyleLookingAround/rannys)
template: same architecture (YAML content → schema → Astro pages → GitHub Pages),
rebuilt around a glazing business.

---

## ⚠️ Before this goes live

Some values were taken from public listings rather than from the business, and
**must be confirmed**. They're all marked `CONFIRM` in `content/settings.yml`:

| Field | Current value | Why it needs checking |
|---|---|---|
| `street` / `postcode` | 28-30 Wilbraham Road, M14 7DW | Public sources show both this address and separate works in Denton. Set whichever address customers should actually visit. |
| `emergencyPhone` | 07726 353078 | Listed publicly as a second number; assumed here to be the out-of-hours line. |
| `hours` | Mon–Fri 8–5, Sat 9–1, Sun closed | Placeholder trade hours. The 24hr emergency line is separate and unaffected. |
| `credentials` | Companies House + Facebook | Add any real trade accreditations (FENSA, CERTASS, Glass & Glazing Federation, insurance-approved schemes). |

The photographs are placeholders too — `public/assets/work-*.svg` are line
drawings, not real jobs. Swap them for site photographs as they come in (see
*Adding a photo* below).

---

## Editing the site

### The easy way — the `/admin` editor

Once deployed, go to **`/admin/`** and sign in with GitHub. You get a form for
every page; saving commits to the repo, which rebuilds and republishes
automatically (about a minute).

The editor is already pointed at this repository — see `backend.repo` in
[`public/admin/config.yml`](public/admin/config.yml).

### The direct way — edit the YAML

| File | Controls |
|---|---|
| `content/settings.yml` | Phone numbers, address, opening hours, areas covered, footer details |
| `content/home.yml` | The home page top to bottom |
| `content/services.yml` | The services list |
| `content/emergency.yml` | The 24hr emergency page |
| `content/gallery.yml` | Job photos (first six also appear on the home page) |
| `content/quote.yml` | The quote-request page |

Every field is commented in the file itself.

### Opening hours are defined once

`settings.yml` → `hours` is the single source of truth. The hours table, the
hero summary line, the live "open now / closed" pill and the Google structured
data are all derived from it in `src/lib/site.ts`. Nothing to keep in sync.

The emergency line is deliberately **not** governed by that table — it's
advertised as 24/7 everywhere, including when the office shows as closed.

### Adding a photo

1. Drop the file in `public/assets/` (e.g. `job-shopfront.jpg`).
2. Add a line to `content/gallery.yml`:
   ```yaml
   - { src: "/assets/job-shopfront.jpg", caption: "toughened shopfront, fitted overnight" }
   ```

Paths always start `/assets/` — the schema rejects anything else.

---

## Running it locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # writes dist/
npm run preview  # serve the built site
```

Node 20+.

---

## How it's put together

```
content/            the site's words and numbers (YAML)
src/
  content.config.ts schemas — what each YAML file is allowed to contain
  lib/site.ts       hours parsing, tel: links, map URLs, JSON-LD
  layouts/Base.astro  shared shell: emergency bar, nav, footer, <head>
  components/       Gallery (grid + lightbox), ServiceIcon (line drawings)
  pages/            index · services · emergency · work · quote
  scripts/app.ts    live open/closed pill, keyboard nav, scroll indicator
public/
  styles.css        the whole stylesheet
  admin/            the /admin editor
  assets/           images, the share card, the self-hosted typeface
```

Five pages, built to flat URLs: `/`, `/services.html`, `/emergency.html`,
`/work.html`, `/quote.html`.

**The site works with JavaScript off.** `app.ts` only adds the live status pill,
keyboard support for the lightbox and the scroll indicator — the phone numbers,
navigation and photo lightbox are all plain HTML and CSS.

---

## Deployment

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages** on every
push to `main`. To turn it on:

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Point `crownpointglass.co.uk` at GitHub Pages in your DNS
   (`A` records to GitHub's IPs, or a `CNAME` to `<user>.github.io`).
   `public/CNAME` already claims the domain.

`.github/workflows/ci.yml` runs the same build on every pull request, so a
content error is caught before it merges.

**Nothing is deployed until DNS is changed** — the existing site at
crownpointglass.co.uk keeps serving until you point the domain here.

---

## SEO & structured data

Each page carries its own title, description, Open Graph and Twitter card
metadata. `src/lib/site.ts` emits `Glazier` schema.org JSON-LD with the address,
opening hours, service area and a 24/7 emergency `contactPoint` — which is what
Google Search and Maps read.

`public/assets/share-card.png` (1200×630) is the link preview image.
