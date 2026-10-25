// Wybór modelu propagacji i obliczenie natężenia pola na profilu (bez DOM).
import { p1812, p2108TerminalLoss, sigmaLoc } from './p1812.js';
import { clutterHeight, radioZone, clcInfo } from './landcover.js';

export const MODELS = {
  p1812: { id: 'p1812', label: 'ITU-R P.1812-7 (zalecany)', short: 'ITU-R P.1812-7',
    note: 'Metoda ITU dla usług punkt-obszar VHF/UHF: dyfrakcja delta-Bullington na profilu z wysokościami klutteru, troposcatter i propagacja anomalna, 50% czasu, 50% lokalizacji; klutter przy odbiorniku wg ITU-R P.2108 §3.1.' },
  simple: { id: 'simple', label: 'Uproszczony — bez pełnego uwzględnienia warunków propagacji', short: 'uproszczony (Deygout)',
    note: 'Wolna przestrzeń + dyfrakcja wielokrawędziowa Deygout (ITU-R P.526) na gołym terenie, k=4/3. Bez klutteru, troposcatteru i zmienności czasowej.' }
};
export const DEFAULT_MODEL = 'p1812';
export const P1812_DEFAULTS = Object.freeze({ p: 50, pL: 50, DN: 45, N0: 320 }); // ΔN, N0 — wartości z map P.1812 dla obszaru Polski (stałe)
export const TERMINAL_CLEAR_M = 150; // bez klutteru w profilu tuż przy odbiorniku — jego wpływ liczy P.2108 (bez podwójnego liczenia)
export const polIndex = pol => pol === 'V' ? 2 : 1; // H (oraz M/brak) → pozioma

/**
 * P.1812 na profilu odbiornik→nadajnik z dem.js (d[0] = odbiornik). Zwraca E dla 1 kW ERP i składniki.
 * cover (opcjonalnie): Int16Array kodów CLC w punktach profilu. Bez cover — klutter 0 (teren goły) i strefa ląd.
 */
export function p1812OnProfile({ d, e, lats, lons, cover = null, rxHeightM, txHeightM, txGroundM, freqMHz, pol = 'H' }){
  const n = d.length, D = d[n - 1];
  const dd = new Float64Array(n), hh = new Float64Array(n), RR = new Float64Array(n), zz = new Array(n);
  for (let i = 0; i < n; i++){
    const j = n - 1 - i; // odwrócenie: P.1812 liczy od nadajnika
    dd[i] = D - d[j]; hh[i] = e[j];
    const code = cover ? cover[j] : 0;
    RR[i] = d[j] * 1000 < TERMINAL_CLEAR_M || (D - d[j]) * 1000 < TERMINAL_CLEAR_M ? 0 : clutterHeight(code);
    zz[i] = cover ? radioZone(code) : 4;
  }
  dd[0] = 0; if (Number.isFinite(txGroundM)) hh[0] = txGroundM;
  const f = freqMHz / 1000;
  const r = p1812({ f, p: P1812_DEFAULTS.p, d: dd, h: hh, R: RR, zone: zz, htg: Math.max(1, txHeightM), hrg: Math.max(1, rxHeightM), pol: polIndex(pol),
    phiT: lats[n - 1], lamT: lons[n - 1], phiR: lats[0], lamR: lons[0], pL: P1812_DEFAULTS.pL, sigmaL: 0, Ptx: 1, DN: P1812_DEFAULTS.DN, N0: P1812_DEFAULTS.N0 });
  const rxInfo = cover ? clcInfo(cover[0]) : null;
  const rxR = rxInfo?.R || 0, rxType = rxInfo?.type || 'open';
  const rxClutterLossDb = rxR > 0 ? Math.max(0, p2108TerminalLoss(f, rxHeightM, rxR, rxType === 'trees' || rxType === 'suburban' ? 'urban' : rxType)) : 0;
  return { E1kW: r.E - rxClutterLossDb, Lb: r.Lb + rxClutterLossDb, lbBase: r.Lb, Lbfs: r.Lbfs, Ld: r.Ld50, Lbs: r.Lbs, Lba: r.Lba, pathtype: r.pathtype,
    rxClutterLossDb, rxCover: rxInfo ? { code: rxInfo.code, label: rxInfo.label, R: rxR } : null,
    clutterUsed: !!cover, sigmaLocDb: sigmaLoc(f, rxHeightM, rxR, 100), excessLossDb: r.Lb + rxClutterLossDb - r.Lbfs };
}
