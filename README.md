# Crown Point Glass — website

Static site for **Crown Point Glass Limited** — glaziers, glass manufacturers
and locksmiths covering Greater Manchester and Cheshire, with 24-hour emergency
boarding and repairs.

Built with [Astro](https://astro.build). Every word and number on the site comes
from the YAML files in [`content/`](content/), validated at build time — so a
typo fails the build instead of breaking the live site.

This project was ported from the [`rannys`](https://github.com/KyleLookingAround/rannys)
template: same architecture (YAML content → schema → Astro pages → GitHub Pages),
rebuilt around a glazing business.

---

## Where the content came from

Most of the site is built from the previous `crownpointglass.co.uk` site: the
six services, both phone numbers, the social accounts, the crown logo, the
Assure certification, and the whole FAQ page including its prices, guarantees
and turnaround times.

**Those figures are quoted from the old site and should be checked before this
goes live** — a price or guarantee that has moved on since is worse than none.
In particular: the £160 + VAT emergency call-out (5pm–8am), the 5 year glazing
guarantee, the 1 year locksmith guarantee, the 30–60 minute response and the
three week installation turnaround.

## ⚠️ One thing to do before launch: connect the form

**The enquiry forms don't send anywhere yet.** A static site can't process a
form on its own, so it needs an endpoint from a form service — Formspree,
Web3Forms, Basin and Getform all have free tiers. Sign up, paste the endpoint
into `formEndpoint` in `content/settings.yml`, and both the contact form and the
quote form start working.

Until then those pages deliberately show the phone numbers and say the form
isn't connected, rather than presenting a form that silently swallows
enquiries. That fallback is the safe state, not a bug — but it does mean every
web enquiry currently has to come by phone.

Once it's connected, two hidden fields do their job automatically:

- **`_gotcha`** is a honeypot. It's invisible to people; bots fill in every
  field they can find, and the form services bin anything that arrives with it
  filled in. No CAPTCHA, nothing for a real customer to solve.
- **`_next`** sends people to `/thanks.html` after a successful send, so they
  land back on our own site rather than the form service's page. Services that
  don't recognise the field just ignore it.

## No address, no email — on purpose

The old site published neither: just the two numbers, an enquiry form and a map
of Manchester. This site does the same, which is normal and sensible for a
mobile trade.

Practically, that means `street`, `postcode` and `email` in
`content/settings.yml` are **deliberately blank**, and the site adapts:

- the footer says "Covering Greater Manchester & Cheshire" instead of an address
- the map centres on `mapArea` (Manchester) rather than pinning a building
- the Google structured data describes a *service-area business* — town and
  region only, with `areaServed` carrying the coverage
- "email us" links become links to the enquiry form

Fill any of them in and the site switches back automatically — a real address
returns to the footer, map and structured data; an email restores the mailto
links. Nothing else needs touching.

The one value still inferred rather than confirmed is `hours` (Mon–Fri 8–5,
Sat 9–1, Sun closed), set to line up with the 8am–5pm emergency pricing split.
The 24hr line is separate and unaffected by it.

## Photographs

**There are no real job photographs yet.** `public/assets/work-*.svg` are line
drawings standing in for them, and `installation.jpg` (carried over from the old
site) is stock imagery, not a Crown Point job.

This is the single biggest thing that would lift the site. Ask the fitters to
take a phone snap *before* they board up and *after* they glaze — a set of real
before/afters would be worth more than any amount of design work. See
*Adding a photo* below.

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
| `content/settings.yml` | Phone numbers, form endpoint, opening hours, areas covered, footer details |
| `content/home.yml` | The home page top to bottom |
| `content/services.yml` | The six services |
| `content/emergency.yml` | The 24hr emergency page |
| `content/gallery.yml` | Job photos (first six also appear on the home page) |
| `content/faq.yml` | The FAQ page |
| `content/quote.yml` | The quote-request page |
| `content/contact.yml` | The contact page wording |

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

Node 22+ (the tests use Node's built-in runner and its TypeScript support).

---

## Tests

```bash
npm test         # build, then run everything
npm run check    # types only (astro check)
npm run verify   # check + build + test — what CI runs
npm run test:only  # tests against the existing dist/, no rebuild
```

There are two kinds, and the second is the interesting one.

**Unit tests** ([`test/business.test.ts`](test/business.test.ts),
[`test/status.test.ts`](test/status.test.ts),
[`test/imageSize.test.ts`](test/imageSize.test.ts)) cover the logic that's easy
to get subtly wrong and impossible to eyeball: opening-hours ranges that wrap
past Sunday, the `tel:` conversion, the shape of the Google structured data, and
the live open/closed pill — which is tested against a fixed clock, including
British Summer Time, so "what does it say at 4:45 on a Friday in June" is a
question with an answer rather than a wait.

That logic lives in [`src/lib/business.ts`](src/lib/business.ts) and
[`src/lib/status.ts`](src/lib/status.ts), deliberately free of Astro imports so
it can be tested without a build. [`src/lib/site.ts`](src/lib/site.ts) is the
thin wrapper that loads the settings and re-exports it.

**Integrity tests** ([`test/build.test.ts`](test/build.test.ts)) read the built
site in `dist/` and check the things a static build will happily ship broken:

- every internal link resolves to a page that exists, and every `#anchor` to an
  element that exists
- every image, script and stylesheet it references is actually on disk
- every page has a unique title, a usable description, a correct canonical URL
  and matching Open Graph tags
- the JSON-LD parses, and carries the business, breadcrumbs, the FAQs and the
  services
- both phone numbers appear on every page
- nothing loads from a third party before the visitor asks
- the sitemap lists every public page and neither of the noindex ones

This exists because the home page used to link its six job photos at
`photos.html` — a page that has never existed. It type-checked, it built, it
deployed, and the only way to find out was to click it. Now the build fails
instead.

---

## How it's put together

```
content/            the site's words and numbers (YAML)
src/
  content.config.ts schemas — what each YAML file is allowed to contain
  lib/
    business.ts     hours, tel: links, map URLs, JSON-LD — pure, unit-tested
    status.ts       the live open/closed calculation, shared with the browser
    imageSize.ts    reads image dimensions off the files at build time
    site.ts         the Astro wrapper: loads settings, re-exports the above
  layouts/Base.astro  shared shell: emergency bar, nav, footer, <head>
  components/       Gallery · Map (click-to-load) · EnquiryForm · ServiceIcon
  pages/            index · services · emergency · work · faq · quote ·
                    contact · thanks · 404
  scripts/app.ts    live pill, keyboard nav, click-to-load map, scroll indicator
test/               unit tests + integrity checks on the built site
public/
  styles.css        the whole stylesheet
  admin/            the /admin editor
  assets/           images, the share card, the self-hosted typeface
```

Nine pages, built to flat URLs: `/`, `/services.html`, `/emergency.html`,
`/work.html`, `/faq.html`, `/quote.html`, `/contact.html`, plus `/thanks.html`
(where the forms land) and `/404.html` — both `noindex` and both kept out of
the sitemap.

**The site works with JavaScript off.** `app.ts` only adds the live status pill,
keyboard support for the lightbox, the click-to-load map and the scroll
indicator — the phone numbers, navigation and photo lightbox are all plain HTML
and CSS, and where the map would be there's still a working link to Google Maps.

### Images size themselves

Every `<img>` ships with its real `width` and `height`, read off the file at
build time by [`src/lib/imageSize.ts`](src/lib/imageSize.ts) (it parses PNG,
JPEG, GIF, WebP and SVG headers). Nobody has to type dimensions for a photo
uploaded through `/admin`, and nothing on the page jumps as the images arrive.

### The map doesn't load until it's asked to

A Google Maps embed pulls a few hundred kilobytes and sets Google cookies the
moment it renders — on a page most people opened to get a phone number. So
[`src/components/Map.astro`](src/components/Map.astro) ships a placeholder and
only swaps in the real embed on click. Nothing reaches Google until someone
taps it, which is both faster and the right side of UK cookie rules. With
JavaScript off, the "Open in Google Maps" link underneath still works.

---

## Deployment

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages** on every
push to `main`. To turn it on:

1. Repo **Settings → Pages → Source: GitHub Actions**.
2. Point `crownpointglass.co.uk` at GitHub Pages in your DNS
   (`A` records to GitHub's IPs, or a `CNAME` to `<user>.github.io`).
   `public/CNAME` already claims the domain.

Both the deploy and `.github/workflows/ci.yml` (pull requests) run the same
three gates first — `astro check`, `astro build`, then the test suite. Nothing
publishes unless all three pass, so a content error or a broken link is caught
before it can reach the live site rather than after.

**Nothing is deployed until DNS is changed** — the existing site at
crownpointglass.co.uk keeps serving until you point the domain here.

---

## SEO & structured data

Each page carries its own title, description, canonical URL, Open Graph and
Twitter card metadata. `src/lib/business.ts` emits the structured data Google
Search and Maps actually read:

| Markup | Where | What it does |
|---|---|---|
| `Glazier` | every page | the business: phones, hours, service area, a 24/7 emergency `contactPoint` |
| `BreadcrumbList` | interior pages | the "crownpointglass.co.uk › Services" trail under a result |
| `FAQPage` | `/faq.html` | can put the questions straight into the search result |
| `ItemList` of `Service` | `/services.html` | each service as a thing we do, tied back to the business |

`public/assets/share-card.png` (1200×630) is the link preview image.

The integrity tests check all of this on the built output, so a change that
silently drops the structured data — or gives two pages the same canonical —
fails the build.
