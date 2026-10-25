// Węzeł mapy zasięgu = analiza punktu na tym samym profilu (bez DOM, testowalne).
// Profil promienia: ds[0] = nadajnik (0 km), ds[j] = punkt odbioru. P.1812 dostaje profil w kolejności odbiornik→nadajnik.
import { p1812OnProfile } from './propagation.js';

export const AREA_MAX_PROFILE_POINTS = 300;

/**
 * Indeksy profilu 0..j (zwracane od j do 0) zredukowane do ≤ maxPts punktów BEZ gubienia przeszkód:
 * w każdym przedziale zachowany jest punkt o największej wysokości (wierzchołek), końce zawsze zachowane.
 */
export function reduceProfileIdx(j, e, maxPts = AREA_MAX_PROFILE_POINTS){
  if (j + 1 <= maxPts){ const idx = []; for (let i = j; i >= 0; i--) idx.push(i); return idx; }
  const inner = maxPts - 2, size = (j - 1) / inner, idx = [j];
  for (let b = 0; b < inner; b++){
    const lo = 1 + Math.floor(b * size), hi = Math.min(j - 1, Math.floor((b + 1) * size));
    let best = lo; for (let i = lo; i <= hi; i++) if (e[i] > e[best]) best = i;
    idx.push(best);
  }
  idx.push(0);
  const out = [...new Set(idx)].sort((a, b) => b - a);
  return out;
}

/** Natężenie pola [dBµV/m] w węźle j promienia (P.1812). Zwraca też liczbę punktów profilu i składniki. */
export function areaNodeField({ ds, e, lats, lons, cover = null, j, rxHeightM, txHeightM, txGroundM, freqMHz, pol = 'H', erpKw, antRelDb = 0, maxPts = AREA_MAX_PROFILE_POINTS }){
  const idx = reduceProfileIdx(j, e, maxPts);
  const m = idx.length, pd = new Float64Array(m), pe = new Float64Array(m), pla = new Float64Array(m), plo = new Float64Array(m), pc = cover ? new Int16Array(m) : null;
  for (let k = 0; k < m; k++){ const i = idx[k]; pd[k] = ds[j] - ds[i]; pe[k] = e[i]; pla[k] = lats[i]; plo[k] = lons[i]; if (pc) pc[k] = cover[i]; }
  const pr = p1812OnProfile({ d: pd, e: pe, lats: pla, lons: plo, cover: pc, rxHeightM, txHeightM, txGroundM, freqMHz, pol });
  return { E: pr.E1kW + 10 * Math.log10(erpKw) + antRelDb, points: m, prop: pr };
}

/** Interpolacja liniowa między węzłami (osobno testowana). out[nodes] muszą być policzone. */
export function fillBetweenNodes(out, nodes, from){
  for (let i = from; i < nodes[0]; i++) out[i] = out[nodes[0]];
  for (let q = 0; q + 1 < nodes.length; q++){
    const a = nodes[q], b = nodes[q + 1];
    for (let i = a + 1; i < b; i++) out[i] = Number.isFinite(out[a]) && Number.isFinite(out[b]) ? out[a] + (out[b] - out[a]) * (i - a) / (b - a) : NaN;
  }
  return out;
}
