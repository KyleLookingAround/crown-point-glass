/**
 * The live "open now / closed" calculation.
 *
 * Shared between the browser (src/scripts/app.ts paints it into the pills)
 * and the test suite. Pure and clock-injectable — pass `now` to ask what the
 * pill would say at a given moment, which is how it gets tested without
 * waiting until Tuesday.
 */

export type HoursData = { tz?: string; days?: Record<number, [number, number][]> };
export type Status = { state: 'open' | 'soon' | 'closed'; main: string; sub: string };

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Minutes-past-midnight → "5pm" / "1:30pm". */
export function fmtTime(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}

/**
 * Where the clock is in the *business's* timezone, not the visitor's — so
 * someone checking from Spain still sees whether the Manchester office is
 * open, which is the thing they actually want to know.
 */
export function localNow(tz: string, now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const day = WEEKDAY[get('weekday') ?? ''] ?? now.getDay();
  let hour = parseInt(get('hour') ?? '0', 10);
  if (hour === 24) hour = 0; // some ICU builds render midnight as 24:00
  return { day, mins: hour * 60 + parseInt(get('minute') ?? '0', 10) };
}

/**
 * The office status right now. "soon" fires in the last half hour so someone
 * ringing at ten to five knows they're cutting it fine.
 *
 * Note this covers the office/works hours only — the emergency line runs 24/7
 * and is deliberately never gated on it, which is why every "closed" message
 * still points at the out-of-hours number.
 */
export function computeStatus(data: HoursData, now: Date = new Date()): Status {
  const days = data.days || {};
  const { day, mins } = localNow(data.tz || 'Europe/London', now);

  for (const [o, c] of (days[day] || [])) {
    if (mins >= o && mins < c) {
      const left = c - mins;
      return left <= 30
        ? { state: 'soon', main: 'Office closing soon', sub: `til ${fmtTime(c)}` }
        : { state: 'open', main: 'Office open now', sub: `til ${fmtTime(c)}` };
    }
  }
  // closed — find the next opening within the week
  for (let off = 0; off < 8; off++) {
    const d = (day + off) % 7;
    for (const [o] of (days[d] || []).slice().sort((a, b) => a[0] - b[0])) {
      if (off === 0 && o <= mins) continue;
      const when = off === 0 ? fmtTime(o) : off === 1 ? `tomorrow ${fmtTime(o)}` : `${DAY_NAME[d]} ${fmtTime(o)}`;
      return { state: 'closed', main: 'Office closed', sub: `opens ${when} · 24hr line open` };
    }
  }
  return { state: 'closed', main: 'Office closed', sub: '24hr emergency line open' };
}
