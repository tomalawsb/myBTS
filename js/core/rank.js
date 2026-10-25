// Ocena nadajników dla punktu — ZAWSZE dla jednego wybranego typu MUX (bez DOM).
// Te same funkcje RF i ten sam zestaw parametrów co analiza punktu (P.1812 / Deygout wg ustawienia).
import { distanceKm, azimuthDeg } from './geo.js';
import { p1812OnProfile } from './propagation.js';
import { analyzePath, assessPoint, fieldStrengthDbuvm, minFieldStrength, DEFAULT_RX } from './rf.js';
import { emissionOfType } from './txdata.js';
import { ALGO_VERSION } from './version.js';

export const SCAN_RADIUS_KM = 120;
export const SCAN_MAX_CANDIDATES = 14;
const VIS_RANK = { clear: 0, fresnel: 1, blocked: 2 };

export const muxUsable = m => !!m && !m.missing.length && m.erpKw > 0 && m.frequencyMHz > 0 && m.heightM > 0;

/**
 * Kandydaci dla typu MUX: nadajniki w promieniu, które nadają ten MUX.
 * - list: z kompletnymi danymi i zapasem w wolnej przestrzeni ≥ 0 dB (teren może sygnał tylko osłabić), malejąco;
 * - weak: kompletne dane, ale nawet bez terenu zapas < 0 (na pewno poza zasięgiem wg modelu);
 * - noData: brak danych w bazie (moc/częstotliwość/wysokość) — NIE oznacza braku zasięgu.
 */
export function scanCandidates(point, txs, { muxName, radiusKm = SCAN_RADIUS_KM, rx = DEFAULT_RX } = {}){
  const list = [], weak = [], noData = [];
  for (const tx of txs){
    const mux = emissionOfType(tx, muxName);
    if (!mux) continue;
    const d = distanceKm(point, tx);
    if (!(d <= radiusKm)) continue;
    if (!muxUsable(mux)){ noData.push({ tx, mux, distanceKm: d, missing: mux.missing }); continue; }
    const fs = fieldStrengthDbuvm({ erpKw: mux.erpKw, distanceKm: d }) - minFieldStrength(mux.frequencyMHz, rx).eMin;
    (fs >= 0 ? list : weak).push({ tx, mux, distanceKm: d, freeSpaceMarginDb: fs });
  }
  list.sort((a, b) => b.freeSpaceMarginDb - a.freeSpaceMarginDb);
  return { list, weak, noData };
}
export function preselect(point, txs, { muxName, radiusKm = SCAN_RADIUS_KM, rx = DEFAULT_RX, max = SCAN_MAX_CANDIDATES } = {}){
  return scanCandidates(point, txs, { muxName, radiusKm, rx }).list.slice(0, max);
}

/** Ocena JEDNEJ emisji (tx + mux) na gotowym profilu (d[0] = punkt). antRelDb — zysk względny anteny nadawczej w kierunku punktu. */
export function evaluateTx({ tx, mux, profile, point, rxHeightM, rx = DEFAULT_RX, antRelDb = 0, model = 'p1812' }){
  const base = { txId: tx.id, name: tx.name, muxKey: mux?.key ?? null, mux: mux?.name ?? null, channel: mux?.channel ?? null, variant: mux?.variant ?? null,
    distanceKm: distanceKm(point, tx), az: azimuthDeg(point, tx), checked: true };
  if (!muxUsable(mux)) return { ...base, state: 'nodata', inRange: false, marginDb: null, status: null, fieldDbuvm: null };
  const path = analyzePath({ d: profile.d, e: profile.e, rxHeightM, txHeightM: mux.heightM, txGroundM: tx.siteElevationM, freqMHz: mux.frequencyMHz });
  const prop = model === 'p1812' && profile.lats ? p1812OnProfile({ ...profile, rxHeightM, txHeightM: mux.heightM, txGroundM: tx.siteElevationM, freqMHz: mux.frequencyMHz, pol: mux.polarization }) : null;
  if (model === 'p1812' && !prop) return { ...base, state: 'nodata', inRange: false, marginDb: null, status: null, fieldDbuvm: null };
  const r = assessPoint({ path, erpKw: mux.erpKw, antRelDb, rx, prop });
  if (!r.ok) return { ...base, state: 'nodata', inRange: false, marginDb: null, status: null, fieldDbuvm: null };
  return { ...base, state: r.marginDb >= 0 ? 'ok' : 'weak', inRange: r.marginDb >= 0, marginDb: r.marginDb, fieldDbuvm: r.fieldDbuvm, status: path.status, model: r.model };
}

/** Ranking w obrębie jednego MUX: zapas (kroki 3 dB = remis w granicach dokładności), widoczność, dokładny zapas. Brak danych na końcu. */
export function rankResults(list){
  const step = m => Number.isFinite(m) ? Math.floor(m / 3) : -1e9;
  return [...list].sort((a, b) => (step(b.marginDb) - step(a.marginDb)) || ((VIS_RANK[a.status] ?? 3) - (VIS_RANK[b.status] ?? 3)) || ((b.marginDb ?? -1e9) - (a.marginDb ?? -1e9)));
}
export function recommend(list){ const r = rankResults(list.filter(x => x.inRange)); return r[0] || null; }
/** Klucz skanu: punkt, typ MUX, wysokość, odbiornik, baza, model, źródło terenu/klutter, wersja algorytmu. */
export const scanKey = ({ point, muxName, rxHeightM, rx, dataVersion, model = 'p1812', terrain = 'dem', clutter = true }) =>
  `S|${point.lat.toFixed(4)},${point.lon.toFixed(4)}|mux${muxName}|h${rxHeightM}|${JSON.stringify(rx)}|d${dataVersion}|m${model}|t${terrain}|c${clutter ? 1 : 0}|a${ALGO_VERSION}`;
