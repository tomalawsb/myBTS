// DVB-T/T2 Point — interfejs „najpierw mapa”. Jedno źródło stanu instalacji, wszystkie obliczenia z tych samych parametrów.
import { APP_VERSION, ALGO_VERSION, RESULT_FORMAT_VERSION, P1812_IMPL, P1812_REFERENCE } from '../core/version.js';
import { distanceKm, azimuthDeg, compassPoint, normDeg } from '../core/geo.js';
import { txMarkerClass, txLegend, txVisible } from '../core/txstyle.js';
import { analyzePath, assessPoint, SYSTEM_PRESETS, DEFAULT_RX, MARGIN_BANDS, minFieldStrength, K_FACTOR } from '../core/rf.js';
import { parseAnt, antGainAt, antFingerprint } from '../core/ant.js';
import { normalizeDatabase, resolveEmission, listMuxTypes, emissionOfType, POLARIZATION_TEXT } from '../core/txdata.js';
import { errorText, AppError, fetchWithTimeout } from '../core/errors.js';
import { makeInstallationParams, rfKey, areaKey, selectionKey, createJobManager, createResultStore, buildPathInput } from '../core/state.js';
import { STATES as COMPASS_TEXT, turnInstruction } from '../core/compass-math.js';
import { h, $, setChildren, icon, btn, announce, openModal, closeAllModals, closeTopModal, fmt } from './dom.js';
import { scanCandidates, evaluateTx, rankResults, recommend, scanKey, SCAN_RADIUS_KM, SCAN_MAX_CANDIDATES } from '../core/rank.js';
import { FIELD_BANDS, colorize, coverageStats, sampleGrid } from '../core/coverage.js';
import { MODELS, DEFAULT_MODEL, P1812_DEFAULTS, TERMINAL_CLEAR_M, p1812OnProfile } from '../core/propagation.js';
import { buildProfile, DEM_SOURCE, demCacheInfo, clearDemCache, demResolutionM, DEM_Z } from './dem.js';
import { computeArea } from './area.js';
import * as store from './storage.js';
import { searchPlaces } from './geocode.js';
import { createCompass, nativeBridge } from './compass.js';
import { drawProfile } from './profile-chart.js';
import { renderBook } from './reference.js';

const L = window.L;
const S = Object.assign({ rxHeightM: 10, rx: { ...DEFAULT_RX }, calib: { invert: false, offset: 0 }, base: 'osm', extras: { txs: true, line: true }, areaMode: 'area', areaRadius: 100, areaView: 'field', areaOpacity: 0.45, txFilter: 'checked', sheetPos: 'summary' }, store.loadSettings());
// Migracja: dawny domyślny filtr ukrywał nadajniki z ujemnym zapasem — teraz domyślnie „Sprawdzone” (słabe widoczne).
if (S.txFilterV !== 2){ S.txFilter = 'checked'; S.txFilterV = 2; }
if (!['checked', 'inRange', 'all'].includes(S.txFilter)) S.txFilter = 'checked';
if (![30, 60, 100].includes(S.areaRadius)) S.areaRadius = 100;
if (!['field', 'margin'].includes(S.areaView)) S.areaView = 'field';
if (!['area', 'local'].includes(S.areaMode)) S.areaMode = 'area';
if (!(S.areaOpacity >= 0.1 && S.areaOpacity <= 1)) S.areaOpacity = 0.45;
if (!['collapsed', 'summary', 'expanded'].includes(S.sheetPos)) S.sheetPos = 'summary';
if (!S.muxType) S.muxType = (S.muxKey && String(S.muxKey).split('|')[1]) || 'MUX-3'; // typ MUX i emisja (txId + muxKey) trzymane osobno
delete S.sheetH;
S.rx = { ...DEFAULT_RX, ...S.rx };
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => store.saveSettings(S), 250); }; // zapis zbiorczy — mniej blokowania przy przesuwaniu mapy
addEventListener('pagehide', () => { clearTimeout(saveT); store.saveSettings(S); });
document.addEventListener('visibilitychange', () => { if (document.hidden){ clearTimeout(saveT); store.saveSettings(S); } });
let DB = { meta: null, txs: [], issues: [] };
let params = null, point = null, analysis = null, area = null;
const antCache = new Map();
const results = createResultStore();
const online = () => navigator.onLine !== false;
const jobs = createJobManager(renderJobs);
const ACCENT = '#155BDD';
// Ikony z index.html (data-icon) zamieniane na wspólny zestaw Lucide z dom.js.
for (const el of document.querySelectorAll('[data-icon]')) el.replaceWith(icon(el.dataset.icon, +el.dataset.size || 24));

// ---------- Mapa ----------
const BASES = {
  osm: { name: 'OpenStreetMap', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', o: { maxZoom: 19, attribution: '© OpenStreetMap' } },
  topo: { name: 'Topograficzna (OpenTopoMap)', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', o: { maxZoom: 17, attribution: '© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)' } },
  sat: { name: 'Satelitarna (Esri)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' } }
};
const map = L.map('map', { zoomControl: false, preferCanvas: true, fadeAnimation: false, attributionControl: true }).setView(S.view?.c || [52.0, 19.4], S.view?.z || 6);
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
// Nakładka nazw miejscowości, dróg i granic dla satelity (Esri Reference). Domyślnie włączona.
const LABEL_LAYERS = [
  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, pane: 'labels', attribution: 'Etykiety: Esri, HERE, Garmin, © OpenStreetMap' } },
  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', o: { maxZoom: 19, pane: 'labels' } }
];
if (S.satLabels === undefined) S.satLabels = true;
if (!(S.model in MODELS)) S.model = DEFAULT_MODEL;
if (!['nmt', 'dem'].includes(S.terrain)) S.terrain = 'nmt';
map.createPane('labels'); map.getPane('labels').style.zIndex = 350; map.getPane('labels').style.pointerEvents = 'none';
let baseLayer = null; const labelsLayer = L.layerGroup(LABEL_LAYERS.map(l => L.tileLayer(l.url, l.o)));
function applyLabels(){ (S.base === 'sat' && S.satLabels) ? labelsLayer.addTo(map) : map.removeLayer(labelsLayer); }
function setBase(id){ if (baseLayer) map.removeLayer(baseLayer); const b = BASES[id] || BASES.osm; baseLayer = L.tileLayer(b.url, b.o).addTo(map); S.base = id in BASES ? id : 'osm'; save(); applyLabels(); }
setBase(S.base);
const txLayer = L.layerGroup(), lineLayer = L.layerGroup().addTo(map), coverageLayer = L.layerGroup().addTo(map);
let pointMarker = null, overlay = null;
map.on('moveend', () => { S.view = { c: [map.getCenter().lat, map.getCenter().lng], z: map.getZoom() }; save(); });
// Dotknięcie mapy NIE przenosi punktu. Punkt ustawia: przytrzymanie (600 ms, ruch ≤ 10 px), menu prawego przycisku lub „Zmień lokalizację”.
let hintAt = 0;
map.on('click', e => {
  if (area){ readCoverage(e.latlng); return; }
  if (Date.now() - hintAt > 6000){ hintAt = Date.now(); announce('Przytrzymaj mapę, aby ustawić punkt'); }
});
const HOLD_MS = 600, HOLD_MOVE_PX = 10;
const mapEl = $('#map'), ringEl = $('#press-ring');
let press = null, swallowClickUntil = 0, lastPointerType = 'mouse';
const ptrs = new Set();
const onMapChrome = t => !!t.closest?.('.leaflet-marker-icon, .leaflet-control, .leaflet-popup, .map-menu');
function cancelPress(){ if (!press) return; clearTimeout(press.t); press = null; ringEl.hidden = true; ringEl.classList.remove('run'); }
mapEl.addEventListener('pointerdown', e => {
  lastPointerType = e.pointerType; if (e.isPrimary) ptrs.clear(); ptrs.add(e.pointerId);
  if (press || ptrs.size > 1){ cancelPress(); return; } // drugi palec = gest mapy
  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || onMapChrome(e.target)) return;
  closeMapMenu();
  const r = mapEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x, y, t: setTimeout(firePress, HOLD_MS) };
  ringEl.style.left = (x + mapEl.offsetLeft) + 'px'; ringEl.style.top = (y + mapEl.offsetTop) + 'px'; ringEl.hidden = false; ringEl.classList.remove('run'); void ringEl.offsetWidth; ringEl.classList.add('run');
}, true);
mapEl.addEventListener('pointermove', e => { if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > HOLD_MOVE_PX) cancelPress(); }, true);
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, e => { ptrs.delete(e.pointerId); if (press && e.pointerId === press.id) cancelPress(); }, true);
mapEl.addEventListener('touchstart', e => { if (e.touches.length > 1) cancelPress(); }, { capture: true, passive: true });
map.on('movestart zoomstart dragstart', cancelPress);
function firePress(){
  const p = press; cancelPress(); if (!p) return;
  swallowClickUntil = Date.now() + 1500; navigator.vibrate?.(20);
  const ll = map.containerPointToLatLng([p.x, p.y]);
  changePoint({ lat: ll.lat, lon: ll.lng, label: 'Punkt wskazany na mapie', source: 'mapa' });
}
// Blokada syntetycznego kliknięcia po przytrzymaniu (inaczej odczyt/podpowiedź uruchomiłyby się dodatkowo).
mapEl.addEventListener('click', e => { if (Date.now() < swallowClickUntil){ e.stopImmediatePropagation(); e.preventDefault(); swallowClickUntil = 0; } }, true);
mapEl.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (lastPointerType !== 'mouse' || onMapChrome(e.target)) return; // dotyk: menu systemowe wyłączone, punkt ustawia przytrzymanie
  cancelPress(); openMapMenu(e.clientX, e.clientY);
});
let mapMenu = null;
function closeMapMenu(){ mapMenu?.remove(); mapMenu = null; }
function openMapMenu(cx, cy){
  closeMapMenu();
  const r = mapEl.getBoundingClientRect(), ll = map.containerPointToLatLng([cx - r.left, cy - r.top]);
  const set = h('button', { type: 'button', role: 'menuitem', onclick: () => { closeMapMenu(); changePoint({ lat: ll.lat, lon: ll.lng, label: 'Punkt wskazany na mapie', source: 'mapa' }); } }, icon('pin', 18), h('span', {}, 'Ustaw punkt tutaj'));
  const cancel = h('button', { type: 'button', role: 'menuitem', onclick: closeMapMenu }, icon('x', 18), h('span', {}, 'Anuluj'));
  mapMenu = h('div', { class: 'map-menu', role: 'menu', 'aria-label': 'Menu mapy', style: { left: Math.min(cx - r.left, r.width - 200) + 'px', top: Math.min(cy - r.top, r.height - 110) + 'px' },
    onkeydown: e => { if (e.key === 'Escape') closeMapMenu(); } }, set, cancel);
  mapEl.parentElement.append(mapMenu); set.focus();
}
// Cofnięcie zmiany punktu (8 s).
let undoT = 0, undoPrev = undefined;
function changePoint(p){
  const prev = point ? { ...point } : null;
  setPoint(p); showUndo(prev);
}
function showUndo(prev){
  const el = $('#undo'); clearTimeout(undoT); undoPrev = prev;
  setChildren(el, h('span', {}, 'Ustawiono nowy punkt instalacji.'), h('button', { type: 'button', class: 'btn btn-tertiary btn-sm', id: 'btn-undo', onclick: undoPoint }, icon('refresh', 18), h('span', {}, 'Cofnij')));
  el.hidden = false; undoT = setTimeout(() => { el.hidden = true; undoPrev = undefined; }, 8000);
}
function undoPoint(){
  if (undoPrev === undefined) return false;
  const prev = undoPrev; undoPrev = undefined; clearTimeout(undoT); $('#undo').hidden = true;
  if (prev) setPoint(prev, { silent: true }); else clearPoint();
  announce('Przywrócono poprzedni punkt.'); return true;
}
function clearPoint(){
  point = null; S.point = null; save(); analysis = null; scan = null;
  if (pointMarker){ map.removeLayer(pointMarker); pointMarker = null; }
  lineLayer.clearLayers(); clearArea(); drawTxMarkers(); renderSheet();
}

// ---------- Baza nadajników ----------
async function loadDb(){
  try {
    const r = await fetch('data/transmitters.json', { cache: 'no-cache' });
    if (!r.ok) throw new AppError('service', `Nie udało się wczytać bazy (${r.status}).`);
    DB = normalizeDatabase(await r.json());
  } catch (e){ DB = { meta: null, txs: [], issues: [{ level: 'error', text: errorText(e, online()).text }] }; announce('Nie udało się wczytać bazy nadajników.', { kind: 'error' }); }
  drawTxMarkers();
}
// Kropki nadajników: aktualizacja przyrostowa (tylko zmienione ikony), zbijana do jednej klatki — mniej przerysowań na telefonie.
const txMarkers = new Map(); let txDrawQueued = false;
function drawTxMarkers(){ if (txDrawQueued) return; txDrawQueued = true; requestAnimationFrame(() => { txDrawQueued = false; drawTxMarkersNow(); }); }
function drawTxMarkersNow(){
  const keep = new Set();
  const byId = new Map((scan?.results || []).map(r => [r.txId, r]));
  const rec = scan?.done ? scan.recommended?.txId : null;
  const scanning = !!scan && !scan.done;
  for (const tx of DB.txs){
    const r = byId.get(tx.id), candidate = !!scan?.candIds?.has(tx.id);
    // Filtr wg wybranego MUX-a: domyślnie sprawdzone (także słabe), „z zapasem ≥ 0” albo wszystkie nadające ten MUX.
    if (!txVisible({ filter: S.txFilter, txId: tx.id, selectedId: S.txId, hasPoint: !!point, scan, candidate, result: r, emits: tx.muxNames.includes(S.muxType) })) continue;
    const isRec = tx.id === rec, sel = tx.id === S.txId;
    const c = point && scan ? txMarkerClass(r, { scanning, candidate }) : null;
    const size = isRec ? 26 : c && (c.id === 'strong' || c.id === 'good') ? 22 : 18;
    const fill = c ? c.color : ACCENT;
    const html = `<span class="txdot txdot-${c ? c.id : 'neutral'}${isRec ? ' txdot-rec' : ''}${sel ? ' txdot-sel' : ''}" style="--c:${fill};width:${size}px;height:${size}px">${c && !isRec ? c.symbol : isRec ? '★' : ''}</span>`;
    const z = isRec ? 900 : sel ? 800 : c?.id === 'strong' ? 400 : c?.id === 'good' ? 300 : 0;
    const tip = `${isRec ? '★ Polecany: ' : ''}${tx.name}${r && Number.isFinite(r.marginDb) ? ` · ${S.muxType} zapas ${fmt.db(r.marginDb)}` : ''}${c ? ` · ${c.label}` : ''}`;
    keep.add(tx.id);
    let e = txMarkers.get(tx.id);
    if (!e){
      const m = L.marker([tx.lat, tx.lon], { icon: L.divIcon({ className: 'txdot-wrap', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }), keyboard: false, title: '', zIndexOffset: z });
      m.bindTooltip(tip);
      m.on('click', ev => { L.DomEvent.stopPropagation(ev); chooseTx(tx.id); });
      e = { m, html, tip }; txMarkers.set(tx.id, e);
    } else {
      if (e.html !== html){ e.m.setIcon(L.divIcon({ className: 'txdot-wrap', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })); e.html = html; }
      if (e.tip !== tip){ e.m.setTooltipContent(tip); e.tip = tip; }
      e.m.setZIndexOffset(z);
    }
    if (!txLayer.hasLayer(e.m)) txLayer.addLayer(e.m);
  }
  for (const [id, e] of txMarkers) if (!keep.has(id) && txLayer.hasLayer(e.m)) txLayer.removeLayer(e.m);
  applyExtras();
}
function applyExtras(){
  S.extras.txs ? txLayer.addTo(map) : map.removeLayer(txLayer);
  S.extras.line ? lineLayer.addTo(map) : map.removeLayer(lineLayer);
}
const curTx = () => DB.txs.find(t => t.id === S.txId) || null;

