// Pokrycie terenu: CORINE Land Cover 2018 (Copernicus Land Monitoring Service / EEA), eksport rastra z serwisu EEA (CORS).
// Kafle 0,25° × 0,25°, 256 px (≈ 100 m — rozdzielczość źródła). Pamięć + Cache Storage, AbortSignal, limit równoległości.
import { AppError, fetchWithTimeout } from '../core/errors.js';
import { clcFromRgb } from '../core/landcover.js';

export const CLC_CACHE = 'dvbt-point-clc-v1';
export const CLC_SOURCE = 'CORINE Land Cover 2018 (Copernicus/EEA), raster 100 m';
export const CLC_TILE_DEG = 0.25, CLC_PX = 256;
export const clcTileUrl = (tx, ty) => {
  const w = tx * CLC_TILE_DEG, s = ty * CLC_TILE_DEG;
  return `https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer/export?bbox=${w},${s},${w + CLC_TILE_DEG},${s + CLC_TILE_DEG}&bboxSR=4326&imageSR=4326&size=${CLC_PX},${CLC_PX}&layers=show:1&format=png24&transparent=false&f=image`;
};
const mem = new Map(), inflight = new Map();
let running = 0; const queue = [];
const limit = fn => new Promise((res, rej) => { const run = () => { running++; fn().then(res, rej).finally(() => { running--; queue.shift()?.(); }); }; running < 3 ? run() : queue.push(run); });

async function decode(blob){
  const bmp = await createImageBitmap(blob);
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(CLC_PX, CLC_PX) : Object.assign(document.createElement('canvas'), { width: CLC_PX, height: CLC_PX });
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, CLC_PX, CLC_PX); bmp.close?.();
  const px = ctx.getImageData(0, 0, CLC_PX, CLC_PX).data, out = new Int16Array(CLC_PX * CLC_PX);
  for (let i = 0; i < out.length; i++) out[i] = clcFromRgb(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
  return out;
}
async function getTile(tx, ty, { signal, online }){
  const key = `${tx}/${ty}`;
  if (mem.has(key)) return mem.get(key);
  if (inflight.has(key)) return inflight.get(key);
  const p = limit(async () => {
    if (signal?.aborted) throw new AppError('aborted');
    const url = clcTileUrl(tx, ty); let resp = null;
    try { resp = await (await caches.open(CLC_CACHE)).match(url); } catch {}
    if (!resp){
      if (!online) throw new AppError('offline', 'Brak danych pokrycia terenu offline.');
      resp = await fetchWithTimeout(url, { signal, timeoutMs: 20000, mode: 'cors' });
      if (!resp.ok || !(resp.headers.get('content-type') || '').includes('image')) throw new AppError('badresponse', 'CORINE: nieprawidłowa odpowiedź.');
      try { await (await caches.open(CLC_CACHE)).put(url, resp.clone()); } catch {}
    }
    const data = await decode(await resp.blob());
    mem.set(key, data); if (mem.size > 120) mem.delete(mem.keys().next().value);
    return data;
  }).finally(() => inflight.delete(key));
  inflight.set(key, p); return p;
}
/** Kody CLC dla punktów profilu. Zwraca { cover: Int16Array, coverage: udział punktów z danymi } lub rzuca błąd. */
export async function coverForPoints(lats, lons, { signal, online = true } = {}){
  const n = lats.length, ids = new Set();
  const tileOf = i => [Math.floor(lons[i] / CLC_TILE_DEG), Math.floor(lats[i] / CLC_TILE_DEG)];
  for (let i = 0; i < n; i++) ids.add(tileOf(i).join('/'));
  const tiles = new Map();
  await Promise.all([...ids].map(async k => { const [a, b] = k.split('/').map(Number); tiles.set(k, await getTile(a, b, { signal, online })); }));
  const cover = new Int16Array(n); let have = 0;
  for (let i = 0; i < n; i++){
    const [a, b] = tileOf(i), t = tiles.get(`${a}/${b}`);
    const px = Math.min(CLC_PX - 1, Math.floor((lons[i] / CLC_TILE_DEG - a) * CLC_PX));
    const py = Math.min(CLC_PX - 1, Math.floor((1 - (lats[i] / CLC_TILE_DEG - b)) * CLC_PX));
    cover[i] = t[py * CLC_PX + px]; if (cover[i]) have++;
  }
  return { cover, coverage: have / n };
}
export async function clearClutterCache(){ mem.clear(); try { await caches.delete(CLC_CACHE); } catch {} }
