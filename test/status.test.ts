/**
 * The live "open now / closed" pill.
 *
 * computeStatus takes the clock as an argument precisely so this can be
 * tested — otherwise "what does it say at 4:45 on a Friday" is a question you
 * can only answer by waiting until 4:45 on a Friday.
 *
 * The dates below are chosen deliberately: 2025-01-13 is a Monday in GMT,
 * 2025-06-16 a Monday in BST. The BST cases are the point — the site is built
 * once and served for months, so the pill has to work out London time in the
 * browser rather than trusting the visitor's clock.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatus, localNow, fmtTime, type HoursData } from '../src/lib/status.ts';

// Mon–Fri 08:00–17:00, Sat 09:00–13:00, Sun closed — as shipped.
const HOURS: HoursData = {
  tz: 'Europe/London',
  days: {
    0: [],
    1: [[480, 1020]], 2: [[480, 1020]], 3: [[480, 1020]], 4: [[480, 1020]], 5: [[480, 1020]],
    6: [[540, 780]],
  },
};

/** A UTC instant. In GMT months that's London time; in BST it's an hour behind. */
const at = (iso: string) => new Date(`${iso}Z`);

describe('fmtTime', () => {
  test('drops :00 and uses 12-hour am/pm', () => {
    assert.equal(fmtTime(480), '8am');
    assert.equal(fmtTime(1020), '5pm');
    assert.equal(fmtTime(780), '1pm');
    assert.equal(fmtTime(750), '12:30pm');
    assert.equal(fmtTime(0), '12am');
  });
});

describe('localNow', () => {
  test('reads London time, not UTC, during British Summer Time', () => {
    // 08:30 UTC in June is 09:30 in London.
    assert.deepEqual(localNow('Europe/London', at('2025-06-16T08:30:00')), { day: 1, mins: 570 });
  });

  test('is the same as UTC in winter', () => {
    assert.deepEqual(localNow('Europe/London', at('2025-01-13T08:30:00')), { day: 1, mins: 510 });
  });

  test('midnight comes back as minute 0, not 1440', () => {
    assert.deepEqual(localNow('Europe/London', at('2025-01-13T00:00:00')), { day: 1, mins: 0 });
  });
});

describe('computeStatus', () => {
  test('open in the middle of a weekday', () => {
    const s = computeStatus(HOURS, at('2025-01-13T10:00:00'));
    assert.equal(s.state, 'open');
    assert.equal(s.main, 'Office open now');
    assert.equal(s.sub, 'til 5pm');
  });

  test('warns in the last half hour', () => {
    const s = computeStatus(HOURS, at('2025-01-13T16:45:00'));
    assert.equal(s.state, 'soon');
    assert.equal(s.main, 'Office closing soon');
  });

  test('exactly 30 minutes out still counts as closing soon', () => {
    assert.equal(computeStatus(HOURS, at('2025-01-13T16:30:00')).state, 'soon');
    assert.equal(computeStatus(HOURS, at('2025-01-13T16:29:00')).state, 'open');
  });

  test('open at the opening minute, closed at the closing minute', () => {
    assert.equal(computeStatus(HOURS, at('2025-01-13T08:00:00')).state, 'open');
    assert.equal(computeStatus(HOURS, at('2025-01-13T07:59:00')).state, 'closed');
    assert.equal(computeStatus(HOURS, at('2025-01-13T17:00:00')).state, 'closed');
  });

  test('before opening, it says when the office opens today', () => {
    const s = computeStatus(HOURS, at('2025-01-13T06:00:00'));
    assert.equal(s.state, 'closed');
    assert.equal(s.sub, 'opens 8am · 24hr line open');
  });

  test('after closing, it says tomorrow', () => {
    assert.equal(computeStatus(HOURS, at('2025-01-13T18:00:00')).sub, 'opens tomorrow 8am · 24hr line open');
  });

  test('on Sunday it names the day rather than saying "tomorrow"', () => {
    // 2025-01-12 is a Sunday; the next opening is Monday, which is tomorrow.
    assert.equal(computeStatus(HOURS, at('2025-01-12T12:00:00')).sub, 'opens tomorrow 8am · 24hr line open');
    // Saturday evening: Sunday is shut, so the next opening is two days out.
    assert.equal(computeStatus(HOURS, at('2025-01-11T18:00:00')).sub, 'opens Monday 8am · 24hr line open');
  });

  test('Saturday keeps its own shorter hours', () => {
    assert.equal(computeStatus(HOURS, at('2025-01-11T10:00:00')).sub, 'til 1pm');
    assert.equal(computeStatus(HOURS, at('2025-01-11T14:00:00')).state, 'closed');
  });

  test('British Summer Time is honoured, not ignored', () => {
    // 07:30 UTC in June is 08:30 in London — open. The naive UTC reading
    // would call this closed and turn away a customer who could have rung.
    assert.equal(computeStatus(HOURS, at('2025-06-16T07:30:00')).state, 'open');
    // 16:30 UTC is 17:30 London — shut, though UTC would still say open.
    assert.equal(computeStatus(HOURS, at('2025-06-16T16:30:00')).state, 'closed');
  });

  test('a business with no hours at all still points at the 24hr line', () => {
    const s = computeStatus({ tz: 'Europe/London', days: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } }, at('2025-01-13T10:00:00'));
    assert.equal(s.state, 'closed');
    assert.equal(s.sub, '24hr emergency line open');
  });

  test('missing data does not throw — the pill just falls back to closed', () => {
    assert.equal(computeStatus({}, at('2025-01-13T10:00:00')).state, 'closed');
  });

  test('every closed message mentions the emergency line', () => {
    // The 24/7 number is the whole proposition; a "closed" pill that hides it
    // costs the business the call.
    for (const when of ['2025-01-13T06:00:00', '2025-01-13T18:00:00', '2025-01-12T12:00:00']) {
      assert.match(computeStatus(HOURS, at(when)).sub, /24hr/, when);
    }
  });

  test('picks the right sitting when a day has two', () => {
    const split: HoursData = { tz: 'Europe/London', days: { 0: [], 1: [[480, 720], [780, 1020]], 2: [], 3: [], 4: [], 5: [], 6: [] } };
    assert.equal(computeStatus(split, at('2025-01-13T09:00:00')).sub, 'til 12pm');
    assert.equal(computeStatus(split, at('2025-01-13T12:30:00')).state, 'closed');
    assert.equal(computeStatus(split, at('2025-01-13T12:30:00')).sub, 'opens 1pm · 24hr line open');
    assert.equal(computeStatus(split, at('2025-01-13T14:00:00')).sub, 'til 5pm');
  });
});