// ---------- Punkt ----------
function setPoint(p, { silent = false } = {}){
  point = { lat: +p.lat, lon: +p.lon, label: p.label || '', source: p.source || '', accuracyM: p.accuracyM ?? null };
  S.point = point; save();
  // Pinezka nie jest przeciągalna (przypadkowe przesunięcia) — zmiana tylko przytrzymaniem lub „Zmień lokalizację”.
  if (!pointMarker) pointMarker = L.marker([point.lat, point.lon], { draggable: false, keyboard: false, interactive: false, title: 'Punkt instalacji', alt: 'Punkt instalacji' }).addTo(map);
  else pointMarker.setLatLng([point.lat, point.lon]);
  compass.setLocation(point.lat, point.lon, 0); updateCone(compass.snapshot());
  if (!S.txId || !curTx()) autoTx();
  clearArea();
  if (!silent) announce('Ustawiono punkt instalacji.', { toast: false });
  runPoint();
}
function autoTx(){
  if (!point || !DB.txs.length) return;
  // Najbliższy nadajnik nadający WYBRANY typ MUX (z kompletem danych) — tylko propozycja do czasu wyniku rankingu.
  const all = DB.txs.map(t => [t, emissionOfType(t, S.muxType)]).filter(x => x[1]);
  const ok = all.filter(x => !x[1].missing.length);
  const best = (ok.length ? ok : all).map(x => [...x, distanceKm(point, x[0])]).sort((a, b) => a[2] - b[2])[0];
  if (best){ S.txId = best[0].id; S.muxKey = best[1].key; save(); }
}
/** Wybór nadajnika. Bez klucza emisji — zachowuje wybrany typ MUX (nigdy nie przełącza go po cichu). */
function chooseTx(id, muxKey, { manual = true } = {}){
  const tx = DB.txs.find(t => t.id === id); if (!tx) return;
  if (manual) manualTxFor = pointKey(); // wybór użytkownika — polecany ani zadania w tle go nie nadpisują
  const m = muxKey ? tx.muxes.find(x => x.key === muxKey) : emissionOfType(tx, S.muxType);
  if (m && m.name !== S.muxType){ S.muxType = m.name; } // jawny wybór konkretnej emisji innego typu przez użytkownika
  S.txId = id; S.muxKey = m?.key || null; save();
  if (!m) announce(`${tx.name} nie nadaje ${S.muxType}. Wybierz inny nadajnik albo zmień MUX.`, { kind: 'warn' });
  updateMuxButton(); clearArea(); drawLine(); drawTxMarkers(); runPoint(); if (document.body.dataset.tab === 'tx') renderTxTab();
}
/** Zmiana typu MUX: emisja wybranego nadajnika tego typu (albo komunikat), ranking i lista liczone dla nowego MUX-a. */
function setMuxType(name){
  if (!name || name === S.muxType) return;
  S.muxType = name; const tx = curTx(), m = tx ? emissionOfType(tx, name) : null;
  S.muxKey = m?.key || null; save();
  if (tx && !m) announce(`${tx.name} nie nadaje ${name}. Wybierz nadajnik z listy.`, { kind: 'warn' });
  updateMuxButton(); clearArea(); drawLine(); drawTxMarkers(); runPoint(); if (document.body.dataset.tab === 'tx') renderTxTab();
}
function updateMuxButton(){
  const b = $('#btn-mux'); if (!b) return;
  b.querySelector('.mux-val').textContent = muxLabel(S.muxType);
  b.setAttribute('aria-label', `Wybrany multipleks: ${S.muxType}. Zmień MUX`);
}

const muxLabel = name => name === 'MUX' || name === 'MUX bez nazwy' ? 'Bez numeru MUX' : name;
function openMuxPicker(){
  const types = listMuxTypes(DB.txs), tx = curTx();
  const groups = [
    ['Multipleksy krajowe', types.filter(t => /^MUX-\d+$/.test(t.name))],
    ['Multipleksy lokalne', types.filter(t => /^MUX-L\d+$/.test(t.name))],
    ['Pozostałe emisje', types.filter(t => !/^MUX-(?:L)?\d+$/.test(t.name))]
  ];
  const m = openModal({ title: 'Wybierz multipleks (MUX)', body: h('div', {},
    h('p', { class: 'muted' }, 'Wybierz MUX, a następnie porównaj nadajniki. Liczby poniżej dotyczą całej bazy.'),
    h('div', { role: 'radiogroup', 'aria-label': 'Multipleksy w bazie' }, groups.filter(([, list]) => list.length).map(([title, list]) => h('section', { class: 'mux-group' }, h('h3', {}, title),
      h('div', { class: 'mux-grid mux-list' }, list.map(t => {
        const sel = t.name === S.muxType, em = tx ? emissionOfType(tx, t.name) : null;
        return h('button', { type: 'button', role: 'radio', 'aria-checked': sel, class: `mux-cell${sel ? ' selected' : ''}`, 'data-mux': t.name, onclick: () => { m.close(); setMuxType(t.name); } },
          h('span', { class: 'mux-copy' }, h('strong', {}, muxLabel(t.name)), h('small', {}, `Nadajniki w bazie: ${t.count}${em ? ` · tutaj K${em.channel ?? '?'}` : ''}`),
            muxLabel(t.name) !== t.name ? h('small', {}, 'Źródło nie podaje numeru multipleksu.') : null),
          sel ? h('span', { class: 'mux-check', 'aria-hidden': 'true' }, '✓') : null);
      })))))) });
}
function locate(){
  if (!navigator.geolocation){ announce('Lokalizacja niedostępna w tej przeglądarce.', { kind: 'error' }); return; }
  announce('Ustalanie położenia…');
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon, accuracy } = pos.coords;
    if (accuracy > 100) announce(`Niska dokładność lokalizacji (±${Math.round(accuracy)} m) — popraw punkt na mapie.`, { kind: 'warn' });
    setPoint({ lat, lon, label: 'Moja lokalizacja (GPS)', source: 'gps', accuracyM: accuracy });
    map.setView([lat, lon], Math.max(map.getZoom(), 15));
  }, err => announce(err.code === 1 ? 'Odmówiono dostępu do lokalizacji. Wskaż punkt na mapie lub wyszukaj adres.' : 'Nie udało się ustalić położenia.', { kind: 'error' }), { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
}

// ---------- ANT ----------
async function loadAnt(mux){
  if (!mux?.antPath) return { status: 'none', gains: null, note: 'Brak pliku charakterystyki — przyjęto antenę dookólną (0 dB).' };
  if (antCache.has(mux.antPath)) return antCache.get(mux.antPath);
  let res;
  try {
    const r = await fetch(mux.antPath);
    if (!r.ok) throw new Error(String(r.status));
    const p = parseAnt(await r.text());
    res = !p.ok ? { status: 'invalid', gains: null, note: `Plik charakterystyki odrzucony: ${p.error} Przyjęto 0 dB.` }
      : p.placeholder ? { status: 'placeholder', gains: null, note: 'Plik charakterystyki pusty (same zera) — przyjęto 0 dB.' }
      : { status: 'ok', gains: p.gains, note: 'Charakterystyka z pliku .ant (RadioPolska).' };
  } catch { res = { status: 'unavailable', gains: null, note: 'Nie udało się wczytać pliku charakterystyki — przyjęto 0 dB.' }; }
  antCache.set(mux.antPath, res); return res;
}

// ---------- Analiza punktu ----------
// Jeden zestaw parametrów (model, teren, klutter, odbiornik) dla punktu, rankingu i mapy zasięgu.
const terrainOf = () => S.model === 'p1812' ? S.terrain : 'dem';
const clutterOn = () => S.model === 'p1812';
const selKeyNow = () => selectionKey({ point, txId: S.txId, muxKey: S.muxKey, muxType: S.muxType, rxHeightM: S.rxHeightM, model: S.model, terrain: terrainOf(), clutter: clutterOn(), rx: S.rx });
async function currentParams(){
  const tx = curTx(); if (!point || !tx) return null;
  if (!S.muxKey) return { error: `${tx.name} nie nadaje ${S.muxType}.`, missingMux: true, tx };
  const em = resolveEmission(tx, S.muxKey);
  if (!em.mux) return { error: em.reason, missingMux: !!em.missingMux, tx };
  const ant = await loadAnt(em.mux);
  return { p: makeInstallationParams({ point, rxHeightM: S.rxHeightM, tx, emission: em, antFingerprint: antFingerprint(ant.gains), dataVersion: DB.meta?.dataVersion, rx: S.rx, model: S.model, terrain: terrainOf(), clutter: clutterOn() }), em, ant, tx };
}
let pointSeq = 0;
async function runPoint(){
  const seq = ++pointSeq, sel = selKeyNow();
  runScan();
  const c = await currentParams();
  if (seq !== pointSeq) return; // nowszy wybór — porzucamy
  analysis = null; renderSheet();
  if (!c) return;
  if (c.error){ jobs.get('point')?.cancel('brak emisji'); renderSheet({ error: c.error, missingMux: c.missingMux }); return; }
  params = c.p;
  drawLine();
  if (!c.em.ok){ renderSheet({ error: `${c.em.reason} Analiza poziomu sygnału jest niemożliwa — baza nie zawiera wymaganych danych.` }); return; }
  const key = rfKey(params);
  const cached = results.get(key);
  if (cached){ jobs.get('point')?.cancel('wynik z pamięci'); analysis = cached; syncScanWithPoint(cached); renderSheet(); return; }
  const job = jobs.start('point', { key, label: 'Analiza punktu' });
  try {
    const isP = params.model === 'p1812';
    const profile = await buildProfile(point, c.tx, { signal: job.signal, online: online(), terrain: params.terrain, cover: isP, onProgress: (d, n) => job.setProgress(d / n, `Teren: ${d}/${n} kafli`) });
    if (!job.isCurrent()) return;
    const path = analyzePath(buildPathInput(params, profile));
    const prop = isP ? propFor(params, profile) : null;
    const azTxToRx = azimuthDeg(c.tx, point); // kierunek nadajnik → punkt (charakterystyka ANT)
    const antRelDb = antGainAt(c.ant.gains, azTxToRx);
    const res = assessPoint({ path, erpKw: params.erpKw, antRelDb, antStatus: c.ant.status, rx: S.rx, prop });
    const az = azimuthDeg(point, c.tx);
    const meta = { antMissing: c.ant.status !== 'ok', coverMissing: isP && !profile.cover, terrainFallback: params.terrain === 'nmt' && profile.terrainId !== 'nmt' };
    const value = { key, sel, params, path, prop, meta, sources: sourcesOf(params, profile, c.ant), profile: { d: profile.d, e: profile.e, lats: profile.lats, lons: profile.lons, cover: profile.cover, spacingM: profile.spacingM, terrainId: profile.terrainId, source: profile.source, coverSource: profile.coverSource }, res, ant: c.ant, az, azTxToRx, mux: c.em.mux, tx: c.tx, at: Date.now() };
    // Wynik pokazujemy tylko, gdy parametry nadal pasują (szybkie przełączanie nie zostawia starego wyniku).
    if (!job.isCurrent() || seq !== pointSeq || selKeyNow() !== sel) return;
    if (!results.accept(key, rfKey(params), value)) return;
    job.finish(); analysis = value; syncScanWithPoint(value); renderSheet();
    announce(res.ok ? `Wynik: ${res.band.label}, zapas ${fmt.db(res.marginDb)}.` : res.reason, { toast: false });
  } catch (e){
    if (e.kind === 'aborted' || job.state === 'cancelled') return;
    job.fail(e); renderSheet({ error: errorText(e, online()).text });
  }
}
function propFor(p, profile){
  return p1812OnProfile({ d: profile.d, e: profile.e, lats: profile.lats, lons: profile.lons, cover: profile.cover, rxHeightM: p.rxHeightM, txHeightM: p.txHeightM, txGroundM: p.txGroundM, freqMHz: p.freqMHz, pol: p.polarization });
}
/** Opis modelu i danych użytych w KONKRETNYM wyniku: rozdzielczość źródła terenu i krok próbkowania osobno; braki danych jawnie. */
function sourcesOf(p, profile, ant){
  const m = MODELS[p.model] || MODELS.simple;
  const terrain = profile.terrainId === 'nmt' ? 'NMT GUGiK (rozdzielczość źródła 1 m)' : profile.terrainId === 'nmt+dem' ? 'NMT GUGiK 1 m + Terrarium ~30 m (uzupełnienie)' : `Terrarium (rozdzielczość źródła ~${demResolutionM(DEM_Z, p.point.lat)} m)`;
  const step = `próbkowanie profilu co ${Math.round(profile.spacingM)} m`;
  const cover = p.model !== 'p1812' ? 'nie dotyczy' : profile.cover ? 'CORINE 2018 (100 m)' : 'BRAK danych — przyjęto teren otwarty';
  const missing = [];
  if (ant && ant.status !== 'ok') missing.push(`charakterystyka anteny nadawczej: ${ant.note}`);
  if (p.model === 'p1812' && !profile.cover) missing.push('pokrycie terenu (CORINE) niedostępne — bez tłumienia zabudowy/lasu przy odbiorniku');
  if (p.terrain === 'nmt' && profile.terrainId !== 'nmt') missing.push('NMT GUGiK niedostępny na części trasy — użyto Terrarium');
  return { model: m.short, terrain, step, cover, terrainSource: profile.source, coverSource: profile.coverSource, missing, notes: [profile.terrainNote, p.model === 'p1812' ? profile.coverNote : null].filter(Boolean),
    line: `Model: ${m.short} · Teren: ${terrain}, ${step}${p.model === 'p1812' ? ` · Pokrycie: ${cover}` : ''}` };
}
function drawLine(){
  lineLayer.clearLayers();
  const tx = curTx(); if (!point || !tx) return;
  // Kierunek anteny — główna informacja na mapie: wyraźna linia z obwódką.
  L.polyline([[point.lat, point.lon], [tx.lat, tx.lon]], { color: '#fff', weight: 8, opacity: .9, interactive: false }).addTo(lineLayer);
  L.polyline([[point.lat, point.lon], [tx.lat, tx.lon]], { color: ACCENT, weight: 4, interactive: false, className: 'az-line' }).addTo(lineLayer);
  L.circleMarker([tx.lat, tx.lon], { radius: 11, color: ACCENT, weight: 3, fill: false, interactive: false }).addTo(lineLayer);
}

