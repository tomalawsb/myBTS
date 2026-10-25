// Warstwa zasięgu: kolorowanie z zapisanych WARTOŚCI pola (bez ponownej propagacji), progi, statystyki, odczyt z mapy.
import { MARGIN_BANDS, marginBand } from './rf.js';

// Stałe progi natężenia pola [dBµV/m] (jak w opracowaniach planistycznych DVB-T/T2).
export const FIELD_THRESHOLDS = [48, 53, 60, 65, 70, 74, 85];
export const FIELD_BANDS = [
  { id: 'below', min: -Infinity, max: 48, label: '< 48 — poniżej skali', color: '#9AA3B2', pattern: 'diag', below: true },
  { id: 'f48', min: 48, max: 53, label: '48–53', color: '#6A3FB5' },
  { id: 'f53', min: 53, max: 60, label: '53–60', color: '#2F5FD0' },
  { id: 'f60', min: 60, max: 65, label: '60–65', color: '#1E9AC9' },
  { id: 'f65', min: 65, max: 70, label: '65–70', color: '#2E9D5B' },
  { id: 'f70', min: 70, max: 74, label: '70–74', color: '#9BC53D' },
  { id: 'f74', min: 74, max: 85, label: '74–85', color: '#F2B705' },
  { id: 'above', min: 85, max: Infinity, label: '≥ 85 — powyżej skali', color: '#D7301F', pattern: 'dot', above: true }
];
export function fieldBand(E){
  if (!Number.isFinite(E)) return null;
  let b = FIELD_BANDS[0]; for (const x of FIELD_BANDS) if (E >= x.min) b = x; return b;
}
export const MASK = { OUTSIDE: 0, OK: 1, NODATA: 2 };
const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

/** RGBA z pola i maski. view: 'field' | 'margin'. eMin — próg z BIEŻĄCYCH parametrów instalacji. */
export function colorize({ field, mask, width, height }, { view = 'field', eMin = 0 } = {}){
  const img = new Uint8ClampedArray(width * height * 4), cache = new Map();
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++){
    const i = py * width + px, k = i * 4, m = mask[i];
    if (m === MASK.OUTSIDE) continue;
    if (m === MASK.NODATA){ // brak danych: szare kreskowanie, NIE kolor „brak zasięgu”
      const s = (px + py) % 6 < 2; img[k] = s ? 90 : 200; img[k + 1] = s ? 96 : 204; img[k + 2] = s ? 110 : 212; img[k + 3] = 255; continue;
    }
    const v = field[i];
    const b = view === 'margin' ? marginBand(v - eMin) : fieldBand(v);
    let c = cache.get(b.id); if (!c){ c = hex(b.color); cache.set(b.id, c); }
    const hatch = (b.pattern === 'diag' && (px + py) % 8 < 2) || (b.pattern === 'cross' && ((px + py) % 10 < 2 || (px - py + 1000) % 10 < 2)) || (b.pattern === 'dot' && px % 6 === 0 && py % 6 === 0);
    img[k] = hatch ? 255 : c[0]; img[k + 1] = hatch ? 255 : c[1]; img[k + 2] = hatch ? 255 : c[2]; img[k + 3] = 255;
  }
  return img;
}

/** Udziały liczone TYLKO z obliczonych komórek; brak danych raportowany osobno. */
export function coverageStats({ field, mask }, { eMin = 0 } = {}){
  let ok = 0, nodata = 0, positive = 0; const field_ = {}, margin = {};
  for (const b of FIELD_BANDS) field_[b.id] = 0; for (const b of MARGIN_BANDS) margin[b.id] = 0;
  for (let i = 0; i < mask.length; i++){
    if (mask[i] === MASK.NODATA){ nodata++; continue; }
    if (mask[i] !== MASK.OK) continue;
    ok++; const v = field[i];
    field_[fieldBand(v).id]++; margin[marginBand(v - eMin).id]++; if (v - eMin >= 0) positive++;
  }
  const n = ok || 1, all = ok + nodata || 1;
  const sh = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / n]));
  return { computed: ok, noData: nodata, noDataShare: nodata / all, positiveShare: ok ? positive / ok : null, fieldShare: sh(field_), marginShare: sh(margin) };
}

/** Odczyt wartości z siatki (dwuliniowo z sąsiadów obliczonych; inaczej najbliższy). fx, fy — współrzędne pikselowe. */
export function sampleGrid({ field, mask, width, height }, fx, fy){
  const x = fx - 0.5, y = fy - 0.5, x0 = Math.floor(x), y0 = Math.floor(y);
  const ni = Math.round(x), nj = Math.round(y);
  if (ni < 0 || nj < 0 || ni >= width || nj >= height) return { state: 'outside' };
  const mi = mask[nj * width + ni];
  if (mi === MASK.OUTSIDE) return { state: 'outside' };
  if (mi === MASK.NODATA) return { state: 'nodata' };
  let s = 0, w = 0;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]){
    const px = x0 + dx, py = y0 + dy; if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const i = py * width + px; if (mask[i] !== MASK.OK) continue;
    const wt = (dx ? x - x0 : 1 - (x - x0)) * (dy ? y - y0 : 1 - (y - y0)); s += wt * field[i]; w += wt;
  }
  return { state: 'ok', value: w > 0 ? s / w : field[nj * width + ni] };
}
