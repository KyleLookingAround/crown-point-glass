/**
 * Crown Point Glass — build-time helpers shared by the layout and pages:
 * hours parsing, phone/map URLs and JSON-LD.
 */
import { getEntry } from 'astro:content';

export async function getSettings() {
  const entry = await getEntry('settings', 'main');
  if (!entry) throw new Error('content/settings.yml is missing');
  return entry.data;
}
type Settings = Awaited<ReturnType<typeof getSettings>>;

export function fullAddress(s: Settings) {
  return [s.street, s.locality, s.postcode].filter(Boolean).join(', ');
}

export function mapEmbedUrl(s: Settings) {
  const q = encodeURIComponent(fullAddress(s));
  return `https://maps.google.com/maps?q=${q}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
}

export function directionsUrl(s: Settings) {
  const q = encodeURIComponent(fullAddress(s));
  return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
}

/** "0161 943 5424" → "tel:+441619435424" — the form a phone will dial. */
export function telHref(number: string) {
  const digits = number.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('0')) return `tel:+44${digits.slice(1)}`;
  return `tel:${digits}`;
}

/** Social-share image as the absolute URL that WhatsApp/Twitter need. */
export function ogImage(s: Settings) {
  return s.url + s.previewImage.replace(/^\.?\//, '');
}

// ── Opening hours ────────────────────────────────────────────────────
// EVERYTHING hours-related derives from the single structured `hours` field
// (see the schema): the display table, the hero short line, the status pill
// text, the live open/closed pill data, and the Google (schema.org) hours.
// Nothing to keep in sync by hand. Sun=0 to match JS getDay().
const DAY_IDX: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const DAY_SHORT: Record<string, string> = { Mo: 'Mon', Tu: 'Tue', We: 'Wed', Th: 'Thu', Fr: 'Fri', Sa: 'Sat', Su: 'Sun' };
const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const; // Mon-first, for ranges
type HoursRow = Settings['hours'][number];

/** "08:00" → "8am", "17:00" → "5pm", "13:30" → "1:30pm". */
function prettyTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}

/** Compact time for the hero line: "08:00" → "8", "13:30" → "1:30". */
function compactTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}` : `${h12}:${String(m).padStart(2, '0')}`;
}

/** Open day codes in Mon-first week order (a range like Mo-Fr is expanded). */
function openDayCodes(s: Settings) {
  const open = new Set<string>();
  for (const r of s.hours) {
    if (r.closed || !r.open || !r.close) continue;
    const start = WEEK.indexOf(r.fromDay);
    if (start < 0) continue;
    const end = r.toDay ? WEEK.indexOf(r.toDay) : start;
    for (let i = start; ; i = (i + 1) % 7) {
      open.add(WEEK[i]);
      if (i === end) break;
    }
  }
  return WEEK.filter((d) => open.has(d));
}

/** Status-pill text (pre-JS / no-JS fallback), e.g. "Open Mon–Sat". */
export function statusShort(s: Settings) {
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
export function hoursShort(s: Settings) {
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
export function hoursRows(s: Settings) {
  return s.hours.map((r) => ({
    day: r.toDay && r.toDay !== r.fromDay
      ? `${DAY_SHORT[r.fromDay]} – ${DAY_SHORT[r.toDay]}`
      : DAY_SHORT[r.fromDay],
    time: r.closed ? 'Closed' : `${prettyTime(r.open)} – ${prettyTime(r.close)}`,
  }));
}

/** The Google/schema.org format, e.g. ["Mo-Fr 08:00-17:00", "Sa 09:00-13:00"]. */
export function openingHoursList(s: Settings) {
  return s.hours
    .filter((r): r is HoursRow & { open: string; close: string } => !r.closed && !!r.open && !!r.close)
    .map((r) => `${r.fromDay}${r.toDay && r.toDay !== r.fromDay ? '-' + r.toDay : ''} ${r.open}-${r.close}`);
}

/**
 * The machine-readable map the client script uses for the live "open now /
 * closed" pill: { 0..6: [[openMins, closeMins], …] }, Sun=0.
 */
export function hoursData(s: Settings) {
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
    for (let i = start; ; i = (i + 1) % 7) {
      days[i].push([open, close]);
      if (i === end) break;
    }
  }
  return { tz: 'Europe/London', days };
}

/** LocalBusiness structured data (helps Google Search & Maps). */
export function jsonLd(s: Settings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Glazier',
    name: s.name,
    legalName: s.legalName,
    description: s.description,
    url: s.url,
    email: s.email,
    telephone: s.phone,
    image: ogImage(s),
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.street,
      addressLocality: s.locality,
      addressRegion: s.region,
      postalCode: s.postcode,
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