// ---------- Nadajniki dla wybranego MUX-a i polecany ----------
// Kandydaci do 120 km nadający wybrany MUX; ocena tymi samymi funkcjami i parametrami co analiza punktu (krok profilu 100 m).
const scanCache = new Map();
let scan = null, manualTxFor = null;
const pointKey = () => point ? `${point.lat.toFixed(4)},${point.lon.toFixed(4)}` : null;
const nodataRow = (tx, mux, pt, reason) => ({ txId: tx.id, name: tx.name, muxKey: mux?.key ?? null, mux: mux?.name ?? null, channel: mux?.channel ?? null, variant: mux?.variant ?? null, distanceKm: distanceKm(pt, tx), az: azimuthDeg(pt, tx), checked: true, state: 'nodata', inRange: false, marginDb: null, fieldDbuvm: null, status: null, reason });
async function runScan({ more = false } = {}){
  if (!point || !DB.txs.length || !S.muxType) return;
  const key = scanKey({ point, muxName: S.muxType, rxHeightM: S.rxHeightM, rx: S.rx, dataVersion: DB.meta?.dataVersion, model: S.model, terrain: terrainOf(), clutter: clutterOn() });
  let cur;
  if (more && scan?.key === key){ cur = scan; cur.limit += SCAN_MAX_CANDIDATES; cur.done = false; }
  else {
    if (scan?.key === key && (scan.done || jobs.get('scan'))){ if (scan.done) afterScan(false); return; }
    if (scanCache.has(key)){ scan = scanCache.get(key); afterScan(false); return; }
    const pt = { ...point }, cands = scanCandidates(pt, DB.txs, { muxName: S.muxType, rx: { ...S.rx } });
    cur = scan = { key, pt, muxType: S.muxType, rxH: S.rxHeightM, rx: { ...S.rx }, model: S.model, terrain: terrainOf(), done: false, recommended: null, queue: cands.list, limit: SCAN_MAX_CANDIDATES, next: 0, checked: 0, skipped: 0,
      // słabe już w wolnej przestrzeni (zapas < 0 nawet bez terenu) i brak danych w bazie — pokazujemy, nie ukrywamy
      results: [...cands.weak.map(w => ({ txId: w.tx.id, name: w.tx.name, muxKey: w.mux.key, mux: w.mux.name, channel: w.mux.channel, variant: w.mux.variant, distanceKm: w.distanceKm, az: azimuthDeg(pt, w.tx), checked: true, state: 'weak', inRange: false, marginDb: w.freeSpaceMarginDb, bound: true, status: null })),
        ...cands.noData.map(n => nodataRow(n.tx, n.mux, pt, `brak w bazie: ${n.missing.join(', ')}`))] };
  }
  cur.total = Math.min(cur.limit, cur.queue.length);
  cur.candIds = new Set(cur.queue.slice(0, cur.total).map(c => c.tx.id));
  drawTxMarkers(); if (document.body.dataset.tab === 'tx') renderTxTab();
  const job = jobs.start('scan', { key, label: `Ranking nadajników ${cur.muxType}` });
  try {
    for (; cur.next < cur.total; cur.next++){
      const { tx, mux } = cur.queue[cur.next];
      job.setProgress(cur.next / Math.max(1, cur.total), `${cur.next + 1}/${cur.total}: ${tx.name}`);
      let profile;
      try { profile = await buildProfile(cur.pt, tx, { signal: job.signal, online: online(), spacingM: 100, terrain: cur.terrain, cover: cur.model === 'p1812' }); }
      catch (e){ if (e.kind === 'aborted' || job.state === 'cancelled') throw e; cur.skipped++; cur.results.push(nodataRow(tx, mux, cur.pt, 'brak danych terenu')); continue; }
      if (!job.isCurrent()) return;
      const ant = await loadAnt(mux);
      const antRelDb = antGainAt(ant.gains, azimuthDeg(tx, cur.pt));
      const r = evaluateTx({ tx, mux, profile, point: cur.pt, rxHeightM: cur.rxH, rx: cur.rx, model: cur.model, antRelDb });
      const prev = cur.results.findIndex(x => x.txId === tx.id); if (prev >= 0) cur.results.splice(prev, 1);
      cur.results.push(r); cur.checked++;
      if (document.body.dataset.tab === 'tx') renderTxTab();
      await new Promise(r => setTimeout(r, 0)); // oddaj wątek UI między nadajnikami
    }
  } catch (e){ if (e.kind === 'aborted' || job.state === 'cancelled') return; job.fail(e); }
  if (scan !== cur) return;
  if (job.state === 'running') job.finish();
  cur.results = rankResults(cur.results); cur.recommended = recommend(cur.results); cur.done = true;
  if (!cur.skipped) scanCache.set(key, cur);
  afterScan(true);
}
/** Wynik analizy punktu (dokładniejszy krok profilu) zastępuje pozycję rankingu tego nadajnika — lista i panel pokazują tę samą liczbę. */
function syncScanWithPoint(a){
  if (!scan || scan.muxType !== a.mux.name || !a.res.ok || pointKey() !== `${scan.pt.lat.toFixed(4)},${scan.pt.lon.toFixed(4)}`) return;
  const v = { txId: a.tx.id, name: a.tx.name, muxKey: a.mux.key, mux: a.mux.name, channel: a.mux.channel, variant: a.mux.variant, distanceKm: a.path.distanceKm, az: a.az, checked: true,
    state: a.res.marginDb >= 0 ? 'ok' : 'weak', inRange: a.res.marginDb >= 0, marginDb: a.res.marginDb, fieldDbuvm: a.res.fieldDbuvm, status: a.path.status, fromPoint: true };
  const i = scan.results.findIndex(x => x.txId === v.txId);
  if (i >= 0) scan.results[i] = v; else scan.results.push(v);
  if (scan.done){ scan.results = rankResults(scan.results); scan.recommended = recommend(scan.results); }
  drawTxMarkers(); if (document.body.dataset.tab === 'tx') renderTxTab();
}
function afterScan(fresh){
  drawTxMarkersNow();
  const rec = scan?.recommended;
  // Polecany zastępuje wybór tylko, gdy użytkownik nie wybrał nadajnika ręcznie dla tego punktu (nigdy nie zmienia typu MUX).
  if (rec && manualTxFor !== pointKey() && S.txId !== rec.txId && rec.mux === S.muxType && !area){
    S.txId = rec.txId; S.muxKey = rec.muxKey; save();
    clearArea(); drawTxMarkers();
    if (fresh) announce(`Polecany nadajnik ${S.muxType}: ${rec.name} (zapas ${fmt.db(rec.marginDb)}).`);
    runPoint();
  } else if (fresh && scan?.done && !rec) announce(`Brak nadajnika ${S.muxType} z zapasem ≥ 0 dB w promieniu ${SCAN_RADIUS_KM} km (model).`, { kind: 'warn' });
  renderSheet();
  if (document.body.dataset.tab === 'tx') renderTxTab();
}
function scanMore(){ runScan({ more: true }); }
function setTxFilter(v){ S.txFilter = v; save(); drawTxMarkersNow(); if (document.body.dataset.tab === 'tx') renderTxTab(); }

// ---------- Mapa zasięgu ----------
// Liczona TYM SAMYM modelem i parametrami co punkt. Zapisujemy wartości pola + maskę; widok (pole/zapas) i próg odbiornika
// zmieniają tylko kolory — bez ponownego liczenia.
let worker = null, workerBroken = false, areaSeq = 0, areaAttempt = null;
const areaDescription = (mode, radius) => mode === 'local' ? 'okolica punktu — 1 km' : `${radius} km wokół nadajnika`;
function cancelArea(){
  areaSeq++;
  if (areaAttempt && ['preparing', 'running'].includes(areaAttempt.state)) areaAttempt.state = 'cancelled';
  jobs.get('area')?.cancel('przerwane przez użytkownika');
  renderCoverageModal();
}
function clearArea(){ areaSeq++; areaAttempt = null; jobs.get('area')?.cancel('zmiana parametrów'); if (overlay){ map.removeLayer(overlay); overlay = null; } coverageLayer.clearLayers(); map.closePopup(); area = null; renderLegend(); renderCoverageModal(); }
const mercY = lat => { const r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)); };
async function runArea(mode = S.areaMode, radiusKm = S.areaRadius){
  const seq = ++areaSeq, sel = selKeyNow();
  jobs.get('area')?.cancel('nowe obliczenie');
  const attempt = areaAttempt = { mode, radius: mode === 'local' ? 1 : radiusKm, state: 'preparing', seq };
  renderCoverageModal();
  const c = await currentParams();
  if (seq !== areaSeq) return;
  if (!c || c.error || !c.em.ok){ attempt.state = 'error'; renderCoverageModal(); announce('Najpierw ustaw punkt i wybierz nadajnik z kompletem danych dla wybranego MUX-a.', { kind: 'warn' }); return; }
  const p = c.p;
  const radius = mode === 'local' ? 1 : radiusKm;
  const key = areaKey(p, mode, radius);
  const txGround = Number.isFinite(c.tx.siteElevationM) ? c.tx.siteElevationM : (analysis?.tx.id === c.tx.id ? analysis.path.txGround : null);
  const job = jobs.start('area', { key, label: mode === 'local' ? 'Okolica punktu (1 km)' : `Wokół nadajnika (${radius} km)` });
  attempt.state = 'running';
  if (txGround == null){ attempt.state = 'error'; job.fail(new AppError('input')); announce('Brak wysokości terenu nadajnika — najpierw wykonaj analizę punktu.', { kind: 'warn' }); return; }
  const spec = { mode, tx: { lat: c.tx.lat, lon: c.tx.lon }, txHeightM: p.txHeightM, txGround, rxHeightM: p.rxHeightM, freqMHz: p.freqMHz, erpKw: p.erpKw, gains: c.ant.gains, radiusKm: radius,
    point: { lat: p.point.lat, lon: p.point.lon }, online: online(), model: p.model, pol: p.polarization || 'H', clutter: p.clutter };
  try {
    const res = await areaCompute(spec, job);
    // Wynik tylko, gdy wybór (punkt, nadajnik, MUX, model, teren…) się nie zmienił.
    if (!job.isCurrent() || seq !== areaSeq || selKeyNow() !== sel) return;
    attempt.state = 'done'; job.finish(); showArea(res, { key, mode, radius, tx: c.tx, mux: c.em.mux, model: p.model, antStatus: c.ant.status });
  } catch (e){ if (e.kind === 'aborted' || job.state === 'cancelled') return; attempt.state = 'error'; job.fail(e); announce(errorText(e, online()).text, { kind: 'error' }); }
  renderCoverageModal();
}
function areaCompute(spec, job){
  if (workerBroken || typeof Worker === 'undefined') return computeArea(spec, { signal: job.signal, progress: (p, t) => job.setProgress(p, t) });
  return new Promise((resolve, reject) => {
    try { worker ||= new Worker(new URL('./area-worker.js', import.meta.url), { type: 'module' }); }
    catch { workerBroken = true; return resolve(computeArea(spec, { signal: job.signal, progress: (p, t) => job.setProgress(p, t) })); }
    const id = job.id;
    const onMsg = ev => {
      const m = ev.data; if (m.id !== id) return;
      if (m.type === 'progress') job.setProgress(m.p, m.text);
      else { worker.removeEventListener('message', onMsg); m.type === 'done' ? resolve(m.res) : reject(new AppError(m.kind, m.message)); }
    };
    worker.addEventListener('message', onMsg);
    worker.onerror = () => { workerBroken = true; worker.terminate(); worker = null; resolve(computeArea(spec, { signal: job.signal, progress: (p, t) => job.setProgress(p, t) })); };
    job.signal.addEventListener('abort', () => { worker?.postMessage({ type: 'abort' }); reject(new AppError('aborted')); });
    worker.postMessage({ type: 'run', id, job: spec });
  });
}
const areaEMin = () => area ? minFieldStrength(area.freqMHz, S.rx).eMin : 0;
function showArea(res, info){
  area = { ...res, ...info, freqMHz: info.mux.frequencyMHz, txName: info.tx.name, muxName: info.mux.name, channel: info.mux.channel, variant: info.mux.variant };
  coverageLayer.clearLayers();
  // Okrąg = granica analizy (poza nim „nie obliczono”).
  L.circle([res.center.lat, res.center.lon], { radius: res.radiusKm * 1000, color: '#0F1B33', weight: 1.5, dashArray: '6 6', fill: false, interactive: false }).addTo(coverageLayer);
  legendOpen = false;
  renderCoverage();
  if (covModal){ const cm = covModal; covModal = null; cm.close(); } // okno „Zasięg” zamyka się po obliczeniu — widać mapę
  map.fitBounds([[res.bounds.s, res.bounds.w], [res.bounds.n, res.bounds.e]], { padding: [20, 20] });
  const st = area.stats;
  announce(`Mapa zasięgu gotowa. Dodatni zapas modelowy na ${Math.round(100 * (st.positiveShare ?? 0))}% obliczonego obszaru.`);
}
/** Przekolorowanie z zapisanych wartości (widok / próg odbiornika / przezroczystość). */
function renderCoverage(){
  if (!area) return;
  const eMin = areaEMin();
  const rgba = colorize(area, { view: S.areaView, eMin });
  const cv = document.createElement('canvas'); cv.width = area.width; cv.height = area.height;
  cv.getContext('2d').putImageData(new ImageData(rgba, area.width, area.height), 0, 0);
  const b = [[area.bounds.s, area.bounds.w], [area.bounds.n, area.bounds.e]];
  if (overlay) map.removeLayer(overlay);
  overlay = L.imageOverlay(cv.toDataURL('image/png'), b, { opacity: S.areaOpacity, interactive: false, className: 'coverage-overlay' }).addTo(map);
  area.stats = coverageStats(area, { eMin }); area.eMin = eMin; area.view = S.areaView;
  renderLegend();
}
function setAreaView(v){ S.areaView = v === 'margin' ? 'margin' : 'field'; save(); renderCoverage(); renderCoverageModal(); }
function setAreaOpacity(v){ S.areaOpacity = Math.max(0.1, Math.min(1, v)); save(); overlay?.setOpacity(S.areaOpacity); }
/** Odczyt z mapy (interpolowany) — NIE przenosi punktu instalacji. */
function readCoverage(latlng, { popup = true } = {}){
  if (!area) return null;
  const { bounds: bd, width: W, height: H } = area;
  const fx = (latlng.lng - bd.w) / (bd.e - bd.w) * W, fy = (mercY(bd.n) - mercY(latlng.lat)) / (mercY(bd.n) - mercY(bd.s)) * H;
  const inside = distanceKm(area.center, { lat: latlng.lat, lon: latlng.lng }) <= area.radiusKm;
  const r = inside ? sampleGrid(area, fx, fy) : { state: 'outside' };
  const out = { ...r, margin: r.state === 'ok' ? r.value - areaEMin() : null };
  if (popup){
    const body = h('div', { class: 'readout' }, h('small', { class: 'muted' }, 'Odczyt z mapy (interpolowany)'),
      r.state === 'ok' ? [h('strong', {}, fmt.db(r.value, 'dBµV/m')), h('div', {}, `zapas ${out.margin >= 0 ? '+' : ''}${fmt.db(out.margin)} dla bieżącej instalacji`)]
        : r.state === 'nodata' ? h('strong', {}, 'Brak danych terenu — nie obliczono') : h('strong', {}, 'Nie obliczono (poza obszarem analizy)'),
      h('small', { class: 'muted' }, `${area.muxName} K${area.channel ?? '?'} · ${area.txName}. Punkt instalacji bez zmian.`));
    L.popup({ closeButton: true, autoPan: false, className: 'readout-popup' }).setLatLng(latlng).setContent(body).openOn(map);
  }
  return out;
}
let legendOpen = false;
// Delegacja: legenda jest przerysowywana w trakcie liczenia, więc kliknięcie może trafić w nowy węzeł.
$('#legend').addEventListener('click', e => { if (e.target === $('#legend') || e.target.closest('.legend-toggle')){ if (e.target.closest('.icon-btn')) return; legendOpen = !legendOpen; renderLegend(); } });
function renderLegend(){
  const el = $('#legend');
  if (!area){ el.hidden = true; return; }
  el.hidden = false; el.dataset.open = legendOpen;
  const st = area.stats, field = area.view !== 'margin';
  const bands = field ? FIELD_BANDS.slice().reverse() : MARGIN_BANDS.slice().reverse();
  const share = id => (field ? st.fieldShare : st.marginShare)[id] || 0;
  const pos = st.positiveShare == null ? '—' : `${Math.round(100 * st.positiveShare)}%`;
  const title = `${area.muxName} K${area.channel ?? '?'} · ${area.txName}`;
  const toggle = h('button', { type: 'button', class: 'legend-toggle', 'aria-expanded': legendOpen, 'aria-controls': 'legend-body' },
    h('span', { class: 'legend-bar', 'aria-hidden': 'true' }, bands.map(b => h('i', { style: { background: b.color, flexGrow: Math.max(0.02, share(b.id)) } }))),
    h('span', { class: 'legend-title', title }, h('strong', {}, field ? 'Natężenie pola' : 'Zapas odbioru'), h('small', {}, `zapas+ ${pos}`)), icon(legendOpen ? 'chevronUp' : 'chevronDown', 18));
  const close = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Usuń mapę zasięgu', onclick: clearArea }, icon('x', 18));
  if (!legendOpen){ setChildren(el, h('div', { class: 'legend-head' }, toggle, close)); return; }
  const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Widok mapy zasięgu' },
    [['field', 'Natężenie pola'], ['margin', 'Zapas odbioru']].map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': S.areaView === v, onclick: () => setAreaView(v) }, S.areaView === v ? '✓ ' : '', l)));
  const opacity = h('label', { class: 'field' }, h('span', {}, `Krycie warstwy: ${Math.round(100 * S.areaOpacity)}%`),
    h('input', { type: 'range', min: 10, max: 100, step: 5, value: Math.round(100 * S.areaOpacity), 'aria-label': 'Krycie warstwy zasięgu w procentach', oninput: e => { setAreaOpacity(+e.target.value / 100); e.target.previousSibling.textContent = `Krycie warstwy: ${e.target.value}%`; } }));
  const rows = bands.map(b => h('div', { class: 'legend-row' }, h('span', { class: `sw sw-${b.pattern || 'solid'}`, style: { background: b.color } }),
    h('span', {}, field ? `${b.label} dBµV/m` : b.label, !field ? h('small', { class: 'muted' }, b.min === -Infinity ? ` < ${Math.round(area.eMin)} dBµV/m` : ` ≥ ${Math.round(area.eMin + b.min)} dBµV/m (+${b.min} dB)`) : null),
    h('span', { class: 'muted' }, `${Math.round(100 * share(b.id))}%`)));
  setChildren(el, h('div', { class: 'legend-head' }, toggle, close),
    h('div', { id: 'legend-body' },
      h('p', { class: 'legend-meta' }, h('strong', {}, title), h('br'), `${area.variant ? `wariant ${area.variant} · ` : ''}jednostka: ${field ? 'dBµV/m' : 'dB (zapas)'} · model: ${(MODELS[area.model] || MODELS.simple).short}`),
      seg, rows,
      h('div', { class: 'legend-row nodata' }, h('span', { class: 'sw sw-nodata' }), h('span', {}, 'Brak danych terenu (nie obliczono)'), h('span', { class: 'muted' }, `${Math.round(100 * st.noDataShare)}%`)),
      h('p', { class: 'legend-sum' }, `Dodatni zapas modelowy na ${pos} obliczonego obszaru`, st.noData ? ` (brak danych: ${Math.round(100 * st.noDataShare)}% — nie wliczony).` : '.'),
      opacity,
      h('details', { class: 'legend-details' }, h('summary', {}, 'Informacje o warstwie'), h('small', { class: 'muted' }, `Przerywany okrąg — granica analizy (${area.mode === 'local' ? 'okolica punktu 1 km' : `${area.radiusKm} km wokół nadajnika`}); poza nim: nie obliczono. Dotknij mapy, aby odczytać wartość. Teren: siatka ~${area.demResolutionM} m, krok ${Math.round(area.stepKm * 1000)} m, ${area.rays} promieni${area.model === 'p1812' ? `, klutter: ${area.clutter}` : ''}.${area.meta?.failedTiles ? ` Brak ${area.meta.failedTiles}/${area.meta.totalTiles} kafli terenu.` : ''}${area.antStatus !== 'ok' ? ' Brak charakterystyki anteny — przyjęto dookólną.' : ''}`))));
}
// Panel „Zasięg”: obszar, promień, widok, Oblicz / postęp / Anuluj.
let covModal = null;
function openCoverage(){
  if (!analysis && !(point && curTx() && S.muxKey)){ announce('Najpierw ustaw punkt i wybierz nadajnik.', { kind: 'warn' }); return; }
  const body = h('div', { class: 'coverage-panel' });
  covModal = openModal({ title: 'Zasięg', body, onClose: () => { covModal = null; } });
  covModal.bodyEl = body; renderCoverageModal();
}

