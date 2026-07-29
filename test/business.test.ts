/**
 * The business rules — opening hours, phone links, structured data.
 *
 * These run against src/lib/business.ts directly, with no Astro and no build,
 * so they're fast enough to run on every save. The awkward cases (a day range
 * that wraps past Sunday, a `toDay` equal to `fromDay`, no hours at all) are
 * the ones worth pinning down: they're rare enough that nobody would notice
 * them breaking until a customer turned up to a closed unit.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  telHref, ogImage, canonicalUrl, hasAddress, fullAddress, mapEmbedUrl, directionsUrl,
  hoursShort, hoursRows, statusShort, openingHoursList, hoursData,
  prettyTime, compactTime, jsonLd, breadcrumbLd, servicesLd,
  type BusinessSettings, type HoursRow,
} from '../src/lib/business.ts';

/** A row with the schema's defaults applied, so tests only state what matters. */
const row = (r: Partial<HoursRow>): HoursRow =>
  ({ fromDay: 'Mo', toDay: '', closed: false, open: '', close: '', ...r });

const base: BusinessSettings = {
  url: 'https://crownpointglass.co.uk/',
  name: 'Crown Point Glass',
  legalName: 'Crown Point Glass Limited',
  description: 'Glaziers and glass manufacturers.',
  phone: '0161 943 5424',
  emergencyPhone: '07726 353078',
  email: '',
  street: '',
  postcode: '',
  locality: 'Manchester',
  region: 'Greater Manchester',
  country: 'GB',
  mapArea: 'Manchester, UK',
  areas: ['Manchester', 'Stockport'],
  facebook: 'https://www.facebook.com/secure24glazing/',
  instagram: 'https://www.instagram.com/crownpointglass',
  previewImage: './assets/share-card.png',
  hours: [
    row({ fromDay: 'Mo', toDay: 'Fr', open: '08:00', close: '17:00' }),
    row({ fromDay: 'Sa', open: '09:00', close: '13:00' }),
    row({ fromDay: 'Su', closed: true }),
  ],
};

const withHours = (hours: HoursRow[]): BusinessSettings => ({ ...base, hours });

describe('telHref', () => {
  test('turns a UK landline into a dialable international number', () => {
    assert.equal(telHref('0161 943 5424'), 'tel:+441619435424');
  });

  test('handles mobiles and punctuation the same way', () => {
    assert.equal(telHref('07726 353078'), 'tel:+447726353078');
    assert.equal(telHref('(0161) 943-5424'), 'tel:+441619435424');
  });

  test('leaves an already-international number alone', () => {
    assert.equal(telHref('+44 161 943 5424'), 'tel:+441619435424');
  });

  test("doesn't invent a +44 for a number that starts with neither", () => {
    assert.equal(telHref('161 943 5424'), 'tel:1619435424');
  });
});

describe('addresses and maps', () => {
  test('no street or postcode means a service-area business', () => {
    assert.equal(hasAddress(base), false);
    assert.equal(fullAddress(base), 'Manchester');
  });

  test('a partial address still counts as no address', () => {
    assert.equal(hasAddress({ ...base, street: '1 Crown Point' }), false);
    assert.equal(hasAddress({ ...base, postcode: 'M34 3SG' }), false);
  });

  test('both parts present publishes the address', () => {
    const s = { ...base, street: '1 Crown Point', postcode: 'M34 3SG' };
    assert.equal(hasAddress(s), true);
    assert.equal(fullAddress(s), '1 Crown Point, Manchester, M34 3SG');
  });

  test('the map zooms out to the coverage area when there is no address', () => {
    assert.match(mapEmbedUrl(base), /z=10/);
    assert.match(mapEmbedUrl(base), /q=Manchester%2C%20UK/);
    assert.match(mapEmbedUrl({ ...base, street: '1 Crown Point', postcode: 'M34 3SG' }), /z=15/);
  });

  test('falls back to the locality when mapArea is blank too', () => {
    assert.match(mapEmbedUrl({ ...base, mapArea: '' }), /q=Manchester%2C%20UK/);
  });

  test('directions point at the same place the map shows', () => {
    assert.match(directionsUrl(base), /destination=Manchester%2C%20UK$/);
  });
});

