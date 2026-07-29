/**
 * Crown Point Glass — the business rules, with no Astro in them.
 *
 * Everything here is a pure function of the settings object (the validated
 * contents of content/settings.yml). Keeping it free of `astro:content`
 * imports is deliberate: it means the opening-hours maths, the phone-number
 * conversion and the structured data can all be unit-tested with plain
 * `node --test`, without standing up a build. src/lib/site.ts is the thin
 * Astro wrapper that loads the settings and re-exports these.
 */

/** A single row of the `hours` table in content/settings.yml. */
export interface HoursRow {
  fromDay: string;
  toDay: string;
  closed: boolean;
  open: string;
  close: string;
}

/**
 * The shape these helpers need. The real settings type is derived from the
 * Zod schema in src/content.config.ts; site.ts asserts that it satisfies
 * this interface, so a schema change that breaks these helpers fails the
 * type check rather than silently drifting.
 */
export interface BusinessSettings {
  url: string;
  name: string;
  legalName: string;
  description: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  street: string;
  postcode: string;
  locality: string;
  region: string;
  country: string;
  mapArea: string;
  areas: string[];
  facebook?: string;
  instagram?: string;
  previewImage: string;
  hours: HoursRow[];
}

// ── Address ──────────────────────────────────────────────────────────

export function fullAddress(s: BusinessSettings) {
  return [s.street, s.locality, s.postcode].filter(Boolean).join(', ');
}

/** True when a street address is published; false = service-area business. */
export function hasAddress(s: BusinessSettings) {
  return Boolean(s.street && s.postcode);
}

/**
 * What the map should point at. With an address that's the address; without
 * one it's the general area (`mapArea`), so the map shows the patch we cover
 * rather than pinning a building the business doesn't advertise.
 */
export function mapQuery(s: BusinessSettings) {
  return hasAddress(s) ? fullAddress(s) : (s.mapArea || `${s.locality}, UK`);
}

export function mapEmbedUrl(s: BusinessSettings) {
  const q = encodeURIComponent(mapQuery(s));
  // zoom out when showing a coverage area rather than a single address
  const z = hasAddress(s) ? 15 : 10;
  return `https://maps.google.com/maps?q=${q}&t=&z=${z}&ie=UTF8&iwloc=&output=embed`;
}

export function directionsUrl(s: BusinessSettings) {
  const q = encodeURIComponent(mapQuery(s));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

// ── Phone & images ───────────────────────────────────────────────────

/** "0161 943 5424" → "tel:+441619435424" — the form a phone will dial. */
export function telHref(number: string) {
  const digits = number.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('0')) return `tel:+44${digits.slice(1)}`;
  return `tel:${digits}`;
}

