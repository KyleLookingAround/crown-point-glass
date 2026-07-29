/**
 * Integrity checks on the built site in dist/.
 *
 * This is the test that would have caught the home page linking six photos at
 * `photos.html` — a page that has never existed. Nothing in a static build
 * complains about a dead internal link: it type-checks, it builds, it deploys,
 * and the first person to find out is a customer who clicked it.
 *
 * So: run the build, then read what actually came out. Every internal link
 * resolves, every referenced file is on disk, every page carries the metadata
 * it's supposed to, and the JSON-LD parses.
 *
 * Requires `npm run build` first — `npm test` does that for you.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/** Pages we expect to ship, and the nav label each should mark as current. */
const PAGES = [
  'index.html', 'services.html', 'emergency.html', 'work.html',
  'faq.html', 'quote.html', 'contact.html', 'thanks.html', '404.html',
];
/** The subset that should be indexable and in the sitemap. */
const PUBLIC_PAGES = PAGES.filter((p) => p !== 'thanks.html' && p !== '404.html');

type Page = { name: string; html: string };
const pages: Page[] = [];

before(() => {
  assert.ok(existsSync(DIST), 'dist/ is missing — run `npm run build` first');
  for (const name of PAGES) {
    const file = join(DIST, name);
    assert.ok(existsSync(file), `${name} was not built`);
    pages.push({ name, html: readFileSync(file, 'utf8') });
  }
});

// ── helpers ──────────────────────────────────────────────────────────

const attrs = (html: string, re: RegExp) =>
  [...html.matchAll(re)].map((m) => m[1]);

const hrefs = (html: string) => attrs(html, /\shref="([^"]*)"/g);
const srcs = (html: string) => attrs(html, /\ssrc="([^"]*)"/g);
const ids = (html: string) => attrs(html, /\sid="([^"]*)"/g);

const meta = (html: string, name: string) =>
  html.match(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`))?.[1]
  ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${name}"`))?.[1];

const jsonLdBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);

const isExternal = (href: string) =>
  /^(https?:|tel:|mailto:|data:|#|\/\/)/.test(href);

/** "./assets/x.svg", "/assets/x.svg" and "assets/x.svg" all name one file. */
const toDistPath = (url: string) =>
  url.replace(/^\.?\//, '').split('#')[0].split('?')[0];

/** Compare rendered text without tripping over &amp; vs &#38;. */
const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Everything that exists in dist/, as site-root-relative paths. */
function distFiles(dir = DIST, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) for (const f of distFiles(full, rel)) out.add(f);
    else out.add(rel);
  }
  return out;
}

// ── the checks ───────────────────────────────────────────────────────