describe('canonical and share URLs', () => {
  test('the home page canonical is the bare domain', () => {
    assert.equal(canonicalUrl(base, 'index.html'), 'https://crownpointglass.co.uk/');
  });

  test('interior pages keep their .html', () => {
    assert.equal(canonicalUrl(base, 'services.html'), 'https://crownpointglass.co.uk/services.html');
  });

  test('a site url without a trailing slash still produces one slash', () => {
    const s = { ...base, url: 'https://crownpointglass.co.uk' };
    assert.equal(canonicalUrl(s, 'faq.html'), 'https://crownpointglass.co.uk/faq.html');
  });

  test('the share image is absolute — relative ones break link previews', () => {
    assert.equal(ogImage(base), 'https://crownpointglass.co.uk/assets/share-card.png');
  });
});

describe('time formatting', () => {
  test('renders on-the-hour times without the minutes', () => {
    assert.equal(prettyTime('08:00'), '8am');
    assert.equal(prettyTime('17:00'), '5pm');
    assert.equal(compactTime('08:00'), '8');
  });

  test('keeps the minutes when there are some', () => {
    assert.equal(prettyTime('13:30'), '1:30pm');
    assert.equal(compactTime('13:30'), '1:30');
  });

  test('midnight and noon are 12, not 0', () => {
    assert.equal(prettyTime('00:00'), '12am');
    assert.equal(prettyTime('12:00'), '12pm');
  });
});

describe('opening hours', () => {
  test('the hero line reads the way it is spoken', () => {
    assert.equal(hoursShort(base), 'Mon–Fri 8–5 · Sat 9–1');
  });

  test('the table shows closed days too', () => {
    assert.deepEqual(hoursRows(base), [
      { day: 'Mon – Fri', time: '8am – 5pm' },
      { day: 'Sat', time: '9am – 1pm' },
      { day: 'Sun', time: 'Closed' },
    ]);
  });

  test('the status pill collapses consecutive open days into a range', () => {
    assert.equal(statusShort(base), 'Office open Mon–Sat');
  });

  test('non-consecutive open days are listed separately', () => {
    const s = withHours([
      row({ fromDay: 'Mo', open: '08:00', close: '17:00' }),
      row({ fromDay: 'We', open: '08:00', close: '17:00' }),
      row({ fromDay: 'Th', toDay: 'Fr', open: '08:00', close: '17:00' }),
    ]);
    assert.equal(statusShort(s), 'Office open Mon, Wed–Fri');
  });

  test('a range that wraps past Sunday is expanded, not dropped', () => {
    // Sat through Tue — the loop has to come back round the start of the week.
    const s = withHours([row({ fromDay: 'Sa', toDay: 'Tu', open: '09:00', close: '13:00' })]);
    // Listed Mon-first, so the wrapped range reads as two runs, not one.
    assert.equal(statusShort(s), 'Office open Mon–Tue, Sat–Sun');
    const d = hoursData(s).days;
    for (const day of [6, 0, 1, 2]) assert.deepEqual(d[day], [[540, 780]], `day ${day}`);
    for (const day of [3, 4, 5]) assert.deepEqual(d[day], [], `day ${day}`);
  });

  test('a range whose toDay equals fromDay is a single day', () => {
    const s = withHours([row({ fromDay: 'We', toDay: 'We', open: '08:00', close: '17:00' })]);
    assert.equal(hoursShort(s), 'Wed 8–5');
    assert.deepEqual(hoursRows(s), [{ day: 'Wed', time: '8am – 5pm' }]);
    assert.deepEqual(openingHoursList(s), ['We 08:00-17:00']);
  });

  test('no open days at all degrades to a neutral label', () => {
    assert.equal(statusShort(withHours([row({ fromDay: 'Su', closed: true })])), 'Opening hours');
    assert.equal(hoursShort(withHours([row({ fromDay: 'Su', closed: true })])), '');
  });

  test('schema.org hours use day codes and 24-hour times', () => {
    assert.deepEqual(openingHoursList(base), ['Mo-Fr 08:00-17:00', 'Sa 09:00-13:00']);
  });

  test('closed days never reach the schema.org list', () => {
    assert.equal(openingHoursList(base).some((h) => h.startsWith('Su')), false);
  });

  test('the client data is keyed Sun=0 to match JS getDay()', () => {
    const { tz, days } = hoursData(base);
    assert.equal(tz, 'Europe/London');
    assert.deepEqual(days[0], []);                 // Sunday closed
    assert.deepEqual(days[1], [[480, 1020]]);      // Monday 08:00–17:00
    assert.deepEqual(days[5], [[480, 1020]]);      // Friday
    assert.deepEqual(days[6], [[540, 780]]);       // Saturday 09:00–13:00
  });

  test('two sittings on one day both survive', () => {
    const s = withHours([
      row({ fromDay: 'We', open: '08:00', close: '12:00' }),
      row({ fromDay: 'We', open: '13:00', close: '17:00' }),
    ]);
    assert.deepEqual(hoursData(s).days[3], [[480, 720], [780, 1020]]);
  });
});