/** Social-share image as the absolute URL that WhatsApp/Twitter need. */
export function ogImage(s: BusinessSettings) {
  return s.url + s.previewImage.replace(/^\.?\//, '');
}

/** A page's canonical absolute URL. `page` is "" or "services.html". */
export function canonicalUrl(s: BusinessSettings, page: string) {
  const base = s.url.endsWith('/') ? s.url : `${s.url}/`;
  return page === 'index.html' ? base : base + page;
}

// ── Opening hours ────────────────────────────────────────────────────
// EVERYTHING hours-related derives from the single structured `hours` field
// (see the schema): the display table, the hero short line, the status pill
// text, the live open/closed pill data, and the Google (schema.org) hours.
// Nothing to keep in sync by hand. Sun=0 to match JS getDay().
const DAY_IDX: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const DAY_SHORT: Record<string, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const; // Mon-first, for ranges

/** "08:00" → "8am", "17:00" → "5pm", "13:30" → "1:30pm". */
export function prettyTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

/** Compact time for the hero line: "08:00" → "8", "13:30" → "1:30". */
export function compactTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, '0')}`;
}

/** Open day codes in Mon-first week order (a range like Mo-Fr is expanded). */
function openDayCodes(s: BusinessSettings) {
  const open = new Set<string>();
  for (const r of s.hours) {
    if (r.closed || !r.open || !r.close) continue;
    const start = WEEK.indexOf(r.fromDay as (typeof WEEK)[number]);
    if (start < 0) continue;
    const end = r.toDay ? WEEK.indexOf(r.toDay as (typeof WEEK)[number]) : start;
    if (end < 0) continue;
    for (let i = start; ; i = (i + 1) % 7) {
      open.add(WEEK[i]);
      if (i === end) break;
    }
  }
  return WEEK.filter((d) => open.has(d));
}

/** Status-pill text (pre-JS / no-JS fallback), e.g. "Office open Mon–Sat". */
export function statusShort(s: BusinessSettings) {
  const days = openDayCodes(s);
  if (!days.length) return 'Opening hours';
  const groups: [string, string][] = [];
  let start = days[0], prev = days[0];
  for (let k = 1; k < days.length; k++) {
    if (WEEK.indexOf(days[k]) === WEEK.indexOf(prev) + 1) { prev = days[k]; continue; }
    groups.push([start, prev]);
    start = prev = days[k];
  }
  groups.push([start, prev]);
  const parts = groups.map(([a, b]) => (a === b ? DAY_SHORT[a] : `${DAY_SHORT[a]}–${DAY_SHORT[b]}`));
  return `Office open ${parts.join(', ')}`;
}

/** Compact hero hours line, e.g. "Mon–Fri 8–5 · Sat 9–1". */
export function hoursShort(s: BusinessSettings) {
  return s.hours
    .filter((r) => !r.closed && r.open && r.close)
    .map((r) => {
      const day = r.toDay && r.toDay !== r.fromDay
        ? `${DAY_SHORT[r.fromDay]}–${DAY_SHORT[r.toDay]}`
        : DAY_SHORT[r.fromDay];
      return `${day} ${compactTime(r.open)}–${compactTime(r.close)}`;
    })
    .join(' · ');
}

/** The rows shown in the on-page hours table: friendly day + time labels. */
export function hoursRows(s: BusinessSettings) {
  return s.hours.map((r) => ({
    day: r.toDay && r.toDay !== r.fromDay
      ? `${DAY_SHORT[r.fromDay]} – ${DAY_SHORT[r.toDay]}`
      : DAY_SHORT[r.fromDay],
    time: r.closed ? 'Closed' : `${prettyTime(r.open)} – ${prettyTime(r.close)}`,
  }));
}

/** The Google/schema.org format, e.g. ["Mo-Fr 08:00-17:00", "Sa 09:00-13:00"]. */
export function openingHoursList(s: BusinessSettings) {
  return s.hours
    .filter((r) => !r.closed && !!r.open && !!r.close)
    .map((r) => `${r.fromDay}${r.toDay && r.toDay !== r.fromDay ? '-' + r.toDay : ''} ${r.open}-${r.close}`);
}

/**
 * The machine-readable map the client script uses for the live "open now /
 * closed" pill: { 0..6: [[openMins, closeMins], …] }, Sun=0.
 */
export function hoursData(s: BusinessSettings) {
  const days: Record<number, [number, number][]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const r of s.hours) {
    if (r.closed || !r.open || !r.close) continue;
    const [oh, om] = r.open.split(':').map(Number);
    const [ch, cm] = r.close.split(':').map(Number);
    const open = oh * 60 + om;
    const close = ch * 60 + cm;
    const start = DAY_IDX[r.fromDay];
    if (start == null) continue;
    const end = r.toDay ? DAY_IDX[r.toDay] : start;
    if (end == null) continue;
    for (let i = start; ; i = (i + 1) % 7) {
      days[i].push([open, close]);
      if (i === end) break;
    }
  }
  return { tz: 'Europe/London', days };
}

// ── Structured data ──────────────────────────────────────────────────

/**
 * LocalBusiness structured data (helps Google Search & Maps).
 *
 * With no street address published this describes a *service-area* business:
 * the postal address is reduced to the town/region, and `areaServed` carries
 * the coverage. Google supports this — it's the right shape for a mobile
 * trade — and it avoids advertising a building the business doesn't publish.
 */
export function jsonLd(s: BusinessSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Glazier',
    '@id': `${s.url}#business`,
    name: s.name,
    legalName: s.legalName,
    description: s.description,
    url: s.url,
    ...(s.email ? { email: s.email } : {}),
    telephone: s.phone,
    image: ogImage(s),
    address: {
      '@type': 'PostalAddress',
      ...(s.street ? { streetAddress: s.street } : {}),
      ...(s.postcode ? { postalCode: s.postcode } : {}),
      addressLocality: s.locality,
      addressRegion: s.region,
      addressCountry: s.country,
    },
    areaServed: s.areas.map((a) => ({ '@type': 'AdministrativeArea', name: a })),
    ...((list) => (list.length ? { openingHours: list } : {}))(openingHoursList(s)),
    // The emergency line runs around the clock regardless of office hours.
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'emergency',
      telephone: s.emergencyPhone,
      availableLanguage: 'English',
      hoursAvailable: { '@type': 'OpeningHoursSpecification', opens: '00:00', closes: '23:59' },
    }],
    sameAs: [s.facebook, s.instagram].filter(Boolean),
  };
}

/**
 * BreadcrumbList for an interior page — the markup that turns the grey
 * "crownpointglass.co.uk › Services" line under a Google result into a real
 * trail. The home page doesn't get one (a single-item trail is noise).
 */
export function breadcrumbLd(s: BusinessSettings, label: string, page: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl(s, 'index.html') },
      { '@type': 'ListItem', position: 2, name: label, item: canonicalUrl(s, page) },
    ],
  };
}

/**
 * The services page as a list of `Service` records tied back to the business,
 * so each service is a thing Google understands rather than a heading.
 */
export function servicesLd(
  s: BusinessSettings,
  services: { title: string; body: string }[],
  page: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Services — ${s.name}`,
    url: canonicalUrl(s, page),
    itemListElement: services.map((sv, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Service',
        name: sv.title,
        description: sv.body,
        serviceType: sv.title,
        provider: { '@id': `${s.url}#business` },
        areaServed: s.areas.map((a) => ({ '@type': 'AdministrativeArea', name: a })),
      },
    })),
  };
}
