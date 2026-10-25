// Mapa zasięgu (obszar lub okolica punktu) — liczona promieniami od nadajnika tymi samymi funkcjami co punkt.
// Wynik: siatka WARTOŚCI pola [dBµV/m] + maska (poza obszarem / obliczono / brak danych). Kolory nadaje main.js (coverage.js).
import { destinationPoint, distanceKm, azimuthDeg, angleDiff, normDeg } from '../core/geo.js';
import { rayFieldStrengths } from '../core/rf.js';
import { areaNodeField, fillBetweenNodes, AREA_MAX_PROFILE_POINTS } from '../core/areanode.js';
import { MASK } from '../core/coverage.js';
import { antGainAt } from '../core/ant.js';
import { getTile, tilesForBBox, elevationSync, demResolutionM, DEM_SOURCE } from './dem.js';
import { AppError } from '../core/errors.js';
import { coverForPoints } from './clutter.js';

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function mercY(lat){ const r = lat * Math.PI / 180; return Math.log(Math.tan(Math.PI / 4 + r / 2)); }
function latFromMercY(y){ return (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI; }

export async function computeArea(job, { signal, progress = () => {} } = {}){
  const { mode, tx, txHeightM, txGround, rxHeightM, freqMHz, erpKw, gains, radiusKm, point, online = true, model = 'p1812', pol = 'H', clutter = true } = job;
  const useP = model === 'p1812';
  if (!(erpKw > 0) || !(freqMHz > 0) || !(txHeightM > 0)) throw new AppError('input', 'Brak mocy, częstotliwości lub wysokości anteny nadawczej.');
  let center, R, z, step, bearings, dFrom, dTo, W;
  if (mode === 'local'){
    center = point; R = 1; z = 12; step = 0.025; W = 160;
    const D = distanceKm(tx, point);
    if (D < 1.5) throw new AppError('input', 'Punkt leży za blisko nadajnika do analizy okolicy (< 1,5 km).');
    const az = azimuthDeg(tx, point), half = Math.asin(Math.min(1, (R * 1.1) / D)) * 180 / Math.PI;
    const n = Math.min(300, Math.max(40, Math.ceil(2 * half * Math.PI / 180 * D / 0.02)));
    bearings = Array.from({ length: n }, (_, i) => normDeg(az - half + 2 * half * i / (n - 1)));
    dFrom = Math.max(0.05, D - R * 1.15); dTo = D + R * 1.15;
  } else {
    center = tx; R = radiusKm; z = R > 40 ? 10 : (R > 20 ? 11 : 12);
    step = Math.max(0.08, R / 500); W = 640;
    bearings = Array.from({ length: useP ? 360 : 720 }, (_, i) => i * (useP ? 1 : 0.5));
    dFrom = step; dTo = R;
  }
  const nPt = destinationPoint(center.lat, center.lon, 0, R), sPt = destinationPoint(center.lat, center.lon, 180, R);
  const ePt = destinationPoint(center.lat, center.lon, 90, R), wPt = destinationPoint(center.lat, center.lon, 270, R);
  const bounds = { s: sPt.lat, n: nPt.lat, w: wPt.lon, e: ePt.lon };
  progress(0.02, 'Pobieranie danych terenu…');
  let tiles;
  if (mode === 'local'){
    const pts = [];
    for (const b of [bearings[0], bearings[bearings.length >> 1], bearings[bearings.length - 1]]) for (let d = 0; d <= dTo; d += 1) pts.push(destinationPoint(tx.lat, tx.lon, b, d));
    pts.push(nPt, sPt, ePt, wPt);
    const bb = pts.reduce((a, p) => ({ s: Math.min(a.s, p.lat), n: Math.max(a.n, p.lat), w: Math.min(a.w, p.lon), e: Math.max(a.e, p.lon) }), { s: 90, n: -90, w: 180, e: -180 });
    tiles = tilesForBBox(bb.s - 0.01, bb.w - 0.01, bb.n + 0.01, bb.e + 0.01, z);
  } else tiles = tilesForBBox(bounds.s, bounds.w, bounds.n, bounds.e, z);
  if (tiles.length > 400) throw new AppError('input', `Obszar wymaga ${tiles.length} kafli terenu — zmniejsz promień.`);
  // Brakujące kafle NIE przerywają obliczeń: dotknięte promienie są oznaczane jako „brak danych”, nie „brak zasięgu”.
  let done = 0, failedTiles = 0;
  await Promise.all(tiles.map(t => getTile(t.x, t.y, { signal, online, z: t.z }).catch(err => { if (err?.kind === 'aborted' || signal?.aborted) throw err; failedTiles++; })
    .finally(() => { done++; progress(0.02 + 0.38 * done / tiles.length, `Dane terenu: ${done}/${tiles.length}`); })));
  if (signal?.aborted) throw new AppError('aborted');
  if (failedTiles === tiles.length) throw new AppError(online ? 'badresponse' : 'offline', online ? 'Nie udało się pobrać danych terenu.' : 'Offline i brak zapisanych danych terenu dla tego obszaru.');
  const nS = Math.floor(dTo / step) + 1;
  const ds = Float64Array.from({ length: nS }, (_, i) => i * step);
  const evalFrom = Math.max(1, Math.floor(dFrom / step));
  const fields = new Array(bearings.length);
  const e = new Float64Array(nS), lats = new Float64Array(nS), lons = new Float64Array(nS);
  const evalK = useP ? Math.max(1, Math.round((mode === 'local' ? 0.05 : Math.max(0.3, R / 140)) / step)) : 1;
  let clutterRays = 0, rayCount = 0, maxProfilePts = 0;
  const t0 = Date.now();
  const coverAllowed = useP && clutter && ((bounds.n - bounds.s) / 0.25 + 1) * ((bounds.e - bounds.w) / 0.25 + 1) <= 160;
  const txAlt = (txGround ?? NaN) + txHeightM;
  for (let r = 0; r < bearings.length; r++){
    if (signal?.aborted) throw new AppError('aborted');
    let firstBad = nS;
    for (let i = 0; i < nS; i++){ const p = destinationPoint(tx.lat, tx.lon, bearings[r], ds[i]); lats[i] = p.lat; lons[i] = p.lon; e[i] = elevationSync(p.lat, p.lon, z); if (!Number.isFinite(e[i]) && i < firstBad && i > 0) firstBad = i; }
    if (Number.isFinite(txGround)) e[0] = txGround;
    const rel = antGainAt(gains, bearings[r]);
    const out = new Float32Array(nS).fill(NaN);
    rayCount++;
    if (!useP){
      const ok = firstBad; // za pierwszą dziurą w danych — brak danych
      const sub = n => n.slice ? n.slice(0, ok) : n;
      if (ok > evalFrom){ const f = rayFieldStrengths({ d: sub(ds), e: sub(e), txAlt: Number.isFinite(txAlt) ? txAlt : e[0] + txHeightM, rxHeightM, freqMHz, erpKw, antRelDb: rel, evalFrom }).field; out.set(f.subarray(0, ok)); }
    } else {
      let cover = null;
      if (coverAllowed){
        try { const c = await coverForPoints(lats, lons, { signal, online }); if (c.coverage > 0.5){ cover = c.cover; clutterRays++; } } catch (err){ if (err?.kind === 'aborted') throw err; }
      }
      const nodes = [];
      for (let j = Math.max(5, evalFrom - evalK); j < Math.min(nS, firstBad); j += evalK) nodes.push(j);
      const last = Math.min(nS, firstBad) - 1;
      if (last >= 5 && nodes[nodes.length - 1] !== last) nodes.push(last);
      for (const j of nodes){
        const nd = areaNodeField({ ds, e, lats, lons, cover, j, rxHeightM, txHeightM, txGroundM: e[0], freqMHz, pol, erpKw, antRelDb: rel });
        out[j] = nd.E; if (nd.points > maxProfilePts) maxProfilePts = nd.points;
      }
      if (nodes.length) fillBetweenNodes(out, nodes, evalFrom);
    }
    fields[r] = { out, firstBad };
    if (r % 6 === 0){ progress(0.4 + 0.55 * r / bearings.length, `Obliczenia: ${Math.round(100 * r / bearings.length)}%`); await new Promise(res => setTimeout(res, 0)); }
  }
  // Siatka wartości (Mercator) + maska.
  const H = W; const field = new Float32Array(W * H).fill(NaN), mask = new Uint8Array(W * H);
  const y0 = mercY(bounds.n), y1 = mercY(bounds.s);
  const minB = bearings[0], span = mode === 'local' ? angleDiff(bearings[0], bearings[bearings.length - 1]) : 360;
  for (let py = 0; py < H; py++){
    const lat = latFromMercY(y0 + (y1 - y0) * (py + 0.5) / H);
    for (let px = 0; px < W; px++){
      const lon = bounds.w + (bounds.e - bounds.w) * (px + 0.5) / W;
      const p = { lat, lon };
      if (distanceKm(center, p) > R) continue;
      const d = distanceKm(tx, p);
      if (d < dFrom || d > dTo) continue;
      const b = azimuthDeg(tx, p);
      let ri;
      if (mode === 'local'){ const a = angleDiff(minB, b); if (a < 0 || a > span) continue; ri = Math.round(a / span * (bearings.length - 1)); }
      else ri = Math.round(b / (360 / bearings.length)) % bearings.length;
      const si = Math.min(nS - 1, Math.round(d / step)), f = fields[ri], v = f.out[si], i = py * W + px;
      if (si >= f.firstBad || !Number.isFinite(v)){ mask[i] = si >= f.firstBad ? MASK.NODATA : MASK.OUTSIDE; continue; }
      field[i] = v; mask[i] = MASK.OK;
    }
  }
  progress(1, 'Gotowe');
  const clutterNote = !useP ? null : !clutter ? 'wyłączony w ustawieniach' : clutterRays === rayCount ? 'CORINE 2018' : clutterRays ? `CORINE 2018 na ${Math.round(100 * clutterRays / rayCount)}% promieni` : 'brak danych CORINE — teren goły';
  return { width: W, height: H, field, mask, bounds, center, radiusKm: R, mode, demZoom: z, demResolutionM: demResolutionM(z, center.lat), demSource: DEM_SOURCE, stepKm: step, nodeStepKm: step * evalK, rays: bearings.length,
    maxProfilePts: maxProfilePts || null, profileLimit: useP ? AREA_MAX_PROFILE_POINTS : null, model: useP ? 'p1812' : 'simple', clutter: clutterNote,
    meta: { failedTiles, totalTiles: tiles.length, clutterMissing: useP && clutter && clutterRays < rayCount, antMissing: !gains }, ms: Date.now() - t0 };
}
