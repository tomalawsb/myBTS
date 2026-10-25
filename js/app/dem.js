// Numeryczny model terenu: kafle Terrarium (AWS Open Data, z=12 ≈ 25–30 m/piksel w Polsce).
// Działa w oknie i w Web Workerze. Kafle są współdzielone (pamięć + Cache Storage), z limitem równoległości.
import { distanceKm, intermediatePoint } from '../core/geo.js';
import { AppError, fetchWithTimeout } from '../core/errors.js';

export const DEM_Z = 12;
export const DEM_CACHE = 'dvbt-point-dem-v1';
export const demResolutionM = (z, lat = 51) => Math.round(40075016 * Math.cos(lat * Math.PI / 180) / (256 * 2 ** z));
export const DEM_SOURCE = 'Terrarium (Mapzen/AWS Open Data), zoom 12 — ok. 25–30 m na piksel; wysokości gruntu bez budynków i drzew, dokładność pionowa kilka–kilkanaście m';
export const tileUrl = (x, y, z = DEM_Z) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const mem = new Map();      // key -> Float32Array(65536)
const inflight = new Map(); // key -> Promise
const MEM_LIMIT = 160;
let running = 0; const queue = [];
const MAX_PARALLEL = 4;
function limit(fn){
  return new Promise((res, rej) => {
    const run = () => { running++; fn().then(res, rej).finally(() => { running--; queue.shift()?.(); }); };
    running < MAX_PARALLEL ? run() : queue.push(run);
  });
}
export function lonLatToTile(lat, lon, z = DEM_Z){
  const n = 2 ** z, x = (lon + 180) / 360 * n;
  const r = lat * Math.PI / 180;
  const y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  return { x, y };
}
async function decode(blob){
  const bmp = await createImageBitmap(blob);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : Object.assign(document.createElement('canvas'), { width: 256, height: 256 });
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0); bmp.close?.();
  const px = ctx.getImageData(0, 0, 256, 256).data;
  const out = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) out[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
  return out;
}
export async function getTile(x, y, { signal, online = true, z = DEM_Z } = {}){
  const key = `${z}/${x}/${y}`;
  if (mem.has(key)){ const v = mem.get(key); mem.delete(key); mem.set(key, v); return v; }
  if (inflight.has(key)) return inflight.get(key);
  const p = limit(async () => {
    if (signal?.aborted) throw new AppError('aborted');
    const url = tileUrl(x, y, z);
    let resp = null;
    try { const c = await caches.open(DEM_CACHE); resp = await c.match(url); } catch {}
    if (!resp){
      if (!online) throw new AppError('offline', 'Brak połączenia i brak zapisanych danych terenu dla tego obszaru.');
      resp = await fetchWithTimeout(url, { signal, timeoutMs: 20000, mode: 'cors' });
      try { const c = await caches.open(DEM_CACHE); await c.put(url, resp.clone()); } catch {}
    }
    const data = await decode(await resp.blob());
    mem.set(key, data); if (mem.size > MEM_LIMIT) mem.delete(mem.keys().next().value);
    return data;
  }).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
export function tilesForPoints(points, z = DEM_Z){
  const set = new Map();
  for (const p of points){
    const t = lonLatToTile(p.lat, p.lon, z);
    const fx = t.x - Math.floor(t.x), fy = t.y - Math.floor(t.y);
    const xs = [Math.floor(t.x)], ys = [Math.floor(t.y)];
    if (fx < 0.01) xs.push(Math.floor(t.x) - 1); if (fx > 0.99) xs.push(Math.floor(t.x) + 1);
    if (fy < 0.01) ys.push(Math.floor(t.y) - 1); if (fy > 0.99) ys.push(Math.floor(t.y) + 1);
    for (const x of xs) for (const y of ys) set.set(`${x}/${y}`, { x, y, z });
  }
  return [...set.values()];
}
export function tilesForBBox(s, w, n, e, z = DEM_Z){
  const a = lonLatToTile(n, w, z), b = lonLatToTile(s, e, z); const out = [];
  for (let x = Math.floor(a.x); x <= Math.floor(b.x); x++) for (let y = Math.floor(a.y); y <= Math.floor(b.y); y++) out.push({ x, y, z });
  return out;
}
export async function ensureTiles(tiles, { signal, onProgress, online = true } = {}){
  let done = 0;
  await Promise.all(tiles.map(t => getTile(t.x, t.y, { signal, online, z: t.z ?? DEM_Z }).then(() => { done++; onProgress?.(done, tiles.length); })));
}
/** Wysokość (interpolacja dwuliniowa) — kafle muszą być wcześniej wczytane. */
export function elevationSync(lat, lon, z = DEM_Z){
  const t = lonLatToTile(lat, lon, z);
  const gx = t.x * 256 - 0.5, gy = t.y * 256 - 0.5;
  const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const v = (px, py) => { const tx = Math.floor(px / 256), ty = Math.floor(py / 256); const a = mem.get(`${z}/${tx}/${ty}`); if (!a) return NaN; return a[(py - ty * 256) * 256 + (px - tx * 256)]; };
  const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
/** Profil terenu odbiornik → nadajnik (łuk wielkiego koła). Opcje: terrain 'nmt' (GUGiK online, z fallbackiem), cover (CORINE). */
export async function buildProfile(rx, tx, { signal, onProgress, online = true, spacingM = 40, terrain = 'dem', cover = false } = {}){
  const D = distanceKm(rx, tx);
  if (D < 0.05) throw new AppError('input', 'Punkt instalacji pokrywa się z nadajnikiem.');
  const n = Math.max(256, Math.min(2000, Math.ceil(D * 1000 / spacingM) + 1));
  const pts = Array.from({ length: n }, (_, i) => intermediatePoint(rx, tx, i / (n - 1)));
  await ensureTiles(tilesForPoints(pts), { signal, online, onProgress });
  const d = new Float64Array(n), e = new Float64Array(n);
  for (let i = 0; i < n; i++){ d[i] = D * i / (n - 1); e[i] = elevationSync(pts[i].lat, pts[i].lon); }
  if ([...e].some(v => !Number.isFinite(v))) throw new AppError('badresponse', 'Niepełne dane terenu.');
  const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
  const out = { d, e, lats, lons, spacingM: D * 1000 / (n - 1), source: DEM_SOURCE, terrainId: 'dem', terrainNote: null, cover: null, coverSource: null, coverNote: null };
  if (terrain === 'nmt'){
    if (!online) out.terrainNote = 'NMT GUGiK niedostępny offline — użyto DEM Terrarium.';
    else try {
      const { nmtHeights, NMT_SOURCE } = await import('./nmt.js');
      const r = await nmtHeights(lats, lons, e, { signal });
      if (r.accepted >= 0.9 * n){ for (let i = 0; i < n; i++) if (Number.isFinite(r.e[i])) e[i] = r.e[i]; out.terrainId = r.accepted === n ? 'nmt' : 'nmt+dem'; out.source = r.accepted === n ? NMT_SOURCE : `${NMT_SOURCE} (${Math.round(100 * r.accepted / n)}% punktów; reszta: Terrarium)`; }
      else out.terrainNote = r.accepted ? `NMT GUGiK: tylko ${Math.round(100 * r.accepted / n)}% punktów — użyto DEM Terrarium.` : 'Trasa poza zasięgiem NMT GUGiK — użyto DEM Terrarium.';
    } catch (err){ if (err?.kind === 'aborted' || signal?.aborted) throw err; out.terrainNote = 'NMT GUGiK nie odpowiedział — użyto DEM Terrarium.'; }
  }
  if (cover){
    try {
      const { coverForPoints, CLC_SOURCE } = await import('./clutter.js');
      const r = await coverForPoints(lats, lons, { signal, online });
      if (r.coverage >= 0.5){ out.cover = r.cover; out.coverSource = CLC_SOURCE; } else out.coverNote = 'Brak danych CORINE dla trasy — klutter pominięty.';
    } catch (err){ if (err?.kind === 'aborted' || signal?.aborted) throw err; out.coverNote = online ? 'CORINE niedostępne — klutter pominięty (teren goły).' : 'Offline i brak zapisanych danych CORINE — klutter pominięty.'; }
  }
  return out;
}
export async function demCacheInfo(){
  try { const c = await caches.open(DEM_CACHE); const keys = await c.keys(); return { tiles: keys.length, approxBytes: keys.length * 110 * 1024 }; } catch { return { tiles: 0, approxBytes: 0 }; }
}
export async function clearDemCache(){ mem.clear(); try { await caches.delete(DEM_CACHE); } catch {} }
