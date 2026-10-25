// Numeryczny Model Terenu GUGiK (Geoportal, usługa GetHByPointList, układ PUWG 1992 / EPSG:2180, siatka 1 m — dane z LIDAR).
// Opcjonalne doprecyzowanie terenu online; przy błędzie/timeout/poza Polską — pozostaje DEM Terrarium. Cache + AbortSignal.
import { fetchWithTimeout, AppError } from '../core/errors.js';
import { toPuwg92, inPolandBBox } from '../core/puwg92.js';

export const NMT_CACHE = 'dvbt-point-nmt-v1';
export const NMT_SOURCE = 'NMT GUGiK (Geoportal.gov.pl), siatka 1 m z lotniczego skaningu laserowego, dokładność pionowa ok. 0,1–0,2 m';
export const NMT_URL = 'https://services.gugik.gov.pl/nmt/?request=GetHByPointList&list=';
const BATCH = 400, MAX_DIFF_M = 40;

/** Zwraca Float64Array wysokości (NaN tam, gdzie brak/odrzucone) i liczbę punktów przyjętych. Wartości sprawdzane względem DEM (±40 m). */
export async function nmtHeights(lats, lons, demE, { signal, timeoutMs = 15000 } = {}){
  const n = lats.length, out = new Float64Array(n).fill(NaN), idx = [];
  for (let i = 0; i < n; i++) if (inPolandBBox(lats[i], lons[i])) idx.push(i);
  if (!idx.length) return { e: out, accepted: 0 };
  let cache = null; try { cache = await caches.open(NMT_CACHE); } catch {}
  for (let b = 0; b < idx.length; b += BATCH){
    if (signal?.aborted) throw new AppError('aborted');
    const part = idx.slice(b, b + BATCH);
    const list = part.map(i => { const p = toPuwg92(lats[i], lons[i]); return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(',');
    const url = NMT_URL + encodeURIComponent(list);
    let resp = cache ? await cache.match(url).catch(() => null) : null;
    if (!resp){ resp = await fetchWithTimeout(url, { signal, timeoutMs, mode: 'cors' }); if (!resp.ok) throw new AppError('badresponse', 'NMT GUGiK: błąd usługi.'); try { await cache?.put(url, resp.clone()); } catch {} }
    const vals = (await resp.text()).trim().split(',').map(s => Number(s.trim().split(/\s+/)[2]));
    if (vals.length !== part.length) continue; // niespójna odpowiedź — cała paczka z DEM
    part.forEach((i, k) => { const v = vals[k]; if (Number.isFinite(v) && v !== 0 && Math.abs(v - demE[i]) <= MAX_DIFF_M) out[i] = v; });
  }
  let accepted = 0; for (const v of out) if (Number.isFinite(v)) accepted++;
  return { e: out, accepted };
}
export async function clearNmtCache(){ try { await caches.delete(NMT_CACHE); } catch {} }