describe('internal links', () => {
  test('every internal href resolves to a file that was built', () => {
    const files = distFiles();
    const broken: string[] = [];
    for (const { name, html } of pages) {
      for (const href of hrefs(html)) {
        if (isExternal(href) || href === '') continue;
        const path = toDistPath(href);
        if (path === '') continue;              // "./" — the home page
        if (!files.has(path)) broken.push(`${name} → ${href}`);
      }
    }
    assert.deepEqual(broken, [], `dead internal links:\n  ${broken.join('\n  ')}`);
  });

  test('every internal src (images, scripts) resolves too', () => {
    const files = distFiles();
    const missing: string[] = [];
    for (const { name, html } of pages) {
      for (const src of srcs(html)) {
        if (isExternal(src) || src === '') continue;
        const path = toDistPath(src);
        if (!files.has(path)) missing.push(`${name} → ${src}`);
      }
    }
    assert.deepEqual(missing, [], `missing assets:\n  ${missing.join('\n  ')}`);
  });

  test('every same-page anchor points at an element that exists', () => {
    const dangling: string[] = [];
    for (const { name, html } of pages) {
      const present = new Set(ids(html));
      for (const href of hrefs(html)) {
        if (!href.startsWith('#') || href === '#') continue;
        if (!present.has(href.slice(1))) dangling.push(`${name} → ${href}`);
      }
    }
    assert.deepEqual(dangling, [], `anchors with no target:\n  ${dangling.join('\n  ')}`);
  });

  test('cross-page anchors land on a real element on the target page', () => {
    const byName = new Map(pages.map((p) => [p.name, p.html]));
    const dangling: string[] = [];
    for (const { name, html } of pages) {
      for (const href of hrefs(html)) {
        if (isExternal(href) || !href.includes('#')) continue;
        const [path, frag] = href.replace(/^\.?\//, '').split('#');
        if (!path || !frag) continue;
        const target = byName.get(path);
        if (!target) continue;                  // covered by the resolves test
        if (!ids(target).includes(frag)) dangling.push(`${name} → ${href}`);
      }
    }
    assert.deepEqual(dangling, [], `cross-page anchors with no target:\n  ${dangling.join('\n  ')}`);
  });

  test('no page links to itself in the nav as if it were elsewhere', () => {
    // aria-current="page" has to be on exactly the link for the page you're on.
    for (const { name, html } of pages) {
      const current = [...html.matchAll(/<a[^>]+aria-current="page"[^>]*>/g)];
      if (name === 'thanks.html' || name === '404.html') {
        assert.equal(current.length, 0, `${name} is outside the nav and should mark nothing current`);
        continue;
      }
      assert.ok(current.length > 0, `${name} marks no nav item as current`);
      const expected = name === 'index.html' ? './' : `./${name}`;
      for (const m of current) {
        assert.match(m[0], new RegExp(`href="${expected.replace('.', '\\.')}"`), `${name}: aria-current is on the wrong link`);
      }
    }
  });
});

describe('page metadata', () => {
  test('every page has a unique, non-empty title', () => {
    const titles = pages.map(({ name, html }) => {
      const t = html.match(/<title>([^<]*)<\/title>/)?.[1];
      assert.ok(t && t.trim(), `${name} has no <title>`);
      return t;
    });
    assert.equal(new Set(titles).size, titles.length, 'two pages share a title');
  });

  test('every page has a unique description of a usable length', () => {
    const seen = new Set<string>();
    for (const { name, html } of pages) {
      const d = meta(html, 'description');
      assert.ok(d, `${name} has no meta description`);
      assert.ok(d!.length >= 50, `${name}'s description is too short to be useful (${d!.length} chars)`);
      assert.ok(d!.length <= 300, `${name}'s description is long enough that Google will cut it (${d!.length} chars)`);
      assert.equal(seen.has(d!), false, `${name} reuses another page's description`);
      seen.add(d!);
    }
  });

  test('every page declares its own canonical URL', () => {
    const seen = new Set<string>();
    for (const { name, html } of pages) {
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      assert.ok(canonical, `${name} has no canonical link`);
      assert.match(canonical!, /^https:\/\//, `${name}'s canonical is not absolute`);
      const expected = name === 'index.html' ? 'https://crownpointglass.co.uk/' : `https://crownpointglass.co.uk/${name}`;
      assert.equal(canonical, expected, `${name}'s canonical points somewhere else`);
      assert.equal(seen.has(canonical!), false, `${name} shares a canonical with another page`);
      seen.add(canonical!);
    }
  });

  test('the thank-you and 404 pages are noindex, and nothing else is', () => {
    for (const { name, html } of pages) {
      const robots = meta(html, 'robots');
      if (name === 'thanks.html' || name === '404.html') {
        assert.match(robots ?? '', /noindex/, `${name} should be noindex`);
      } else {
        assert.equal(robots, undefined, `${name} must not be noindex`);
      }
    }
  });

  test('link previews carry an absolute image and the matching og:url', () => {
    for (const { name, html } of pages) {
      assert.equal(meta(html, 'og:image'), 'https://crownpointglass.co.uk/assets/share-card.png', name);
      assert.equal(decode(meta(html, 'og:title') ?? ''), decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''), `${name}: og:title differs from <title>`);
      assert.equal(meta(html, 'twitter:card'), 'summary_large_image', name);
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      assert.equal(meta(html, 'og:url'), canonical, `${name}: og:url and canonical disagree`);
    }
  });

  test('the share card is actually in dist/', () => {
    assert.ok(existsSync(join(DIST, 'assets/share-card.png')), 'the Open Graph image is missing');
  });

  test('no duplicate element ids — they break anchors and labels', () => {
    for (const { name, html } of pages) {
      const seen = new Set<string>();
      const dupes = new Set<string>();
      for (const id of ids(html)) (seen.has(id) ? dupes : seen).add(id);
      assert.deepEqual([...dupes], [], `${name} has duplicate ids`);
    }
  });

  test('every image has alt text and explicit dimensions', () => {
    for (const { name, html } of pages) {
      for (const tag of html.match(/<img\b[^>]*>/g) ?? []) {
        assert.match(tag, /\salt="/, `${name}: <img> with no alt — ${tag.slice(0, 90)}`);
        assert.match(tag, /\swidth="/, `${name}: <img> with no width, which causes layout shift — ${tag.slice(0, 90)}`);
        assert.match(tag, /\sheight="/, `${name}: <img> with no height — ${tag.slice(0, 90)}`);
      }
    }
  });

  test('external links that open a new tab carry rel="noopener"', () => {
    for (const { name, html } of pages) {
      for (const tag of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? []) {
        assert.match(tag, /rel="[^"]*noopener/, `${name}: ${tag.slice(0, 90)}`);
      }
    }
  });
});

describe('structured data', () => {
  test('every JSON-LD block parses', () => {
    for (const { name, html } of pages) {
      for (const block of jsonLdBlocks(html)) {
        assert.doesNotThrow(() => JSON.parse(block), `${name} has unparseable JSON-LD`);
      }
    }
  });

  test('every page carries the business record', () => {
    for (const { name, html } of pages) {
      const found = jsonLdBlocks(html).map((b) => JSON.parse(b)).some((o) => o['@type'] === 'Glazier');
      assert.ok(found, `${name} has no LocalBusiness structured data`);
    }
  });

  test('interior pages carry a breadcrumb, the home page does not', () => {
    for (const { name, html } of pages) {
      const crumbs = jsonLdBlocks(html).map((b) => JSON.parse(b)).filter((o) => o['@type'] === 'BreadcrumbList');
      if (name === 'index.html' || name === 'thanks.html' || name === '404.html') {
        assert.equal(crumbs.length, 0, `${name} should have no breadcrumb`);
      } else {
        assert.equal(crumbs.length, 1, `${name} should have exactly one breadcrumb`);
        assert.equal(crumbs[0].itemListElement.length, 2, `${name}'s breadcrumb is the wrong shape`);
      }
    }
  });

  test('the FAQ page publishes its questions', () => {
    const faq = pages.find((p) => p.name === 'faq.html')!;
    const ld = jsonLdBlocks(faq.html).map((b) => JSON.parse(b)).find((o) => o['@type'] === 'FAQPage');
    assert.ok(ld, 'no FAQPage structured data');
    assert.ok(ld.mainEntity.length >= 5, 'suspiciously few questions made it into the structured data');
    for (const q of ld.mainEntity) {
      assert.ok(q.name?.trim(), 'a question has no text');
      assert.ok(q.acceptedAnswer?.text?.trim(), `"${q.name}" has no answer`);
    }
  });

  test('the services page publishes each service', () => {
    const svc = pages.find((p) => p.name === 'services.html')!;
    const ld = jsonLdBlocks(svc.html).map((b) => JSON.parse(b)).find((o) => o['@type'] === 'ItemList');
    assert.ok(ld, 'no service structured data');
    assert.ok(ld.itemListElement.length >= 1);
    for (const item of ld.itemListElement) {
      assert.equal(item.item['@type'], 'Service');
      assert.ok(item.item.name?.trim());
    }
  });
});

describe('the things that make the site work', () => {
  test('both phone numbers are dialable from every page', () => {
    for (const { name, html } of pages) {
      assert.match(html, /href="tel:\+441619435424"/, `${name} has no office number`);
      assert.match(html, /href="tel:\+447726353078"/, `${name} has no emergency number`);
    }
  });

  test('nothing contacts Google before the visitor asks', () => {
    // The map is click-to-load: no iframe, no Google request, no Google cookie
    // on first paint. If an eager embed creeps back in, this fails.
    for (const { name, html } of pages) {
      assert.doesNotMatch(html, /<iframe/, `${name} ships an iframe — the map should be click-to-load`);
      assert.doesNotMatch(html, /src="https?:\/\/(?!crownpointglass)/, `${name} loads a third-party asset on page load`);
    }
  });

  test('the map placeholder still offers a working way to Google Maps', () => {
    for (const name of ['index.html', 'contact.html', 'quote.html']) {
      const html = pages.find((p) => p.name === name)!.html;
      assert.match(html, /data-map="https:\/\/maps\.google\.com/, `${name} has no map to load`);
      assert.match(html, /href="https:\/\/www\.google\.com\/maps\/dir/, `${name} has no directions link for JS-off visitors`);
    }
  });

  test('the opening-hours data the pill reads is present and well-formed', () => {
    for (const { name, html } of pages) {
      const raw = html.match(/window\.__CPG__=(\{.*?\});/)?.[1];
      assert.ok(raw, `${name} has no hours data`);
      const data = JSON.parse(raw!);
      assert.equal(data.tz, 'Europe/London');
      assert.deepEqual(Object.keys(data.days).sort(), ['0', '1', '2', '3', '4', '5', '6']);
    }
  });

  test('every page has one h1', () => {
    for (const { name, html } of pages) {
      assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${name} should have exactly one <h1>`);
    }
  });

  test('the skip link is first and points at the main content', () => {
    for (const { name, html } of pages) {
      assert.match(html, /class="skip-link" href="#main"/, `${name} has no skip link`);
      assert.match(html, /<main id="main">/, `${name} has no #main to skip to`);
    }
  });

  test('the enquiry form is either wired up or honestly absent', () => {
    // While formEndpoint is blank the contact page must show the phone numbers,
    // not a form that silently swallows enquiries.
    const contact = pages.find((p) => p.name === 'contact.html')!.html;
    const hasForm = /<form class="enquiry"/.test(contact);
    if (hasForm) {
      assert.match(contact, /name="_gotcha"/, 'the form has no honeypot');
      assert.match(contact, /name="_next" value="https:\/\/crownpointglass\.co\.uk\/thanks\.html"/, 'the form does not return people to the thank-you page');
      // Every input needs a label pointing at it.
      for (const id of contact.match(/<(?:input|textarea|select)[^>]+id="([^"]+)"/g) ?? []) {
        const fieldId = id.match(/id="([^"]+)"/)![1];
        assert.match(contact, new RegExp(`for="${fieldId}"`), `field ${fieldId} has no label`);
      }
    } else {
      assert.match(contact, /class="form-fallback"/, 'no form and no fallback — the contact page is a dead end');
    }
  });
});

describe('deployment artefacts', () => {
  test('the sitemap lists every public page with its .html extension', () => {
    const index = join(DIST, 'sitemap-index.xml');
    assert.ok(existsSync(index), 'no sitemap was generated');
    const sitemapFiles = readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f));
    const urls = sitemapFiles.flatMap((f) =>
      [...readFileSync(join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

    for (const page of PUBLIC_PAGES) {
      // The sitemap writer normalises the root to a bare origin; per RFC 3986
      // that's the same URL as the trailing-slash form, so accept either.
      const expected = page === 'index.html'
        ? ['https://crownpointglass.co.uk/', 'https://crownpointglass.co.uk']
        : [`https://crownpointglass.co.uk/${page}`];
      assert.ok(expected.some((e) => urls.includes(e)), `${page} is missing from the sitemap (got: ${urls.join(', ')})`);
    }
    for (const hidden of ['thanks.html', '404.html']) {
      assert.equal(urls.some((u) => u.endsWith(hidden)), false, `${hidden} should not be in the sitemap`);
    }
  });

  test('the custom domain and robots rules survived the build', () => {
    assert.equal(readFileSync(join(DIST, 'CNAME'), 'utf8').trim(), 'crownpointglass.co.uk');
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    assert.match(robots, /Disallow: \/admin\//, 'the CMS should not be crawled');
    assert.match(robots, /Sitemap: https:\/\/crownpointglass\.co\.uk\/sitemap-index\.xml/);
  });

  test('the /admin editor points at this repository', () => {
    const cfg = readFileSync(join(DIST, 'admin/config.yml'), 'utf8');
    assert.match(cfg, /repo:\s*kylelookingaround\/crown-point-glass/i);
    assert.match(cfg, /branch:\s*main/);
  });

  test('the self-hosted typeface shipped — the whole site depends on it', () => {
    assert.ok(existsSync(join(DIST, 'assets/fonts/dmsans.woff2')));
  });
});
