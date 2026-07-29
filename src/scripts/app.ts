/* Crown Point Glass — progressive enhancement.
   The site works fully without this file; it just adds live touches:
   1) a real "open now / closed" status from the hours in content/settings.yml
   2) keyboard support for the burger menu and the work lightbox
   3) click-to-load maps, so Google isn't contacted until someone asks
   4) a small window pane that fills as you scroll                        */

import { computeStatus, type HoursData } from '../lib/status';

declare global {
  interface Window { __CPG__?: HoursData }
}

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1) live open / closed status ---------- */
// Note: this reflects the office/works hours only. The emergency line runs
// 24/7 and is never gated on this. The maths lives in ../lib/status.ts so it
// can be unit-tested against a fixed clock.
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
  // Escape closes the menu — expected of anything that opens over the page.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.checked) { toggle.checked = false; sync(); burger.focus(); }
  });
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
  // Move focus to the open lightbox's close button, and hide the closed ones
  // from assistive tech — otherwise every caption on the page is announced
  // twice, once in the grid and once in an invisible dialog.
  const syncLightboxes = () => {
    document.querySelectorAll<HTMLElement>('.lightbox').forEach((box) => {
      const open = box.matches(':target');
      box.toggleAttribute('inert', !open);
      box.setAttribute('aria-hidden', String(!open));
      if (open) box.querySelector<HTMLElement>('.lb-close')?.focus();
    });
  };
  syncLightboxes();
  addEventListener('hashchange', syncLightboxes);
}

/* ---------- 3) click-to-load map ---------- */
// The Google Maps embed pulls several hundred KB and sets Google cookies the
// moment it renders. Nobody arriving on the contact page has asked for that,
// so the markup ships a still placeholder and we only swap in the real iframe
// when someone actually wants the map. With JS off the placeholder stays and
// the "open in Google Maps" link underneath still works.
function wireMaps() {
  document.querySelectorAll<HTMLElement>('[data-map]').forEach((holder) => {
    const load = () => {
      const src = holder.dataset.map;
      if (!src || holder.dataset.loaded) return;
      holder.dataset.loaded = 'true';
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.title = holder.dataset.mapTitle || 'Map';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.allowFullscreen = true;
      frame.setAttribute('style', 'border:0; display:block; width:100%; height:100%;');
      holder.replaceChildren(frame);
    };
    holder.querySelector('.map-load')?.addEventListener('click', (e) => {
      e.preventDefault();
      load();
    });
  });
}

/* ---------- 4) scroll-fill window pane ---------- */
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
wireMaps();
buildScrollPane();
