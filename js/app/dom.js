// Bezpieczne budowanie DOM: tekst z danych trafia wyłącznie przez textContent / atrybuty.
export function h(tag, attrs = {}, ...children){
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})){
    if (typeof v === 'boolean' && k.startsWith('aria-')){ el.setAttribute(k, String(v)); continue; }
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}
function append(el, children){
  for (const c of children.flat(Infinity)){
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(el){ while (el.firstChild) el.firstChild.remove(); return el; }
export function setChildren(el, ...children){ clear(el); append(el, children); return el; }
export const $ = (s, r = document) => r.querySelector(s);

// Ikony Lucide (ISC), linie 2 px, 24×24 — ścieżki statyczne (inline SVG, działa offline).
const P = {
  map: 'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3zM9 3v15M15 6v15',
  tower: 'M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5M19.1 4.9C23 8.8 23 15.1 19.1 19M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  bookmark: 'M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3',
  locate: 'M2 12h3M19 12h3M12 2v3M12 19v3M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  layers: 'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83zM2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17',
  x: 'M18 6 6 18M6 6l12 12',
  chevronUp: 'M18 15l-6-6-6 6', chevronDown: 'M6 9l6 6 6-6', chevronRight: 'M9 18l6-6-6-6',
  compass: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  help: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01',
  wifiOff: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 4.2-2.7M10.7 5.1A15 15 0 0 1 22 8.8M5 12.9a10 10 0 0 1 5.2-2.8M16.8 11.2a10 10 0 0 1 2.2 1.7M12 20h.01',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  check: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  mountain: 'M8 3l4 8 5-5 5 15H2z',
  nav: 'M3 11l19-9-9 19-2-8z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  stop: 'M6 6h12v12H6z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  crosshair: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM22 12h-4M6 12H2M12 6V2M12 22v-4',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  filter: 'M22 3H2l8 9.5V19l4 2v-8.5z',
  wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z'
};
export function icon(name, size = 20, label){
  const ns = 'http://www.w3.org/2000/svg';
  const s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.classList.add('ico');
  if (label){ s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', P[name] || P.info); s.append(p);
  return s;
}
export function btn(label, { kind = 'secondary', iconName, onclick, attrs = {}, small = false } = {}){
  return h('button', { type: 'button', class: `btn btn-${kind}${small ? ' btn-sm' : ''}`, onclick, ...attrs }, iconName ? icon(iconName, 20) : null, h('span', {}, label));
}

// Komunikaty dla czytników ekranu i krótkie powiadomienia.
let liveEl, toastEl, toastTimer;
export function announce(text, { toast = true, kind = 'info' } = {}){
  liveEl ||= document.getElementById('live');
  toastEl ||= document.getElementById('toast');
  if (liveEl){ liveEl.textContent = ''; setTimeout(() => { liveEl.textContent = text; }, 30); }
  if (toast && toastEl){
    toastEl.textContent = text; toastEl.dataset.kind = kind; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, kind === 'error' ? 6000 : 3500);
  }
}

// Okna modalne: pułapka Tab, Escape, przywracanie fokusu.
const stack = [];
export function openModal({ title, body, actions = [], full = false, onClose, id }){
  const prevFocus = document.activeElement;
  const titleId = 'm-title-' + Math.random().toString(36).slice(2, 8);
  const closeBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zamknij' }, icon('x', 22));
  const dlg = h('div', { class: `modal${full ? ' modal-full' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, id },
    h('div', { class: 'modal-head' }, h('h2', { id: titleId }, title), closeBtn),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions) : null);
  const backdrop = h('div', { class: 'modal-backdrop' }, dlg);
  const api = {
    el: dlg, closed: false,
    close(){ if (api.closed) return; api.closed = true; backdrop.remove(); const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1); document.body.classList.toggle('has-modal', stack.length > 0); document.removeEventListener('keydown', onKey, true); onClose?.(); prevFocus?.focus?.(); },
    setBody(...c){ setChildren(dlg.querySelector('.modal-body'), ...c); }
  };
  function onKey(e){
    if (stack[stack.length - 1] !== api) return;
    if (e.key === 'Escape'){ e.preventDefault(); api.close(); }
    else if (e.key === 'Tab'){
      const f = [...dlg.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }
  closeBtn.addEventListener('click', () => api.close());
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) api.close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop); stack.push(api); document.body.classList.add('has-modal');
  setTimeout(() => (dlg.querySelector('[autofocus]') || closeBtn).focus(), 0);
  return api;
}
export function modalCount(){ return stack.length; }
export function closeTopModal(){ const m = stack[stack.length - 1]; if (!m) return false; m.close(); return true; }
export function closeAllModals(){ [...stack].forEach(m => m.close()); }
export const fmt = {
  km: v => v == null ? '—' : (v < 10 ? v.toFixed(2) : v.toFixed(1)).replace('.', ',') + ' km',
  deg: v => v == null ? '—' : Math.round(v) + '°',
  db: (v, u = 'dB') => v == null || !Number.isFinite(v) ? '—' : v.toFixed(1).replace('.', ',') + ' ' + u,
  m: v => v == null ? '—' : Math.round(v) + ' m',
  num: (v, d = 1) => v == null ? '—' : Number(v).toFixed(d).replace('.', ','),
  date: ts => ts ? new Date(ts).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '—',
  bytes: b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' kB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB'
};
