/* Crown Point Glass — progressive enhancement.
   The site works fully without this file; it just adds live touches:
   1) a real "open now / closed" status from the hours in content/settings.yml
   2) keyboard support for the burger menu and the work lightbox
   3) a small window pane that fills as you scroll                        */

type HoursData = { tz?: string; days?: Record<number, [number, number][]> };
declare global {
  interface Window { __CPG__?: HoursData }
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1) live open / closed status ---------- */
// Note: this reflects the office/works hours only. The emergency line runs
// 24/7 and is never gated on this.
const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtTime(mins: number): string {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return m ? `${h}:${String(m).padStart(2, '0')}${ap}` : `${h}${ap}`;
}

function nowInLondon(tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const day = WEEKDAY[get('weekday') ?? ''] ?? new Date().getDay();
  let hour = parseInt(get('hour') ?? '0', 10);
  if (hour === 24) hour = 0;
  return { day, mins: hour * 60 + parseInt(get('minute') ?? '0', 10) };
}

function computeStatus(data: HoursData) {
  const days = data.days || {};
  const { day, mins } = nowInLondon(data.tz || 'Europe/London');

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

function paintStatus() {
  const data = window.__CPG__;
  const nodes = document.querySelectorAll<HTMLElement>('[data-open-status]');
  if (!data || !nodes.length) return;
  const s = computeStatus(data);
  nodes.forEach((el) => {
    el.dataset.state = s.state;
    const main = el.querySelector('.status-text');
    const sub = el.querySelector('.of-sub');
    if (main) main.textContent = s.main;
    if (sub) sub.textContent = s.sub;
    el.setAttribute('title', `${s.main}${s.sub ? ' · ' + s.sub : ''}`);
  });
}

/* ---------- 2) keyboard support ---------- */
function wireBurger() {
  const burger = document.querySelector<HTMLElement>('.burger');
  const toggle = document.getElementById('nav-toggle') as HTMLInputElement | null;
  if (!burger || !toggle) return;
  const sync = () => burger.setAttribute('aria-expanded', String(toggle.checked));
  burger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.checked = !toggle.checked; sync(); }
  });
  toggle.addEventListener('change', sync);
  document.querySelectorAll('.topbar nav a').forEach((a) =>
    a.addEventListener('click', () => { toggle.checked = false; sync(); }));
}

function wireLightbox() {
  const go = (sel: string, box: Element) => {
    const a = box.querySelector(sel);
    const href = a?.getAttribute('href');
    if (href) location.href = href;
  };
  document.addEventListener('keydown', (e) => {
    const box = document.querySelector('.lightbox:target');
    if (!box) return;
    if (e.key === 'Escape') go('.lb-close', box);
    else if (e.key === 'ArrowLeft') go('.lb-prev', box);
    else if (e.key === 'ArrowRight') go('.lb-next', box);
  });
  // move focus to the open lightbox's close button for keyboard users
  addEventListener('hashchange', () => {
    const box = document.querySelector('.lightbox:target');
    if (box) box.querySelector<HTMLElement>('.lb-close')?.focus();
  });
}

/* ---------- 3) scroll-fill window pane ---------- */
function buildScrollPane() {
  if (reduceMotion) return;
  const el = document.createElement('div');
  el.className = 'scroll-pane';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><clipPath id="cpgPane"><rect x="9" y="7" width="30" height="34" rx="2"/></clipPath></defs>' +
    '<rect class="pane-fill" x="9" y="41" width="30" height="0" fill="#40c0d0" clip-path="url(#cpgPane)"/>' +
    '<rect x="9" y="7" width="30" height="34" rx="2" fill="none" stroke="#0f2233" stroke-width="3"/>' +
    '<path d="M24 7v34M9 24h30" stroke="#0f2233" stroke-width="3"/>' +
    '</svg>';
  document.body.appendChild(el);
  const fill = el.querySelector('.pane-fill')!;
  const TOP = 7, H = 34;
  let ticking = false;
  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
    fill.setAttribute('y', (TOP + H * (1 - p)).toFixed(1));
    fill.setAttribute('height', (H * p).toFixed(1));
    el.classList.toggle('is-on', doc.scrollTop > 140);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();
}

/* ---------- boot ---------- */
paintStatus();
setInterval(paintStatus, 60000);
wireBurger();
wireLightbox();
buildScrollPane();