describe('structured data', () => {
  test('describes a service-area business when no address is published', () => {
    const ld = jsonLd(base);
    assert.equal(ld['@type'], 'Glazier');
    assert.equal('streetAddress' in ld.address, false);
    assert.equal('postalCode' in ld.address, false);
    assert.equal(ld.address.addressLocality, 'Manchester');
    assert.deepEqual(ld.areaServed.map((a) => a.name), ['Manchester', 'Stockport']);
  });

  test('adds the postal address once there is one', () => {
    const ld = jsonLd({ ...base, street: '1 Crown Point', postcode: 'M34 3SG' });
    assert.equal((ld.address as Record<string, string>).streetAddress, '1 Crown Point');
    assert.equal((ld.address as Record<string, string>).postalCode, 'M34 3SG');
  });

  test('omits email entirely rather than emitting an empty one', () => {
    assert.equal('email' in jsonLd(base), false);
    assert.equal('email' in jsonLd({ ...base, email: 'a@b.co.uk' }), true);
  });

  test('the emergency contact point is 24/7 regardless of office hours', () => {
    const cp = jsonLd(base).contactPoint[0];
    assert.equal(cp.telephone, '07726 353078');
    assert.equal(cp.hoursAvailable.opens, '00:00');
    assert.equal(cp.hoursAvailable.closes, '23:59');
  });

  test('drops openingHours rather than emitting an empty array', () => {
    assert.equal('openingHours' in jsonLd(withHours([row({ fromDay: 'Su', closed: true })])), false);
  });

  test('sameAs skips socials that are not set', () => {
    assert.deepEqual(jsonLd({ ...base, facebook: undefined }).sameAs, [base.instagram]);
  });

  test('is JSON-serialisable — it is emitted as a JSON-LD script tag', () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(jsonLd(base))));
  });

  test('breadcrumbs run home → this page', () => {
    const ld = breadcrumbLd(base, 'Services', 'services.html');
    assert.deepEqual(ld.itemListElement.map((i) => [i.position, i.name, i.item]), [
      [1, 'Home', 'https://crownpointglass.co.uk/'],
      [2, 'Services', 'https://crownpointglass.co.uk/services.html'],
    ]);
  });

  test('each service points back at the one business record', () => {
    const ld = servicesLd(base, [
      { title: 'Emergency board-up', body: 'Made safe, fast.' },
      { title: 'Double glazing', body: 'Misted units replaced.' },
    ], 'services.html');
    assert.equal(ld.itemListElement.length, 2);
    assert.equal(ld.itemListElement[0].position, 1);
    assert.equal(ld.itemListElement[0].item.name, 'Emergency board-up');
    assert.equal(ld.itemListElement[0].item.provider['@id'], jsonLd(base)['@id']);
  });
});