function renderCoverageModal(){
  if (!covModal?.bodyEl) return;
  const job = jobs.get('area'), tx = curTx(), m = tx && S.muxKey ? tx.muxes.find(x => x.key === S.muxKey) : null;
  const busy = !!job || areaAttempt?.state === 'preparing';
  const key = JSON.stringify([S.areaMode, S.areaRadius, S.areaView, job?.id, areaAttempt, area?.key, area?.stats?.positiveShare]);
  // Postęp nie przebudowuje formularza: zachowujemy fokus, rozwinięcia i pozycję przewijania.
  if (covModal.renderKey === key){
    const bar = covModal.bodyEl.querySelector('progress'), text = covModal.bodyEl.querySelector('.cov-progress-text');
    if (bar) bar.value = job?.progress || 0;
    if (text) text.textContent = job?.progressText || 'Przygotowuję dane…';
    return;
  }
  covModal.renderKey = key;
  const detailsOpen = covModal.bodyEl.querySelector('details')?.open;
  const previousFocus = document.activeElement?.id;
  const radio = (name, val, cur, label, on) => h('label', { class: 'check' }, h('input', { type: 'radio', name, value: val, checked: cur === val, onchange: on, disabled: busy && name === 'cov-area' ? true : null }), ' ', label);
  const selectedRadius = S.areaMode === 'local' ? 1 : S.areaRadius;
  const same = area && area.mode === S.areaMode && area.radiusKm === selectedRadius;
  const resultText = area ? `Na mapie: ${areaDescription(area.mode, area.radiusKm)}. Dodatni zapas modelowy na ${Math.round(100 * (area.stats.positiveShare ?? 0))}% obliczonego obszaru.` : null;
  let attemptText = null;
  if (areaAttempt?.state === 'cancelled') attemptText = `Anulowano obliczenie: ${areaDescription(areaAttempt.mode, areaAttempt.radius)}.${area ? ' Zachowano poprzednią mapę.' : ' Mapa nie została obliczona.'}`;
  if (areaAttempt?.state === 'error') attemptText = `Nie udało się obliczyć: ${areaDescription(areaAttempt.mode, areaAttempt.radius)}.${area ? ' Zachowano poprzednią mapę.' : ''}`;
  setChildren(covModal.bodyEl,
    h('p', { class: 'muted' }, m ? `${m.name} K${m.channel ?? '?'} · ${tx.name} · ${(MODELS[S.model] || MODELS.simple).short}` : 'Brak emisji dla wybranego MUX-a.'),
    h('fieldset', { class: 'field' }, h('legend', {}, 'Obszar'),
      radio('cov-area', 'area', S.areaMode, 'Wokół nadajnika', () => { S.areaMode = 'area'; save(); renderCoverageModal(); }),
      radio('cov-area', 'local', S.areaMode, 'Okolica punktu — 1 km', () => { S.areaMode = 'local'; save(); renderCoverageModal(); })),
    S.areaMode === 'local' ? h('p', { class: 'muted' }, 'Liczony obszar: koło o promieniu 1 km wokół punktu instalacji.') : h('fieldset', { class: 'field' }, h('legend', {}, 'Promień wokół nadajnika'),
      h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Promień obszaru' }, [30, 60, 100].map(r => h('button', { type: 'button', role: 'radio', 'aria-checked': S.areaRadius === r, disabled: busy ? true : null, onclick: () => { S.areaRadius = r; save(); renderCoverageModal(); } }, S.areaRadius === r ? '✓ ' : '', `${r} km`)))),
    h('details', { class: 'advanced', open: detailsOpen || null }, h('summary', {}, 'Sposób kolorowania'), h('fieldset', { class: 'field' }, h('legend', {}, 'Widok'),
      radio('cov-view', 'field', S.areaView, 'Natężenie pola [dBµV/m]', () => setAreaView('field')),
      radio('cov-view', 'margin', S.areaView, 'Zapas odbioru [dB]', () => setAreaView('margin')))),
    busy ? h('div', { class: 'cov-progress', role: 'status' }, h('strong', {}, `Obliczam: ${areaDescription(areaAttempt?.mode || S.areaMode, areaAttempt?.radius || selectedRadius)}`), h('progress', { max: 1, value: job?.progress || 0, 'aria-label': 'Postęp obliczeń' }), h('small', { class: 'cov-progress-text' }, job?.progressText || 'Przygotowuję dane…')) : null,
    attemptText ? h('p', { class: 'note warn', role: 'status', id: 'cov-attempt-status' }, attemptText) : null,
    resultText ? h('p', { class: 'note', id: 'cov-result-status' }, resultText, !same ? h('strong', { class: 'coverage-pending' }, ' Wybrane ustawienia dotyczą innego obszaru — naciśnij „Oblicz”, aby go wyświetlić.') : null) : null,
    h('div', { class: 'row' },
      btn('Oblicz', { kind: 'primary', iconName: 'map', attrs: { id: 'btn-cov-run', disabled: busy ? true : null }, onclick: () => runArea() }),
      btn('Anuluj', { kind: 'secondary', iconName: 'stop', attrs: { id: 'btn-cov-cancel', disabled: busy ? null : true }, onclick: cancelArea })));
  if (previousFocus){ const el = document.getElementById(previousFocus); if (el && covModal.bodyEl.contains(el) && !el.disabled) el.focus({ preventScroll: true }); }
}
// ---------- Zadania / postęp ----------

function renderJobs(){
  if (covModal) queueMicrotask(renderCoverageModal);
  const el = $('#jobs'); if (!el) return;
  const list = jobs.list().sort((a, b) => ({ area: 0, point: 1, scan: 2 }[a.kind] ?? 3) - ({ area: 0, point: 1, scan: 2 }[b.kind] ?? 3));
  el.hidden = !list.length;
  const j = list[0];
  setChildren(el, j ? h('div', { class: 'job', role: 'status' },
    h('span', { class: 'job-spin', 'aria-hidden': 'true' }),
    h('span', { class: 'job-text', title: list.map(x => `${x.label}: ${x.progressText || 'Start…'}`).join('\n') },
      h('strong', {}, `${j.label} · ${Math.round(100 * j.progress)}%`),
      h('small', {}, `${j.progressText || 'Przygotowuję dane…'}${list.length > 1 ? ` · inne zadania: ${list.length - 1}` : ''}`)),
    h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Przerwij: ' + j.label, onclick: () => j.kind === 'area' ? cancelArea() : j.cancel() }, icon('x', 16))) : null);
}
const marginBandOf = m => { let b = MARGIN_BANDS[0]; for (const x of MARGIN_BANDS) if (m >= x.min) b = x; return b; };
const STATUS_TEXT = { ok: null, weak: 'sprawdzony — słaby wynik', nodata: 'brak danych', unknown: 'jeszcze niesprawdzony' };
const VIS_TEXT = { clear: 'pełna widoczność', fresnel: 'Fresnel przysłonięty', blocked: 'za przeszkodą' };

// ---------- Panel wyniku ----------
// Nagłówek (stały): emisja, wynik, azymut, polaryzacja, Zasięg / Ustaw antenę, Rozwiń/Zwiń. Treść (przewijana): sekcje.
function setSheetPos(pos, { persist = true } = {}){
  if (!['collapsed', 'summary', 'expanded'].includes(pos)) pos = 'summary';
  sheetEl.dataset.pos = pos; document.body.dataset.sheet = pos; if (persist){ S.sheetPos = pos; save(); }
  const t = $('#btn-sheet-expand');
  if (t){ t.setAttribute('aria-expanded', pos === 'expanded'); t.querySelector('span').textContent = pos === 'expanded' ? 'Zwiń' : 'Szczegóły'; t.replaceChild(icon(pos === 'expanded' ? 'chevronDown' : 'chevronUp', 20), t.querySelector('svg')); }
  handleEl.setAttribute('aria-label', pos === 'collapsed' ? 'Pokaż panel wyniku' : 'Zwiń panel wyniku');
  handleEl.setAttribute('aria-expanded', pos !== 'collapsed');
  requestAnimationFrame(() => { syncSheetH(); updateScrollHint(); });
}
function syncSheetH(){ document.documentElement.style.setProperty('--sheet-h', `${Math.round(sheetEl.getBoundingClientRect().height)}px`); }
function renderSheet(extra = {}){
  updateCompassFab(compass.snapshot());
  const headEl = $('#sheet-head'), el = $('#sheet-body');
  sheetEl.classList.toggle('has-point', !!point);
  const tx = curTx();
  const expandBtn = () => h('button', { type: 'button', id: 'btn-sheet-expand', class: 'btn btn-tertiary btn-sm sheet-expand', 'aria-expanded': String(sheetEl.dataset.pos === 'expanded'), 'aria-controls': 'sheet-body',
    onclick: () => setSheetPos(sheetEl.dataset.pos === 'expanded' ? 'summary' : 'expanded') }, icon(sheetEl.dataset.pos === 'expanded' ? 'chevronDown' : 'chevronUp', 20), h('span', {}, sheetEl.dataset.pos === 'expanded' ? 'Zwiń' : 'Szczegóły'));
  if (!point){
    setChildren(headEl, h('div', { class: 'empty' }, h('h2', {}, 'Gdzie montujesz antenę?'),
      h('p', {}, 'Przytrzymaj mapę, aby ustawić punkt — albo wyszukaj adres lub użyj GPS.'),
      h('div', { class: 'row' }, btn('Moja lokalizacja', { kind: 'primary', iconName: 'locate', onclick: locate }), btn('Wpisz adres lub współrzędne', { iconName: 'pin', onclick: openLocation }))));
    setChildren(el); return;
  }
  const a = analysis, m = tx && S.muxKey ? tx.muxes.find(x => x.key === S.muxKey) : null;
  const rec = scan?.done ? scan.recommended : null;
  const r0 = analysis?.res, okBand = r0?.ok ? r0.band : null;
  const emission = h('button', { type: 'button', class: 'tx-line', onclick: () => showTab('tx'), 'aria-label': `Nadajnik ${tx?.name || 'brak'}, ${S.muxType}${okBand ? `, ${okBand.label}` : ''}. Zmień nadajnik` },
    okBand ? h('span', { class: `sw sw-${okBand.pattern} tx-dot`, style: { background: okBand.color }, 'aria-hidden': 'true' }) : icon('tower'),
    h('span', {}, h('strong', {}, tx ? tx.name : 'Brak nadajnika', rec?.txId === tx?.id ? h('span', { class: 'chip chip-rec' }, '★ Polecany') : null),
      h('small', {}, m ? `${okBand ? okBand.label + ' · ' : ''}${fmt.km(distanceKm(point, tx))} · kanał ${m.channel ?? '?'}` : `${S.muxType}: brak emisji`)), icon('chevronRight'));
  const r = a?.res;
  let verdict;
  if (extra.error) verdict = h('div', { class: 'note warn', role: 'alert' }, h('strong', {}, extra.missingMux ? `Brak ${S.muxType} na tym nadajniku` : 'Nie można policzyć wyniku'), h('p', {}, extra.error),
    extra.missingMux ? h('div', { class: 'row' }, btn('Wybierz nadajnik', { kind: 'primary', iconName: 'tower', small: true, onclick: () => showTab('tx') }), btn('Zmień MUX', { iconName: 'list', small: true, onclick: openMuxPicker }))
      : btn('Spróbuj ponownie', { iconName: 'refresh', small: true, onclick: runPoint }));
  else if (!a) verdict = h('p', { class: 'muted verdict-wait', role: 'status' }, tx ? 'Liczę profil terenu i poziom sygnału…' : 'Brak nadajników w bazie.');
  else verdict = r.ok ? null : h('div', { class: 'note warn' }, r.reason); // ocena jest w linii nadajnika (kolor + słowo), liczby w „Szczegóły”
  const azpol = a ? h('div', { class: 'big-az' }, h('div', {}, h('strong', {}, `${Math.round(a.az)}°`), h('small', {}, `kierunek ${compassPoint(a.az)}`)),
    h('div', {}, h('strong', {}, a.mux.polarization || '—'), h('small', {}, 'polaryzacja'))) : null;
  const actions = h('div', { class: 'head-actions' },
    btn('Zasięg', { kind: 'secondary', iconName: 'map', attrs: { id: 'btn-coverage', disabled: m ? null : true }, onclick: openCoverage }),
    btn('Ustaw antenę', { kind: 'primary', iconName: 'compass', attrs: { id: 'btn-aim', disabled: a ? null : true }, onclick: openAim }));
  const recBtn = rec && rec.txId !== tx?.id ? h('button', { type: 'button', class: 'btn btn-tertiary btn-sm rec-switch', onclick: () => chooseTx(rec.txId, rec.muxKey) }, icon('star', 18), h('span', {}, `Polecany ${S.muxType}: ${rec.name} (${fmt.db(rec.marginDb)}) — wybierz`)) : null;
  setChildren(headEl, emission, verdict, azpol, actions, h('div', { class: 'head-foot' }, recBtn, expandBtn()));

  // ---- Treść przewijana ----
  const sec = (id, title, ...c) => h('section', { class: 'sheet-sec', 'aria-labelledby': `sec-${id}` }, h('h3', { id: `sec-${id}` }, title), ...c);
  const kv = (k, v, hint) => h('div', { class: 'kv row-kv' }, h('span', {}, k), h('strong', {}, v), hint ? h('small', {}, hint) : null);
  const height = h('label', { class: 'field inline' }, h('span', {}, 'Wysokość anteny odbiorczej'), h('span', { class: 'stepper' },
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zmniejsz wysokość', onclick: () => setRxHeight(S.rxHeightM - 1) }, '−'),
    h('input', { type: 'number', min: 1, max: 100, step: 1, value: S.rxHeightM, inputmode: 'numeric', 'aria-label': 'Wysokość anteny nad gruntem w metrach', onchange: e => setRxHeight(+e.target.value) }),
    h('span', {}, 'm n.p.t.'),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Zwiększ wysokość', onclick: () => setRxHeight(S.rxHeightM + 1) }, '+')));
  const install = sec('inst', 'Instalacja',
    h('div', { class: 'kv row-kv' }, h('span', {}, point.label || 'Punkt instalacji'), h('strong', { class: 'mono' }, `${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`), point.accuracyM ? h('small', {}, `±${Math.round(point.accuracyM)} m`) : null),
    h('div', { class: 'row' }, btn('Zmień lokalizację', { iconName: 'pin', small: true, attrs: { id: 'btn-location' }, onclick: openLocation }), btn('Zmień MUX', { iconName: 'list', small: true, onclick: openMuxPicker })),
    height,
    kv('Antena / kabel', `${fmt.db(m && m.frequencyMHz < 300 ? S.rx.gainVhfDbi : S.rx.gainUhfDbi, 'dBi')} · −${fmt.db(S.rx.cableLossDb)}`, SYSTEM_PRESETS[S.rx.preset].label),
    btn('Zapisz instalację', { iconName: 'save', attrs: { disabled: a ? null : true }, onclick: saveInstallation }));
  if (!a){ setChildren(el, install); applyPos(); return; }
  const missing = a.sources?.missing || [];
  const result = sec('wynik', 'Wynik',
    h('div', { class: 'kv-list' },
      kv('Ocena odbioru', r.ok ? r.band.label : '—'),
      kv('Kierunek anteny', `${Math.round(a.az)}° (${compassPoint(a.az)})`),
      kv('Polaryzacja', POLARIZATION_TEXT[a.mux.polarization] || a.mux.polarization || '—'),
      kv('Odległość', fmt.km(a.path.distanceKm)),
      kv('Widoczność', { clear: 'Pełna', fresnel: 'Częściowo przysłonięta', blocked: 'Za przeszkodą' }[a.path.status])),
    h('details', { class: 'advanced', id: 'res-tech' }, h('summary', {}, 'Szczegóły techniczne'), h('div', { class: 'kv-list' },
      kv('Natężenie pola', r.ok ? fmt.db(r.fieldDbuvm, 'dBµV/m') : '—', a.sources?.model),
      kv('Wymagane minimum', fmt.db(r.eMin ?? minFieldStrength(a.params.freqMHz, S.rx).eMin, 'dBµV/m')),
      kv('Zapas', r.ok ? fmt.db(r.marginDb) : '—'),
      kv('Poziom na odbiorniku', r.ok ? fmt.db(r.rxLevelDbuv, 'dBµV') : '—', `zysk ${fmt.db(r.gainDbi, 'dBi')}, kabel −${fmt.db(S.rx.cableLossDb)}`),
      kv('Widoczność (technicznie)', { clear: 'Pełna (60% F1 wolne)', fresnel: 'LOS, strefa Fresnela przysłonięta', blocked: 'Brak — przeszkoda' }[a.path.status]))),
    missing.length ? h('div', { class: 'note warn data-missing', role: 'note' }, h('strong', {}, 'Braki danych w tym wyniku'), h('ul', {}, missing.map(t => h('li', {}, t)))) : null);
  const cv = h('canvas', { class: 'profile mini', role: 'img', 'aria-label': `Profil terenu ${fmt.km(a.path.distanceKm)}; ${a.path.status === 'blocked' ? 'linia widzenia zasłonięta' : 'linia widzenia wolna'}` });
  const prof = sec('prof', 'Profil terenu', h('div', { class: 'chart-wrap' }, cv),
    h('small', { class: 'muted' }, `Najmniejszy prześwit ${fmt.m(a.path.minClearanceM)} w ${fmt.km(a.path.minClearanceKm)} od punktu`),
    btn('Parametry i analiza trasy', { iconName: 'activity', small: true, onclick: openDetails }));
  const data = sec('dane', 'Dane obliczeń',
    h('div', { class: 'kv-list' },
      kv('Model', (MODELS[a.params.model] || MODELS.simple).short),
      kv('Teren — źródło', a.sources?.terrain || '—'),
      kv('Teren — krok próbkowania', `${Math.round(a.profile.spacingM)} m`),
      a.params.model === 'p1812' ? kv('Pokrycie terenu', a.sources?.cover || '—') : null,
      kv('Antena nadawcza', a.ant.status === 'ok' ? `charakterystyka ANT: ${fmt.db(r.antRelDb)} w kier. ${Math.round(a.azTxToRx)}°` : `BRAK ANT — ${a.ant.note}`)),
    h('p', { class: 'fineprint model-line', 'data-model': a.params.model }, a.params.model === 'p1812' ? 'Wynik modelowy dla 50% czasu i 50% lokalizacji.' : MODELS.simple.label + '.', ' Potwierdź miernikiem.'),
    a.sources?.notes?.length ? h('p', { class: 'fineprint warn-text' }, a.sources.notes.join(' ')) : null,
    h('p', { class: 'fineprint' }, `Algorytm ${ALGO_VERSION} · dane ${a.params.dataVersion || '—'}`));
  setChildren(el, sheetTabs([['wynik', 'Wynik', result], ['inst', 'Instalacja', install], ['prof', 'Teren', prof], ['dane', 'Dane', data]]), result, install, prof, data, h('div', { class: 'scroll-end', 'aria-hidden': 'true' }));
  showSheetTab(sheetTab);
  applyPos();
  requestAnimationFrame(() => { if (cv.isConnected) drawProfile(cv, a.path); });
}
// Zakładki w rozwiniętym panelu: jedna treść naraz, jedno przewijanie (bez zagnieżdżonych list).
let sheetTab = 'wynik';
function sheetTabs(list){
  return h('div', { class: 'sheet-tabs', role: 'tablist', 'aria-label': 'Szczegóły wyniku' }, list.map(([id, label, sec]) => { sec.dataset.tab = id; sec.id = 'tabp-' + id;
    return h('button', { type: 'button', role: 'tab', 'data-tab': id, 'aria-controls': 'tabp-' + id, onclick: () => showSheetTab(id) }, label); }));
}
function showSheetTab(id){
  const el = $('#sheet-body'); if (!el.querySelector(`.sheet-sec[data-tab="${id}"]`)) id = 'wynik';
  sheetTab = id;
  for (const s of el.querySelectorAll('.sheet-sec[data-tab]')) s.hidden = s.dataset.tab !== id;
  for (const b of el.querySelectorAll('.sheet-tabs [role=tab]')) b.setAttribute('aria-selected', b.dataset.tab === id);
  el.scrollTop = 0; requestAnimationFrame(updateScrollHint);
  if (id === 'prof' && analysis) requestAnimationFrame(() => { const cv = el.querySelector('canvas.profile'); if (cv) drawProfile(cv, analysis.path); });
}
/** Wyraźny znak, że da się przewinąć: cień/„przewiń ↓” na dole, gdy treść jest dłuższa niż panel. */
function updateScrollHint(){
  const el = $('#sheet-body'); if (!el) return;
  sheetEl.classList.toggle('can-scroll', el.scrollHeight - el.clientHeight - el.scrollTop > 8);
}
$('#sheet-body').addEventListener('scroll', updateScrollHint, { passive: true });
addEventListener('resize', () => requestAnimationFrame(updateScrollHint));
function applyPos(){ if (!sheetEl.dataset.pos) setSheetPos(S.sheetPos, { persist: false }); else requestAnimationFrame(syncSheetH); }
let rxT = 0;
function setRxHeight(v){
  v = Math.max(1, Math.min(100, Math.round(v) || 10)); if (v === S.rxHeightM) return; S.rxHeightM = v; save();
  for (const inp of document.querySelectorAll('.stepper input')) inp.value = v;
  // Szybkie klikanie +/− — liczymy dopiero po chwili (poprzednie obliczenia są anulowane przez menedżera zadań).
  clearTimeout(rxT); rxT = setTimeout(() => { clearArea(); runPoint(); }, 350);
}

// ---------- Ustaw antenę (kompas) ----------
let aimModal = null;
function openAim(){
  if (!analysis){ announce(point ? 'Poczekaj na wynik analizy punktu.' : 'Najpierw wskaż punkt instalacji na mapie.', { kind: 'warn' }); return; }
  const target = analysis.az;
  const dial = h('div', { class: 'dial', 'aria-hidden': 'true' }, h('div', { class: 'dial-rose' }, ['N', 'E', 'S', 'W'].map((t, i) => h('span', { class: `rose-${i}` }, t))), h('div', { class: 'dial-target' }), h('div', { class: 'dial-needle' }));
  const calHint = h('div', { class: 'note warn cal-hint', hidden: true }, h('strong', {}, 'Skalibruj kompas'), h('p', {}, 'Zatocz telefonem kilka razy „ósemkę” w powietrzu, z dala od metalu i magnesów.'));
  const src = h('small', { class: 'muted' });
  const state = h('p', { class: 'muted', role: 'status' }), instr = h('p', { class: 'instruction', 'aria-live': 'polite' });
  const manual = h('input', { type: 'range', min: 0, max: 359, value: Math.round(target), 'aria-label': 'Kierunek ręczny w stopniach', oninput: e => compass.setManual(true, +e.target.value) });
  const body = h('div', { class: 'aim' },
    h('div', { class: 'aim-target' }, h('small', {}, 'Cel'), h('strong', {}, `${Math.round(target)}° ${compassPoint(target)}`), h('span', {}, `${analysis.tx.name} · ${fmt.km(analysis.path.distanceKm)}`)),
    dial, instr, state, calHint, src,
    h('div', { class: 'row' }, btn('Włącz kompas', { kind: 'primary', iconName: 'compass', onclick: () => compass.start() }), btn('Tryb ręczny', { onclick: () => compass.setManual(true, +manual.value) })),
    h('label', { class: 'field' }, h('span', {}, 'Kierunek ręczny / z busoli'), manual),
    h('details', {}, h('summary', {}, 'Kalibracja'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.calib.invert, onchange: e => { S.calib.invert = e.target.checked; save(); } }), ' Odwróć kierunek czujnika'),
      h('label', { class: 'field' }, h('span', {}, compass.source === 'native' ? 'Dodatkowa poprawka [°] (deklinacja liczona automatycznie)' : 'Poprawka [°] (np. deklinacja ok. +6° w Polsce)'), h('input', { type: 'number', step: 1, value: S.calib.offset, onchange: e => { S.calib.offset = +e.target.value || 0; save(); } }))),
    h('p', { class: 'fineprint' }, 'Kompas telefonu bywa zakłócony przez metal i magnesy (maszt, rynna, antena). Odsuń telefon od konstrukcji i potwierdź kierunek wizualnie lub busolą.'));
  let refs = { dial, state, instr };
  function updateAim(s){
    if (!refs) return;
    refs.state.textContent = COMPASS_TEXT[s.state] + (s.accuracy != null ? ` (dokładność ±${Math.round(s.accuracy)}°)` : '');
    const t = turnInstruction(s.heading, target, s.accuracy, s.state);
    refs.instr.textContent = t.text; refs.instr.dataset.aligned = t.aligned;
    const hd = s.heading ?? 0;
    refs.dial.style.setProperty('--rose', `${-hd}deg`); refs.dial.style.setProperty('--target', `${normDeg(target - hd)}deg`);
    refs.dial.dataset.live = s.heading != null;
    calHint.hidden = !s.needsCalibration;
    src.textContent = s.source === 'native' ? `Źródło: czujnik orientacji Android (kierunek geograficzny${s.declination != null ? `, deklinacja ${fmt.num(s.declination, 1)}°` : ''})` : 'Źródło: czujnik orientacji przeglądarki';
  }
  let unsub = null;
  aimModal = openModal({ title: 'Ustaw antenę', body, full: true, onClose: () => { unsub?.(); refs = null; aimModal = null; } });
  unsub = compass.subscribe(updateAim);
  if (!compass.isRunning() && !compass.needsGesture()) compass.start();
}

// ---------- Szczegóły trasy ----------
function openDetails(){
  const a = analysis; if (!a) return;
  const cv = h('canvas', { class: 'profile', role: 'img', 'aria-label': `Profil terenu ${fmt.km(a.path.distanceKm)}; ${a.path.status === 'blocked' ? 'linia widzenia zasłonięta' : 'linia widzenia wolna'}` });
  const p = a.params, r = a.res, path = a.path;
  const row = (k, v) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v));
  const min = minFieldStrength(p.freqMHz, S.rx);
  const body = h('div', {},
    h('div', { class: 'chart-wrap' }, cv),
    h('div', { class: 'chart-legend' }, ['Teren + krzywizna Ziemi (k=4/3)', 'Linia widzenia', '60% strefy Fresnela', 'Przeszkoda główna'].map((t, i) => h('span', { class: `cl cl-${i}` }, t))),
    h('h3', {}, 'Emisja'), h('table', { class: 'kv-table' }, h('tbody', {},
      row('Nadajnik', a.tx.name), row('MUX / kanał', `${a.mux.name} / K${a.mux.channel ?? '?'}`),
      row('Częstotliwość', `${fmt.num(p.freqMHz, 1)} MHz (${a.mux.freqSource})`), row('Moc ERP', `${fmt.num(p.erpKw, 3)} kW`),
      row('Wysokość anteny nadawczej', `${fmt.m(p.txHeightM)} n.p.t. — ${p.heightSource}`),
      row('Teren nadajnika', `${fmt.m(path.txGround)} n.p.m. (${Number.isFinite(p.txGroundM) ? 'baza' : 'model terenu'})`),
      row('Charakterystyka anteny', `${fmt.db(r.antRelDb)} w kierunku ${Math.round(a.azTxToRx)}° — ${a.ant.note}`),
      row('Polaryzacja', POLARIZATION_TEXT[a.mux.polarization] || 'brak danych'))),
    h('h3', {}, 'Trasa'), h('table', { class: 'kv-table' }, h('tbody', {},
      row('Odległość', fmt.km(path.distanceKm)), row('Teren w punkcie', `${fmt.m(path.rxGround)} n.p.m.`),
      row('Antena odbiorcza', `${fmt.m(p.rxHeightM)} n.p.t. (${fmt.m(path.rxAlt)} n.p.m.)`),
      row('Najmniejszy prześwit', `${fmt.m(path.minClearanceM)} w ${fmt.km(path.minClearanceKm)} od punktu`),
      row('Strefa Fresnela (min. wolna część F1)', `${Math.round(100 * Math.max(-9.99, path.minFresnelRatio))}% (kryterium ≥ 60%)`),
      a.prop ? row('Tłumienność podstawowa Lb (ITU-R P.1812)', `${fmt.db(a.prop.lbBase)} (wolna przestrzeń ${fmt.db(a.prop.Lbfs)}, dyfrakcja ${fmt.db(a.prop.Ld)}, troposcatter Lbs ${fmt.db(a.prop.Lbs)}; trasa ${a.prop.pathtype === 'los' ? 'LOS' : 'pozahoryzontowa'})`) : null,
      a.prop ? row('Klutter przy odbiorniku (ITU-R P.2108 §3.1)', a.prop.rxCover ? `${a.prop.rxCover.label} (CLC ${a.prop.rxCover.code}, R = ${a.prop.rxCover.R} m) → ${fmt.db(a.prop.rxClutterLossDb)}` : 'brak danych / teren otwarty → 0 dB') : null,
      row(a.prop ? 'Straty dyfrakcyjne Deygout (porównawczo, model uproszczony)' : 'Straty dyfrakcyjne (Deygout, ITU-R P.526)', fmt.db(path.diffractionLossDb)),
      path.obstacle ? row('Przeszkoda główna', `${fmt.km(path.obstacle.distFromRxKm)} od punktu, teren ${fmt.m(path.obstacle.groundM)} n.p.m.`) : null)),
    h('h3', {}, 'Bilans'), h('table', { class: 'kv-table' }, h('tbody', {},
      row('Natężenie pola E', r.ok ? fmt.db(r.fieldDbuvm, 'dBµV/m') : '—'),
      row('Wymagane minimum E_min', `${fmt.db(min.eMin, 'dBµV/m')} (${min.preset.label}, C/N ${fmt.num(min.preset.cnDb)} + ${min.preset.implDb} dB, NF ${S.rx.noiseFigureDb} dB)`),
      row('Zapas', r.ok ? fmt.db(r.marginDb) : '—'),
      row('Moc na wejściu odbiornika', r.ok ? `${fmt.db(r.rxPowerDbm, 'dBm')} = ${fmt.db(r.rxLevelDbuv, 'dBµV')} (75 Ω)` : '—'))),
    h('h3', {}, 'Model i dane'), h('table', { class: 'kv-table' }, h('tbody', {},
      row('Model propagacji', (MODELS[p.model] || MODELS.simple).label), row('Teren', a.sources?.terrainSource || DEM_SOURCE),
      p.model === 'p1812' ? row('Pokrycie terenu (klutter)', a.sources?.coverSource ? `${a.sources.coverSource}; wysokości R: zabudowa 10–20 m, las 15 m; bez klutteru ${TERMINAL_CLEAR_M} m przy końcach trasy` : 'brak — teren goły') : null,
      p.model === 'p1812' ? row('Parametry P.1812', `p = ${P1812_DEFAULTS.p}% czasu, pL = ${P1812_DEFAULTS.pL}% lokalizacji, ΔN = ${P1812_DEFAULTS.DN}, N0 = ${P1812_DEFAULTS.N0} (stałe dla Polski), strefa: ląd${a.prop?.sigmaLocDb ? `; σL ≈ ${fmt.num(a.prop.sigmaLocDb, 1)} dB` : ''}`) : null,
      a.sources?.notes?.length ? row('Uwagi', a.sources.notes.join(' ')) : null)),
    h('details', {}, h('summary', {}, 'Wzory i założenia'),
      p.model === 'p1812' ? h('p', {}, 'P.1812: E = 199,36 + 20·log f[GHz] − Lb + 10·log ERP[kW] + G_ant − L_klutter(P.2108); Lb łączy wolną przestrzeń, dyfrakcję delta-Bullington (teren + klutter), propagację anomalną i troposcatter.') : null,
      h('p', {}, (p.model === 'p1812' ? 'Model uproszczony (porównawczo): ' : '') + 'E = 106,92 + 10·log ERP[kW] + G_ant − 20·log d[km] − L_dyfr; P[dBm] = E + G[dBi] − 20·log f[MHz] − 77,2 − L_kabla; U[dBµV] = P + 108,75.'),
      h('p', {}, `Krzywizna Ziemi k = ${fmt.num(K_FACTOR, 3)}; ${DEM_SOURCE}; próbkowanie profilu co ${Math.round(a.profile.spacingM)} m.`),
      h('p', {}, p.model === 'p1812' ? 'Budynki i las uwzględnione statystycznie (klasy CORINE), nie jako konkretne obiekty. Bez odbić wielodrogowych i zakłóceń od innych nadajników (SFN/sąsiednie kanały).' : 'Model nie uwzględnia budynków, lasu, odbić, zakłóceń od innych nadajników (SFN/sąsiednie kanały) ani zmienności czasowej propagacji.')),
    h('p', { class: 'fineprint' }, `Algorytm ${ALGO_VERSION} · dane ${p.dataVersion || '—'}`),
    h('div', { class: 'row' }, btn('Eksportuj wynik (JSON)', { iconName: 'download', onclick: exportResult })));
  openModal({ title: 'Parametry i analiza trasy', body, full: true });
  requestAnimationFrame(() => drawProfile(cv, path));
}
function exportResult(){
  const a = analysis; if (!a) return;
  const out = { format: 'dvbt-point-result', format_version: RESULT_FORMAT_VERSION, app_version: APP_VERSION, algo_version: ALGO_VERSION, created_at: new Date().toISOString(), params: a.params,
    result: { azimuth_deg: a.az, distance_km: a.path.distanceKm, status: a.path.status, diffraction_loss_db: a.path.diffractionLossDb, field_dbuvm: a.res.fieldDbuvm, e_min_dbuvm: a.res.eMin, margin_db: a.res.marginDb, rx_level_dbuv: a.res.rxLevelDbuv, ant_rel_db: a.res.antRelDb, ant_status: a.ant.status,
      model: a.params.model, model_label: (MODELS[a.params.model] || MODELS.simple).label, terrain_source: a.sources?.terrainSource, cover_source: a.sources?.coverSource || null, notes: a.sources?.notes || [],
      p1812: a.prop ? { lb_db: a.prop.lbBase, lbfs_db: a.prop.Lbfs, ld_db: a.prop.Ld, lbs_db: a.prop.Lbs, rx_clutter_loss_db: a.prop.rxClutterLossDb, rx_cover: a.prop.rxCover, p_time: P1812_DEFAULTS.p, p_loc: P1812_DEFAULTS.pL, dn: P1812_DEFAULTS.DN, n0: P1812_DEFAULTS.N0 } : null } };
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const link = h('a', { href: URL.createObjectURL(blob), download: `dvbt-wynik-${Date.now()}.json` }); document.body.append(link); link.click(); link.remove();
}

// ---------- Instalacje ----------
async function saveInstallation(){
  if (!analysis) return;
  const name = h('input', { class: 'input', value: point.label && point.source !== 'mapa' ? point.label.slice(0, 60) : '', placeholder: 'np. Kowalski, ul. Leśna 5', autofocus: true, 'aria-label': 'Nazwa instalacji' });
  const note = h('textarea', { class: 'input', rows: 2, placeholder: 'Notatka (opcjonalnie)', 'aria-label': 'Notatka' });
  const offline = h('input', { type: 'checkbox', checked: true });
  const m = openModal({ title: 'Zapisz instalację', body: h('div', {}, h('label', { class: 'field' }, h('span', {}, 'Nazwa'), name), h('label', { class: 'field' }, h('span', {}, 'Notatka'), note), h('label', { class: 'check' }, offline, ' Zapisz do pracy offline (wynik + teren na urządzeniu)')),
    actions: [btn('Anuluj', { kind: 'tertiary', onclick: () => m.close() }), btn('Zapisz', { kind: 'primary', iconName: 'save', onclick: async () => {
      const a = analysis;
      const rec = { id: 'i' + Date.now().toString(36), name: name.value.trim() || `Instalacja ${fmt.date(Date.now())}`, note: note.value.trim(), createdAt: Date.now(), point: { ...point }, rxHeightM: S.rxHeightM, txId: a.tx.id, muxKey: a.mux.key, muxType: a.mux.name, rx: { ...S.rx },
        summary: { band: a.res.band?.id, marginDb: a.res.marginDb, az: a.az, txName: a.tx.name, mux: a.mux.name, distanceKm: a.path.distanceKm }, resultKey: a.key, offline: offline.checked, appVersion: APP_VERSION, algoVersion: ALGO_VERSION, dataVersion: DB.meta?.dataVersion };
      if (offline.checked){ await store.putResult({ key: a.key, profile: { d: [...a.profile.d], e: [...a.profile.e], lats: a.profile.lats ? [...a.profile.lats] : null, lons: a.profile.lons ? [...a.profile.lons] : null, cover: a.profile.cover ? [...a.profile.cover] : null, spacingM: a.profile.spacingM, terrainId: a.profile.terrainId, source: a.profile.source, coverSource: a.profile.coverSource }, params: a.params }); await store.requestPersist(); }
      const list = store.loadInstallations(); list.unshift(rec);
      if (!store.saveInstallations(list)){ announce('Brak miejsca na zapis instalacji.', { kind: 'error' }); return; }
      m.close(); announce('Zapisano instalację.'); renderSaved();
    } })] });
}
async function openInstallation(rec){
  closeAllModals();
  manualTxFor = `${(+rec.point.lat).toFixed(4)},${(+rec.point.lon).toFixed(4)}`;
  S.rxHeightM = rec.rxHeightM; S.txId = rec.txId; S.muxKey = rec.muxKey; S.muxType = rec.muxType || String(rec.muxKey || '').split('|')[1] || S.muxType; updateMuxButton(); S.rx = { ...DEFAULT_RX, ...rec.rx }; save();
  if (rec.dataVersion && rec.dataVersion !== DB.meta?.dataVersion) announce('Baza nadajników zmieniła się od zapisu — wynik przeliczono na nowych danych.', { kind: 'warn' });
  if (rec.algoVersion !== ALGO_VERSION) announce('Zmienił się algorytm obliczeń — wynik przeliczono.', { kind: 'warn' });
  showTab('map');
  // Profil zapisany offline: odtwarzamy z IndexedDB, jeśli parametry są identyczne (klucz).
  const saved = rec.offline ? await store.getResult(rec.resultKey) : null;
  point = null; setPoint(rec.point, { silent: true });
  map.setView([rec.point.lat, rec.point.lon], 14);
  if (saved && !online()){
    const c = await currentParams();
    if (c?.p && rfKey(c.p) === rec.resultKey){
      jobs.get('point')?.cancel('odtworzono z zapisu');
      const path = analyzePath(buildPathInput(c.p, saved.profile));
      const az = azimuthDeg(point, c.tx), azTx = azimuthDeg(c.tx, point);
      const prop = c.p.model === 'p1812' && saved.profile.lats ? propFor(c.p, saved.profile) : null;
      const res = assessPoint({ path, erpKw: c.p.erpKw, antRelDb: antGainAt(c.ant.gains, azTx), antStatus: c.ant.status, rx: S.rx, prop });
      analysis = { key: rec.resultKey, sel: selKeyNow(), params: c.p, path, prop, meta: {}, sources: sourcesOf(c.p, saved.profile, c.ant), profile: saved.profile, res, ant: c.ant, az, azTxToRx: azTx, mux: c.em.mux, tx: c.tx, at: Date.now() };
      results.accept(rec.resultKey, rfKey(c.p), analysis); params = c.p; renderSheet();
    }
  }
}
function renderSaved(){
  const el = $('#tab-saved'); if (!el) return;
  const list = store.loadInstallations();
  const q = h('input', { type: 'search', class: 'input', placeholder: 'Szukaj instalacji', 'aria-label': 'Szukaj instalacji' });
  const ul = h('div', { class: 'list' });
  const draw = () => {
    const f = q.value.trim().toLowerCase();
    const items = list.filter(i => !f || `${i.name} ${i.note} ${i.summary?.txName}`.toLowerCase().includes(f));
    setChildren(ul, items.length ? items.map(i => {
      const band = MARGIN_BANDS.find(b => b.id === i.summary?.band);
      return h('div', { class: 'list-item' },
        h('button', { type: 'button', class: 'li-main', onclick: () => openInstallation(i) }, h('strong', {}, i.name), h('small', {}, `${i.summary?.txName || ''} · ${i.summary?.mux || ''} · ${Math.round(i.summary?.az ?? 0)}° · ${fmt.date(i.createdAt)}`),
          band ? h('span', { class: 'chip', style: { '--c': band.color } }, `${band.short} ${fmt.db(i.summary.marginDb)}`) : null, i.offline ? h('span', { class: 'chip' }, 'offline') : null),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Usuń ${i.name}`, onclick: () => { if (!confirm(`Usunąć „${i.name}”?`)) return; const all = store.loadInstallations().filter(x => x.id !== i.id); store.saveInstallations(all); if (i.resultKey && !all.some(x => x.resultKey === i.resultKey)) store.deleteResult(i.resultKey); renderSaved(); } }, icon('trash')));
    }) : h('p', { class: 'muted' }, list.length ? 'Brak wyników.' : 'Nie masz zapisanych instalacji. Po analizie punktu użyj „Zapisz instalację”.'));
  };
  q.addEventListener('input', draw);
  setChildren(el, h('h2', {}, 'Zapisane instalacje'), q, ul,
    h('div', { class: 'row' }, btn('Eksportuj wszystkie', { iconName: 'download', small: true, onclick: () => { const blob = new Blob([JSON.stringify({ format: 'dvbt-point-installations', format_version: RESULT_FORMAT_VERSION, items: store.loadInstallations() }, null, 2)], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: 'dvbt-instalacje.json' }); document.body.append(a); a.click(); a.remove(); } }),
      h('label', { class: 'btn btn-secondary btn-sm' }, icon('download'), h('span', {}, 'Importuj'), h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async e => { try { const j = JSON.parse(await e.target.files[0].text()); if (j.format !== 'dvbt-point-installations' || !Array.isArray(j.items)) throw 0; const cur = store.loadInstallations(); const ids = new Set(cur.map(x => x.id)); const add = j.items.filter(x => x && x.id && x.point && Number.isFinite(x.point.lat) && !ids.has(x.id)); store.saveInstallations([...add, ...cur]); announce(`Zaimportowano ${add.length} instalacji.`); renderSaved(); } catch { announce('Nieprawidłowy plik instalacji.', { kind: 'error' }); } } }))));
  draw();
}

// ---------- Zakładka Nadajnik (lista dla wybranego MUX-a) ----------
let txQuery = '';
function txRow(t, r, recId){
  const em = r?.muxKey ? t.muxes.find(x => x.key === r.muxKey) : emissionOfType(t, S.muxType);
  const state = r ? r.state : 'unknown';
  const d = point ? distanceKm(point, t) : null, az = point ? azimuthDeg(point, t) : null;
  const marginTxt = r && Number.isFinite(r.marginDb) ? `${r.bound ? '≤ ' : ''}${fmt.db(r.marginDb)}` : '—';
  const b = r && Number.isFinite(r.marginDb) ? marginBandOf(r.marginDb) : null;
  return h('button', { type: 'button', class: `list-item tx-item state-${state}${t.id === S.txId ? ' selected' : ''}${t.id === recId ? ' rec' : ''}`, 'aria-pressed': t.id === S.txId, 'data-tx': t.id,
    onclick: () => { chooseTx(t.id); announce(`Wybrano ${t.name} — ${S.muxType}.`, { toast: false }); } },
    h('span', { class: 'sel-mark', 'aria-hidden': 'true' }, t.id === S.txId ? '✓' : ''),
    h('span', { class: 'li-main' }, h('strong', {}, t.name, t.id === recId ? h('span', { class: 'chip chip-rec' }, '★ Polecany') : null),
      h('small', {}, em ? `K${em.channel ?? '?'}${em.variant ? ` · ${em.variant}` : ''}` : `brak ${S.muxType}`, d != null ? ` · ${fmt.km(d)} · ${Math.round(az)}°` : ''),
      STATUS_TEXT[state] ? h('small', { class: `st st-${state}` }, STATUS_TEXT[state], r?.reason ? ` (${r.reason})` : '') : r?.status ? h('small', { class: 'muted' }, VIS_TEXT[r.status] || '') : null),
    h('span', { class: 'li-margin', style: b ? { '--c': b.color } : null, title: 'Zapas modelowy' }, h('small', {}, 'zapas'), h('strong', {}, marginTxt)));
}
function renderTxTab(){
  const el = $('#tab-tx'); if (!el) return;
  const hadFocus = document.activeElement?.id === 'tx-search';
  const q = h('input', { type: 'search', id: 'tx-search', class: 'input', value: txQuery, placeholder: `Szukaj nadajnika ${S.muxType} (nazwa, miejscowość)`, 'aria-label': 'Szukaj nadajnika' });
  const ul = h('div', { class: 'list', id: 'tx-list' });
  const draw = () => {
    txQuery = q.value; const f = txQuery.trim().toLowerCase();
    const match = t => !f || `${t.name} ${t.location} ${t.site}`.toLowerCase().includes(f);
    const byId = new Map((scan?.muxType === S.muxType ? scan.results : []).map(r => [r.txId, r]));
    const recId = scan?.done ? scan.recommended?.txId : null;
    const emitting = DB.txs.filter(t => t.muxNames.includes(S.muxType));
    let items;
    if (f){
      // Wyszukiwanie: dowolny nadajnik tego MUX-a, niezależnie od limitu — wybór uruchamia pełną analizę punktu.
      items = emitting.filter(match);
      if (point) items.sort((x, y) => distanceKm(point, x) - distanceKm(point, y));
    } else if (point && scan && S.txFilter !== 'all'){
      const rows = S.txFilter === 'inRange' ? scan.results.filter(r => r.inRange) : scan.results;
      items = rows.map(r => DB.txs.find(t => t.id === r.txId)).filter(Boolean);
      // kandydaci w kolejce (jeszcze niesprawdzeni)
      if (S.txFilter === 'checked' && !scan.done) for (const c of scan.queue.slice(0, scan.total)) if (!byId.has(c.tx.id)) items.push(c.tx);
    } else {
      items = emitting.slice();
      if (point) items.sort((x, y) => distanceKm(point, x) - distanceKm(point, y));
    }
    const sel = curTx(); if (sel && !items.includes(sel) && !f) items.unshift(sel);
    const status = point && scan ? h('p', { class: 'muted scan-note', role: 'status' }, scan.done ? `Sprawdzono ${scan.checked} z ${scan.queue.length} nadajników ${S.muxType} do ${SCAN_RADIUS_KM} km` : `Sprawdzam nadajniki ${S.muxType}… ${scan.next ?? scan.checked}/${scan.total}`) : null;
    const more = point && scan?.done && scan.total < scan.queue.length && !f ? btn(`Sprawdź kolejne (${Math.min(SCAN_MAX_CANDIDATES, scan.queue.length - scan.total)})`, { iconName: 'refresh', small: true, attrs: { id: 'btn-scan-more' }, onclick: scanMore }) : null;
    const empty = !items.length ? h('div', { class: 'note warn' }, h('strong', {}, f ? 'Brak wyników' : S.txFilter === 'inRange' ? 'Brak nadajników z zapasem ≥ 0 dB (model)' : 'Brak nadajników'),
      h('p', {}, f ? `Żaden nadajnik ${S.muxType} nie pasuje do „${txQuery}”.` : 'Zmień filtr na „Wszystkie”, zawieś antenę wyżej albo wybierz inny MUX.')) : null;
    setChildren(ul, status, empty, items.slice(0, 60).map(t => txRow(t, byId.get(t.id), recId)), more);
  };
  const seg = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Które nadajniki pokazywać' },
    [['checked', 'Sprawdzone'], ['inRange', 'Z zapasem ≥ 0'], ['all', 'Wszystkie']].map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': S.txFilter === v, onclick: () => setTxFilter(v) }, S.txFilter === v ? '✓ ' : '', l)));
  q.addEventListener('input', draw);
  const tx = curTx(), m = tx && S.muxKey ? tx.muxes.find(x => x.key === S.muxKey) : null;
  const card = tx ? h('section', { class: 'card' }, h('h2', {}, tx.name),
    h('p', { class: 'muted' }, `${tx.lat.toFixed(5)}, ${tx.lon.toFixed(5)} · teren ${fmt.m(tx.siteElevationM)} n.p.m. · obiekt ${fmt.m(tx.structureHeightM)}`),
    m ? h('p', {}, h('strong', {}, `${m.name} · K${m.channel ?? '?'}`), ` · ${fmt.num(m.frequencyMHz, 1)} MHz · ${m.polarization || '?'} · ERP ${m.erpKw == null ? '?' : fmt.num(m.erpKw, 3) + ' kW'}${m.variant ? ` · wariant ${m.variant}` : ''}`)
      : h('div', { class: 'note warn' }, `${tx.name} nie nadaje ${S.muxType}. Wybierz inny nadajnik z listy albo zmień MUX.`),
    h('div', { class: 'row' }, btn('Pokaż na mapie', { kind: 'primary', iconName: 'map', small: true, onclick: () => showTab('map') }), btn(`MUX: ${S.muxType}`, { iconName: 'list', small: true, onclick: openMuxPicker })),
    h('details', {}, h('summary', {}, `Wszystkie emisje nadajnika (${tx.muxes.length})`),
      h('div', { class: 'table-wrap' }, h('table', { class: 'ref-table' }, h('thead', {}, h('tr', {}, ['', 'MUX', 'Kanał', 'MHz', 'ERP kW', 'Pol.', 'H anteny'].map(x => h('th', { scope: 'col' }, x)))),
        h('tbody', {}, tx.muxes.map(mm => h('tr', { class: mm.key === S.muxKey ? 'selected' : '' },
          h('td', {}, h('input', { type: 'radio', name: 'mux', checked: mm.key === S.muxKey, 'aria-label': `Wybierz ${mm.name}`, onchange: () => chooseTx(tx.id, mm.key) })),
          h('td', {}, mm.name), h('td', {}, mm.channel ?? '—'), h('td', {}, fmt.num(mm.frequencyMHz, 1)), h('td', {}, mm.erpKw == null ? '—' : fmt.num(mm.erpKw, 3)), h('td', {}, mm.polarization || '—'),
          h('td', { title: mm.heightSource }, mm.heightM == null ? 'brak' : fmt.m(mm.heightM) + (mm.heightSource.startsWith('antena') ? '' : '*'))))))),
      h('p', { class: 'fineprint' }, '* wysokość obiektu użyta zastępczo — baza nie podaje wysokości anteny tej emisji.')),
    m?.emissionUrl ? h('a', { href: m.emissionUrl, target: '_blank', rel: 'noopener' }, 'Karta emisji w RadioPolska') : null) : null;
  const dotLegend = point ? h('details', { class: 'tx-legend' }, h('summary', {}, 'Oznaczenia nadajników na mapie'),
    h('ul', {}, txLegend().map(b => h('li', {}, h('span', { class: `txdot txdot-${b.id}`, style: { '--c': b.color, width: '20px', height: '20px' }, 'aria-hidden': 'true' }, b.symbol), ' ', b.label))),
    h('p', { class: 'fineprint' }, '★ — polecany nadajnik wybranego MUX-a. Progi zapasu 0 / 10 / 20 dB ponad minimum (model).')) : null;
  setChildren(el, card, h('h2', {}, `Nadajniki ${S.muxType}`), seg, q, ul, dotLegend,
    h('p', { class: 'fineprint' }, `Ranking: do ${SCAN_MAX_CANDIDATES} najbliższych kandydatów w promieniu ${SCAN_RADIUS_KM} km, ten sam model i parametry co analiza punktu. Baza: ${DB.meta?.source || '—'} · ${DB.meta?.dataVersion || '—'} · ${DB.txs.length} nadajników. ${DB.meta?.license || ''}`));
  draw();
  if (hadFocus){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}

// ---------- Wyszukiwanie ----------
const searchForm = $('#search'), searchInput = $('#search-input'), searchList = $('#search-results');
searchForm.addEventListener('submit', async e => {
  e.preventDefault();
  const q = searchInput.value.trim();
  const m = q.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (m){ const lat = +m[1].replace(',', '.'), lon = +m[2].replace(',', '.'); if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180){ changePoint({ lat, lon, label: 'Współrzędne wpisane ręcznie', source: 'współrzędne' }); map.setView([lat, lon], 14); searchList.hidden = true; return; } }
  setChildren(searchList, h('li', { class: 'muted' }, 'Szukam…')); searchList.hidden = false;
  try {
    const res = await searchPlaces(q, { online: online() });
    setChildren(searchList, res.length ? res.map(r => h('li', {}, h('button', { type: 'button', onclick: () => { changePoint({ lat: r.lat, lon: r.lon, label: r.label, source: 'adres (Nominatim)' }); map.setView([r.lat, r.lon], 16); searchList.hidden = true; } }, r.label))) : h('li', { class: 'muted' }, 'Nie znaleziono. Spróbuj inaczej albo przytrzymaj mapę w miejscu montażu.'),
      h('li', { class: 'attr' }, 'Wyszukiwanie: © OpenStreetMap / Nominatim'));
  } catch (err){ if (err.kind === 'aborted') return; setChildren(searchList, h('li', { class: 'error' }, errorText(err, online()).text)); }
});
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') searchList.hidden = true; });

// ---------- Menu ----------
function openLayers(){
  const radio = (id) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'base', checked: S.base === id, onchange: () => setBase(id) }), ' ', BASES[id].name);
  const chk = (k, t) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: S.extras[k], onchange: e => { S.extras[k] = e.target.checked; save(); applyExtras(); } }), ' ', t);
  openModal({ title: 'Warstwy', body: h('div', {}, h('h3', {}, 'Mapa bazowa'), Object.keys(BASES).map(radio),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'chk-sat-labels', checked: S.satLabels, onchange: e => { S.satLabels = e.target.checked; save(); applyLabels(); } }), ' ', 'Nazwy miejscowości, drogi i granice na satelicie'),
    h('h3', {}, 'Dodatki'), chk('txs', 'Nadajniki z bazy'), chk('line', 'Linia punkt–nadajnik'),
    h('p', { class: 'fineprint' }, 'Podkłady mapowe nie są zapisywane do pracy offline (zasady OSM). Offline działają dane terenu i zapisane wyniki.')) });
}
function setModel(v){
  if (!MODELS[v] || v === S.model) return;
  S.model = v; save(); clearArea(); scan = null; runPoint();
}
async function openSettings(){
  const emission = curTx()?.muxes.find(x => x.key === S.muxKey);
  const vhf = emission?.frequencyMHz < 300;
  const gain = isVhf => num(isVhf ? 'gainVhfDbi' : 'gainUhfDbi', `Zysk anteny ${isVhf ? 'VHF' : 'UHF'} [dBi]`, 0, isVhf ? 15 : 20);
  const sel = h('select', { class: 'input', onchange: e => { S.rx.preset = e.target.value; save(); onRxChange(); } }, Object.entries(SYSTEM_PRESETS).map(([k, p]) => h('option', { value: k, selected: S.rx.preset === k }, p.label)));
  const num = (k, label, min, max, step = 0.5) => h('label', { class: 'field' }, h('span', {}, label), h('input', { type: 'number', class: 'input', min, max, step, value: S.rx[k], onchange: e => { const v = +e.target.value; if (Number.isFinite(v) && v >= min && v <= max){ S.rx[k] = v; save(); onRxChange(); } else e.target.value = S.rx[k]; } }));
  const m = openModal({ title: 'Ustawienia odbioru', body: h('div', {},
    h('label', { class: 'field' }, h('span', {}, 'System / modulacja (wymagany C/N)'), sel),
    h('p', { class: 'settings-context' }, `${muxLabel(S.muxType)}${emission ? ` · K${emission.channel} · pasmo ${vhf ? 'VHF' : 'UHF'}` : ' · brak wybranej emisji'}`),
    gain(vhf), num('cableLossDb', 'Straty kabla i złączy [dB]', 0, 20),
    h('details', { class: 'advanced', id: 'adv-settings', open: S.model !== 'p1812' ? true : null }, h('summary', {}, 'Zaawansowane'),
    gain(!vhf), num('noiseFigureDb', 'Szumy tunera/wzmacniacza NF [dB]', 1, 12),
    h('p', { class: 'fineprint' }, `C/N i margines implementacji: ${SYSTEM_PRESETS[S.rx.preset].note}.`),
    h('fieldset', { class: 'field' }, h('legend', {}, 'Nadajniki na mapie i liście'),
      [['checked', 'Sprawdzone (także słabe) — zalecane'], ['inRange', 'Tylko z zapasem ≥ 0 dB'], ['all', 'Wszystkie nadające wybrany MUX']].map(([v, l]) => h('label', { class: 'check' }, h('input', { type: 'radio', name: 'txFilter', value: v, checked: S.txFilter === v, onchange: () => setTxFilter(v) }), ' ', l))),
      h('label', { class: 'field' }, h('span', {}, 'Model propagacji'), h('select', { class: 'input', id: 'sel-model', onchange: e => { setModel(e.target.value); m.close(); openSettings(); } },
        Object.values(MODELS).map(mm => h('option', { value: mm.id, selected: S.model === mm.id }, mm.label)))),
      h('p', { class: 'fineprint' }, (MODELS[S.model] || MODELS.simple).note),
      S.model === 'p1812' ? h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'chk-nmt', checked: S.terrain === 'nmt', onchange: e => { S.terrain = e.target.checked ? 'nmt' : 'dem'; save(); clearArea(); scan = null; runPoint(); } }), ' ', 'Dokładny teren NMT GUGiK 1 m (online; offline/poza PL — Terrarium ~30 m). Dotyczy punktu i rankingu.') : null),
    btn('Przywróć domyślne', { kind: 'tertiary', onclick: () => { S.rx = { ...DEFAULT_RX }; save(); m.close(); onRxChange(); openSettings(); } })) });
}
/** Zmiana odbiornika: punkt i ranking liczone na nowo; mapa zasięgu tylko przekolorowana (wartości pola nie zależą od odbiornika). */
function onRxChange(){ scan = null; runPoint(); if (area) renderCoverage(); }
/** Jednorazowa propozycja: zapisano model uproszczony → zaproponuj P.1812. */
function suggestP1812(){
  if (S.model === 'p1812' || S.p1812Suggested) return;
  S.p1812Suggested = true; save();
  const m = openModal({ title: 'Dokładniejszy model obliczeń', body: h('div', {},
    h('p', {}, `Masz ustawiony model: „${MODELS.simple.label}”.`),
    h('p', {}, 'Domyślnym modelem jest teraz ITU-R P.1812 (teren, zabudowa i las statystycznie). Zalecamy przełączenie — zapisane instalacje zostaną zachowane i przeliczone.')),
    actions: [btn('Zostaw uproszczony', { kind: 'tertiary', onclick: () => m.close() }), btn('Przełącz na P.1812', { kind: 'primary', attrs: { id: 'btn-use-p1812' }, onclick: () => { m.close(); setModel('p1812'); announce('Przełączono na model ITU-R P.1812.'); } })] });
}
// „Zmień lokalizację”: adres, GPS albo współrzędne.
function openLocation(){
  const addr = h('input', { type: 'search', class: 'input', placeholder: 'np. Mielec, ul. Wojska Polskiego 3', 'aria-label': 'Adres', autofocus: true });
  const list = h('ul', { class: 'loc-results' });
  const lat = h('input', { type: 'text', class: 'input', inputmode: 'decimal', placeholder: '50.33624', 'aria-label': 'Szerokość geograficzna', value: point ? point.lat.toFixed(5) : '' });
  const lon = h('input', { type: 'text', class: 'input', inputmode: 'decimal', placeholder: '21.32573', 'aria-label': 'Długość geograficzna', value: point ? point.lon.toFixed(5) : '' });
  const err = h('p', { class: 'error', role: 'alert' });
  const go = p => { m.close(); changePoint(p); map.setView([p.lat, p.lon], Math.max(map.getZoom(), 14)); };
  const search = async () => {
    const q = addr.value.trim(); if (!q) return;
    setChildren(list, h('li', { class: 'muted' }, 'Szukam…'));
    try { const res = await searchPlaces(q, { online: online() });
      setChildren(list, res.length ? res.map(r => h('li', {}, h('button', { type: 'button', class: 'list-item', onclick: () => go({ lat: r.lat, lon: r.lon, label: r.label, source: 'adres (Nominatim)' }) }, r.label))) : h('li', { class: 'muted' }, 'Nie znaleziono.'));
    } catch (e){ if (e.kind !== 'aborted') setChildren(list, h('li', { class: 'error' }, errorText(e, online()).text)); }
  };
  addr.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); search(); } });
  const m = openModal({ title: 'Zmień lokalizację', body: h('div', { class: 'location' },
    h('h3', {}, 'Adres'), h('div', { class: 'row nowrap' }, addr, btn('Szukaj', { iconName: 'search', onclick: search })), list,
    h('h3', {}, 'GPS'), btn('Użyj mojej lokalizacji', { iconName: 'locate', onclick: () => { m.close(); locate(); } }),
    h('h3', {}, 'Współrzędne (WGS84)'), h('div', { class: 'row nowrap' }, lat, lon),
    err, btn('Ustaw punkt', { kind: 'primary', iconName: 'pin', attrs: { id: 'btn-loc-coords' }, onclick: () => {
      const la = +String(lat.value).replace(',', '.'), lo = +String(lon.value).replace(',', '.');
      if (!(Math.abs(la) <= 90 && Math.abs(lo) <= 180) || !lat.value || !lon.value){ err.textContent = 'Podaj poprawne współrzędne, np. 50.33624 i 21.32573.'; return; }
      go({ lat: la, lon: lo, label: 'Współrzędne wpisane ręcznie', source: 'współrzędne' });
    } }),
    h('p', { class: 'fineprint' }, 'Na mapie: przytrzymaj palec ok. 0,6 s w miejscu montażu (myszą: przytrzymaj lub kliknij prawym — „Ustaw punkt tutaj”).')) });
}
async function openDiag(){
  const body = h('div', {}, h('p', {}, 'Wczytywanie…'));
  const m = openModal({ title: 'Diagnostyka i dane', body, full: true });
  const [dem, resSize, est] = await Promise.all([demCacheInfo(), store.resultsSize(), store.storageEstimate()]);
  const sw = navigator.serviceWorker?.controller ? 'aktywny' : 'nieaktywny';
  const issues = DB.issues || [];
  m.setBody(h('table', { class: 'kv-table' }, h('tbody', {}, [
      ['Wersja aplikacji', APP_VERSION], ['Algorytm', ALGO_VERSION], ['Baza nadajników', `${DB.meta?.dataVersion || '—'} (schemat ${DB.meta?.schemaVersion ?? '—'}), ${DB.txs.length} nadajników`],
      ['Połączenie', online() ? 'online' : 'offline'], ['Service worker', sw],
      ['Teren (cache)', `${dem.tiles} kafli, ok. ${fmt.bytes(dem.approxBytes)}`], ['Zapisane wyniki', `${resSize.count}, ${fmt.bytes(resSize.bytes)}`],
      ['Instalacje', fmt.bytes(store.installationsSize())], ['Pamięć przeglądarki', est ? `${fmt.bytes(est.usage || 0)} z ${fmt.bytes(est.quota || 0)}` : '—'],
      ['Model propagacji', `${(MODELS[S.model] || MODELS.simple).label}${S.model === 'p1812' ? `; ΔN ${P1812_DEFAULTS.DN}, N0 ${P1812_DEFAULTS.N0}, p ${P1812_DEFAULTS.p}%` : ''}`],
      ['Teren — źródło', `${DEM_SOURCE}, siatka źródłowa ~${demResolutionM(DEM_Z, point?.lat ?? 52)} m${S.model === 'p1812' && S.terrain === 'nmt' ? '; online w Polsce: NMT GUGiK 1 m' : ''}`], ['Teren — krok próbkowania', analysis ? `punkt: ${Math.round(analysis.profile.spacingM)} m; ranking: 100 m` : 'punkt: wg długości trasy; ranking: 100 m'],
      ['Pokrycie terenu', S.model === 'p1812' ? 'CORINE Land Cover 2018 (EEA), 100 m' : 'nie używane (model uproszczony)'],
      ['Mapa zasięgu', 'ten sam model i parametry co punkt i ranking (siatka terenu wg promienia: ~38–150 m)'], ['Implementacja P.1812', `${P1812_IMPL.id} (sha256 ${P1812_IMPL.sha256_16}) · referencja: ${P1812_REFERENCE.id} (${P1812_REFERENCE.sha256_16})`]
    ].map(([k, v]) => h('tr', {}, h('th', { scope: 'row' }, k), h('td', {}, v))))),
    h('div', { class: 'row' },
      btn('Usuń dane terenu', { iconName: 'trash', small: true, onclick: async () => { if (confirm('Usunąć zapisane kafle terenu, NMT i pokrycia terenu?')){ await clearDemCache(); await (await import('./clutter.js')).clearClutterCache(); await (await import('./nmt.js')).clearNmtCache(); m.close(); openDiag(); } } }),
      btn('Usuń zapisane wyniki', { iconName: 'trash', small: true, onclick: async () => { if (confirm('Usunąć wyniki zapisane offline? Instalacje pozostaną.')){ await store.clearResults(); m.close(); openDiag(); } } })),
    h('h3', {}, `Kontrola bazy (${issues.length})`),
    issues.length ? h('ul', { class: 'issues' }, issues.slice(0, 200).map(i => h('li', { class: i.level }, i.text))) : h('p', {}, 'Brak problemów.'));
}
function openAbout(){
  openModal({ title: 'O aplikacji', body: h('div', {},
    h('p', {}, h('strong', {}, 'DVB-T/T2 Point'), ` — wersja ${APP_VERSION}`),
    h('p', {}, 'Narzędzie dla instalatorów: azymut, polaryzacja i przewidywany zapas sygnału z nadajnika naziemnego w wybranym punkcie.'),
    h('h3', {}, 'Ograniczenia (uczciwie)'),
    h('ul', {}, ['Domyślny model: ITU-R P.1812-7 (50% czasu, 50% lokalizacji) z klutterem CORINE i poprawką P.2108 przy odbiorniku; ΔN i N0 stałe dla Polski; strefa przybrzeżna nie jest wyznaczana.',
      'Punkt, ranking nadajników i mapa zasięgu liczone są tym samym modelem i parametrami; mapa używa rzadszej siatki terenu (dokładność węzła ±0,1 dB względem punktu przy tym samym profilu).', 'Model uproszczony (Deygout) dostępny tylko w ustawieniach zaawansowanych — bez pełnego uwzględnienia warunków propagacji.',
      'Bez odbić wielodrogowych, SFN i zakłóceń od innych nadajników.',
      'Teren: siatka źródłowa Terrarium ~25–30 m (online w Polsce: NMT GUGiK 1 m), profil próbkowany co kilkadziesiąt–100 m; przeszkody węższe niż krok mogą zostać pominięte.', 'Brak danych (terenu, pokrycia, charakterystyki anteny) jest zaznaczany w wyniku — nie oznacza braku zasięgu.',
      'Wysokość anteny nadawczej pochodzi z bazy MUX-a; gdy jej brak — zastępczo wysokość obiektu (oznaczone).',
      'Charakterystyki anten .ant tylko tam, gdzie RadioPolska udostępnia poprawny plik; w innych przypadkach 0 dB.',
      'Kompas telefonu bywa niedokładny (±10–20°) i zakłócany przez metal — potwierdź kierunek wizualnie.',
      'Ostateczna ocena wymaga pomiaru miernikiem (MER, C/N, błędy).'].map(t => h('li', {}, t))),
    h('h3', {}, 'Źródła'),
    h('ul', {}, ['Nadajniki: RadioPolska (CC BY 4.0) — ' + (DB.meta?.dataVersion || ''), 'Teren: Terrarium / Mapzen, AWS Open Data (SRTM, inne); NMT: GUGiK (Geoportal.gov.pl)', 'Pokrycie terenu: CORINE Land Cover 2018 © EEA / Copernicus Land Monitoring Service', 'Model ITU-R P.1812-7 / P.2108 (port Py1812, OFCOM, BSD-3)', 'Mapy: © OpenStreetMap, OpenTopoMap, Esri', 'Wyszukiwanie: Nominatim (OSM)', 'Leaflet 1.9.4 (BSD-2)'].map(t => h('li', {}, t)))) });
}
function openBook(){ const body = h('div', {}); openModal({ title: 'Książka instalatora', body, full: true }); renderBook(body); }
function openMenu(){
  const item = (ic, t, fn) => h('button', { type: 'button', class: 'list-item', onclick: () => { m.close(); fn(); } }, icon(ic), h('span', { class: 'li-main' }, h('strong', {}, t)));
  const m = openModal({ title: 'Menu', body: h('div', { class: 'list' }, item('layers', 'Warstwy mapy', openLayers), item('pin', 'Zmień lokalizację', openLocation), item('list', `Multipleks: ${S.muxType}`, openMuxPicker), item('settings', 'Ustawienia odbioru', openSettings), item('book', 'Książka instalatora', openBook), item('wrench', 'Diagnostyka i dane', openDiag), item('info', 'O aplikacji', openAbout)) });
}

// ---------- Nawigacja ----------
function showTab(id){
  for (const b of document.querySelectorAll('.bottom-nav button')) b.setAttribute('aria-current', b.dataset.tab === id ? 'page' : 'false');
  for (const t of ['tx', 'saved']) $(`#tab-${t}`).hidden = t !== id;
  document.body.dataset.tab = id;
  if (id === 'tx') renderTxTab(); if (id === 'saved') renderSaved();
  if (id === 'map') setTimeout(() => map.invalidateSize(), 50);
  if (id !== 'map') closeAllModals();
}
for (const b of document.querySelectorAll('.bottom-nav button')) b.addEventListener('click', () => showTab(b.dataset.tab));
$('#btn-menu').addEventListener('click', openMenu);
$('#btn-locate').addEventListener('click', locate);
$('#btn-layers').addEventListener('click', openLayers);
$('#btn-mux').addEventListener('click', openMuxPicker);
$('#btn-compass').addEventListener('click', () => { if (!compass.isRunning() && compass.needsGesture()) compass.start(); openAim(); });

// ---------- Panel wyniku: trzy położenia; przycisk to podstawa, przeciąganie uchwytu tylko dodatkiem ----------
const sheetEl = $('#sheet'), handleEl = $('#sheet-toggle');
const POS_ORDER = ['collapsed', 'summary', 'expanded'];
let drag = null;
handleEl.addEventListener('click', () => { if (drag?.moved) return; setSheetPos(sheetEl.dataset.pos === 'collapsed' ? 'summary' : 'collapsed'); });
handleEl.addEventListener('pointerdown', e => {
  if (e.button > 0 || matchMedia('(min-width: 900px), (min-width: 600px) and (max-height: 500px)').matches) return;
  drag = { id: e.pointerId, y: e.clientY, h: sheetEl.getBoundingClientRect().height, moved: false };
  handleEl.setPointerCapture?.(e.pointerId);
});
handleEl.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const dy = drag.y - e.clientY;
  if (!drag.moved && Math.abs(dy) < 8) return;
  drag.moved = true; sheetEl.classList.add('dragging'); sheetEl.style.height = `${Math.max(56, drag.h + dy)}px`;
});
function endDrag(e){
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag; sheetEl.classList.remove('dragging');
  if (d.moved){
    const hNow = sheetEl.getBoundingClientRect().height; sheetEl.style.height = '';
    // najbliższe z trzech położeń
    const hs = POS_ORDER.map(p => { sheetEl.dataset.pos = p; return [p, sheetEl.getBoundingClientRect().height]; });
    const best = hs.sort((x, y) => Math.abs(x[1] - hNow) - Math.abs(y[1] - hNow))[0][0];
    setSheetPos(best);
    setTimeout(() => { drag = null; }, 0);
  } else drag = null;
}
handleEl.addEventListener('pointerup', endDrag); handleEl.addEventListener('pointercancel', endDrag);
handleEl.addEventListener('keydown', e => {
  const i = POS_ORDER.indexOf(sheetEl.dataset.pos);
  if (e.key === 'ArrowUp'){ e.preventDefault(); setSheetPos(POS_ORDER[Math.min(2, i + 1)]); }
  else if (e.key === 'ArrowDown'){ e.preventDefault(); setSheetPos(POS_ORDER[Math.max(0, i - 1)]); }
});
function syncTopbar(){
  const height = Math.ceil($('.topbar').getBoundingClientRect().height);
  if (height) document.documentElement.style.setProperty('--topbar-h', `${height}px`);
}
if (typeof ResizeObserver !== 'undefined'){
  new ResizeObserver(syncSheetH).observe(sheetEl);
  new ResizeObserver(syncTopbar).observe($('.topbar'));
}
syncTopbar();
addEventListener('resize', syncTopbar);
addEventListener('resize', syncSheetH);

// ---------- Kompas na mapie (róża + igła) i stożek kierunku przy punkcie ----------
const compass = createCompass({ getCalib: () => S.calib });
let coneMarker = null;
function updateCone(s){
  const live = s.heading != null && s.state !== 'manual';
  if (!point || !live){ if (coneMarker){ map.removeLayer(coneMarker); coneMarker = null; } return; }
  if (!coneMarker) coneMarker = L.marker([point.lat, point.lon], { icon: L.divIcon({ className: 'hd-cone', html: '<div class="hd-cone-in"></div>', iconSize: [140, 140] }), interactive: false, keyboard: false, zIndexOffset: -500 }).addTo(map);
  else coneMarker.setLatLng([point.lat, point.lon]);
  const inner = coneMarker.getElement()?.firstChild; if (inner) inner.style.transform = `rotate(${s.heading}deg)`;
}
function updateCompassFab(s){
  const el = $('#btn-compass'); if (!el) return;
  const live = s.state === 'ok' && s.heading != null, hd = live ? s.heading : null; // tryb ręczny nie udaje kompasu
  const target = analysis?.az ?? (point && curTx() ? azimuthDeg(point, curTx()) : null);
  el.dataset.live = live; el.dataset.cal = !!s.needsCalibration;
  el.style.setProperty('--rose', `${live ? -hd : 0}deg`);
  el.style.setProperty('--target', `${target == null ? 0 : normDeg(target - (live ? hd : 0))}deg`);
  el.dataset.hasTarget = target != null;
  let label = '—', aligned = false;
  if (live && target != null){ const d = ((target - hd + 540) % 360) - 180; aligned = Math.abs(d) <= 5; label = aligned ? 'OK' : `${d > 0 ? '↻' : '↺'}${Math.abs(Math.round(d))}°`; }
  else if (live) label = `${Math.round(hd)}°`;
  else if (target != null) label = `${Math.round(target)}°`;
  el.dataset.aligned = aligned;
  el.querySelector('.cf-label').textContent = label;
  el.setAttribute('aria-label', `Kompas — ustaw antenę. ${live ? `Telefon: ${Math.round(hd)}°` : 'Kompas nieaktywny'}${target != null ? `, nadajnik: ${Math.round(target)}°` : ''}`);
}
let calWarned = false;
compass.subscribe(s => { updateCompassFab(s); updateCone(s); if (s.needsCalibration && !calWarned && !aimModal){ calWarned = true; announce('Kompas wymaga kalibracji — zatocz telefonem „ósemkę”.', { kind: 'warn' }); } });

// ---------- Przycisk Wstecz (Android: MainActivity woła handleBack(); PWA: History API) ----------
function handleBack(){
  if (drag?.moved) return true;
  if (mapMenu){ closeMapMenu(); return true; }
  if (!searchList.hidden){ searchList.hidden = true; return true; }
  if (closeTopModal()) return true;
  if (document.body.dataset.tab !== 'map'){ showTab('map'); return true; }
  if (legendOpen){ legendOpen = false; renderLegend(); return true; }
  if (sheetEl.dataset.pos === 'expanded'){ setSheetPos('summary'); return true; }
  return false;
}
window.handleBack = handleBack;
if (!nativeBridge() && history.pushState){
  let lastBack = 0;
  history.replaceState({ dvbt: 'base' }, '');
  history.pushState({ dvbt: 'guard' }, '');
  addEventListener('popstate', () => {
    if (handleBack()){ history.pushState({ dvbt: 'guard' }, ''); return; }
    const now = Date.now();
    if (now - lastBack < 2000){ history.back(); return; } // drugie naciśnięcie — opuszczamy aplikację
    lastBack = now; announce('Naciśnij ponownie, aby wyjść'); history.pushState({ dvbt: 'guard' }, '');
  });
}
function netStatus(){ const off = !online(); $('#offline').hidden = !off; document.body.classList.toggle('is-offline', off); }
addEventListener('online', netStatus); addEventListener('offline', netStatus);

// ---------- Start ----------
$('#app-version').textContent = APP_VERSION;
netStatus();
await loadDb();
if (S.migratedFrom) announce('Przeniesiono punkt z poprzedniej wersji aplikacji.');
if (S.point && Number.isFinite(S.point.lat)) setPoint(S.point, { silent: true }); else renderSheet();
showTab('map');
setSheetPos(S.sheetPos, { persist: false });
updateMuxButton();
setTimeout(suggestP1812, 800);
if (!compass.needsGesture()) compass.start();
document.addEventListener('visibilitychange', () => { if (document.hidden) compass.stop(); else if (!compass.needsGesture()) compass.start(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(reg => {
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) announce('Dostępna nowa wersja — odśwież stronę.'); }); });
  }).catch(() => {});
}
window.__dvbt = { get analysis(){ return analysis; }, get area(){ return area; }, get scan(){ return scan; }, get settings(){ return S; }, get compass(){ return compass.snapshot(); }, setPoint, changePoint, undoPoint, chooseTx, setMuxType, runArea, runScan, scanMore, readCoverage, openCoverage, setAreaView, setSheetPos, get point(){ return point; }, selKey: () => selKeyNow(), jobs, handleBack, setTxFilter };
