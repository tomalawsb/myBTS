// Model geometrii trasy i uproszczony model propagacji DVB-T/T2 Point.
// JEDNO źródło obliczeń dla profilu terenu, oceny punktu i mapy zasięgu.
//
// Model ("model uproszczony", NIE jest to ITM/Longley-Rice ani ITU-R P.1546):
//  * pole w wolnej przestrzeni z mocy ERP (dipol półfalowy):
//      E[dBµV/m] = 106,92 + 10·log10(ERP[kW]) + G_ANT_rel[dB] − 20·log10(d[km]) − L_dyfr[dB]
//  * krzywizna Ziemi z refrakcją standardową (współczynnik k = 4/3),
//  * strata dyfrakcyjna: metoda Deygouta (maks. 3 krawędzie) z funkcją J(v) wg ITU-R P.526,
//  * brak dodatkowych "kar" za ten sam teren (bez podwójnego liczenia),
//  * brak budynków, drzew, odbić, zaników czasowych i statystyki lokalizacji.
export const K_FACTOR = 4 / 3;
export const R_EARTH_M = 6371000;
export const C_MHZ_M = 299.792458; // λ[m] = C / f[MHz]

export function wavelengthM(freqMHz){ return C_MHZ_M / freqMHz; }
/** Wybrzuszenie Ziemi [m] dla odległości d1,d2 [km] przy współczynniku k. */
export function earthBulgeM(d1Km, d2Km, k = K_FACTOR){ return (d1Km * 1000) * (d2Km * 1000) / (2 * k * R_EARTH_M); }
/** Promień pierwszej strefy Fresnela [m]. */
export function fresnelRadiusM(freqMHz, d1Km, d2Km){
  const d1 = d1Km * 1000, d2 = d2Km * 1000;
  if (d1 <= 0 || d2 <= 0) return 0;
  return Math.sqrt(wavelengthM(freqMHz) * d1 * d2 / (d1 + d2));
}
/** Strata dyfrakcji na pojedynczej krawędzi J(v) [dB], ITU-R P.526 (wzór przybliżony, v > −0,78). */
export function knifeEdgeLossDb(v){
  if (!(v > -0.78)) return 0;
  return 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}

/** Największy parametr v na odcinku (a,b) tablic d[km] (rosnąco), e[m n.p.m.]. */
export function maxEdge(d, e, a, b, altA, altB, lambda, k = K_FACTOR){
  let best = { v: -Infinity, idx: -1, h: -Infinity };
  const D = d[b] - d[a];
  if (b - a < 2 || D <= 0) return best;
  for (let i = a + 1; i < b; i++){
    const d1 = d[i] - d[a], d2 = d[b] - d[i];
    if (d1 <= 0 || d2 <= 0) continue;
    const bulge = (d1 * 1000) * (d2 * 1000) / (2 * k * R_EARTH_M);
    const line = altA + (altB - altA) * (d1 / D);
    const h = e[i] + bulge - line; // dodatnie = przeszkoda ponad linią
    const v = h * Math.sqrt((2 / lambda) * (1 / (d1 * 1000) + 1 / (d2 * 1000)));
    if (v > best.v) best = { v, idx: i, h };
  }
  return best;
}

/** Strata dyfrakcyjna Deygouta (krawędź główna + po jednej z każdej strony). */
export function deygoutLossDb(d, e, a, b, altA, altB, lambda, k = K_FACTOR){
  const main = maxEdge(d, e, a, b, altA, altB, lambda, k);
  if (!(main.v > -0.78)) return { lossDb: 0, main };
  const m = main.idx, altM = e[m];
  let loss = knifeEdgeLossDb(main.v);
  // Krawędzie boczne liczymy tylko, gdy krawędź główna wystaje ponad linię (v > 0);
  // przy samym naruszeniu strefy Fresnela wierzchołek pod linią nie jest punktem pośrednim trasy.
  if (!(main.v > 0)) return { lossDb: loss, main };
  const left = maxEdge(d, e, a, m, altA, altM, lambda, k);
  const right = maxEdge(d, e, m, b, altM, altB, lambda, k);
  if (left.v > -0.78) loss += knifeEdgeLossDb(left.v);
  if (right.v > -0.78) loss += knifeEdgeLossDb(right.v);
  return { lossDb: loss, main };
}

/**
 * Pełna analiza trasy odbiornik → nadajnik. d[0]=0 to punkt odbioru, d[n-1] to nadajnik.
 * Zwraca dane dla wykresu i oceny z tych samych założeń.
 */
export function analyzePath({ d, e, rxHeightM, txHeightM, txGroundM = null, freqMHz, k = K_FACTOR }){
  const n = d.length;
  if (n < 3) throw new Error('Za mało próbek profilu.');
  if (!(freqMHz > 0)) throw new Error('Brak częstotliwości emisji.');
  if (!(txHeightM > 0)) throw new Error('Brak wysokości anteny nadawczej.');
  const D = d[n - 1];
  const lambda = wavelengthM(freqMHz);
  const rxGround = e[0];
  const txGroundDem = e[n - 1];
  const txGround = Number.isFinite(txGroundM) ? txGroundM : txGroundDem;
  const rxAlt = rxGround + rxHeightM, txAlt = txGround + txHeightM;
  // Kopia profilu z wymuszonymi wysokościami końców (spójnie z wysokością obiektu z bazy).
  const ee = Float64Array.from(e); ee[n - 1] = txGround;
  const bulge = new Float64Array(n), eff = new Float64Array(n), los = new Float64Array(n), f1 = new Float64Array(n), clr = new Float64Array(n);
  let minClr = Infinity, minClrIdx = -1, minRatio = Infinity, minRatioIdx = -1;
  for (let i = 0; i < n; i++){
    const d1 = d[i], d2 = D - d[i];
    bulge[i] = earthBulgeM(d1, d2, k);
    eff[i] = ee[i] + bulge[i];
    los[i] = rxAlt + (txAlt - rxAlt) * (d1 / D);
    f1[i] = fresnelRadiusM(freqMHz, d1, d2);
    clr[i] = los[i] - eff[i];
    if (i > 0 && i < n - 1){
      if (clr[i] < minClr){ minClr = clr[i]; minClrIdx = i; }
      const r = f1[i] > 0 ? clr[i] / f1[i] : Infinity;
      if (r < minRatio){ minRatio = r; minRatioIdx = i; }
    }
  }
  const dey = deygoutLossDb(d, ee, 0, n - 1, rxAlt, txAlt, lambda, k);
  const losBlocked = minClr < 0;
  const fresnelOk = minRatio >= 0.6;
  const status = losBlocked ? 'blocked' : (fresnelOk ? 'clear' : 'fresnel');
  const mainIdx = dey.main.idx >= 0 ? dey.main.idx : minRatioIdx;
  const obstacle = mainIdx > 0 ? {
    idx: mainIdx,
    distFromRxKm: d[mainIdx],
    groundM: ee[mainIdx],
    clearanceM: clr[mainIdx],
    fresnelRatio: f1[mainIdx] > 0 ? clr[mainIdx] / f1[mainIdx] : null,
    v: dey.main.v
  } : null;
  return {
    n, distanceKm: D, k, freqMHz, lambdaM: lambda,
    rxGround, txGround, txGroundDem, rxAlt, txAlt, rxHeightM, txHeightM,
    bulge, eff, los, f1, clr,
    minClearanceM: minClr, minClearanceKm: minClrIdx > 0 ? d[minClrIdx] : null,
    minFresnelRatio: minRatio,
    losBlocked, fresnelOk, status,
    diffractionLossDb: dey.lossDb, obstacle
  };
}

/** Natężenie pola [dBµV/m] z ERP [kW]. */
export function fieldStrengthDbuvm({ erpKw, distanceKm, antRelDb = 0, excessLossDb = 0 }){
  if (!(erpKw > 0)) return null;
  const dk = Math.max(0.05, distanceKm);
  return 106.92 + 10 * Math.log10(erpKw) + antRelDb - 20 * Math.log10(dk) - excessLossDb;
}
export const erpToEirpDbW = erpKw => 10 * Math.log10(erpKw * 1000) + 2.15;

/** Moc na wejściu odbiornika [dBm] z natężenia pola, zysku anteny [dBi] i strat kabla [dB]. */
export function receiverPowerDbm(eDbuvm, freqMHz, gainDbi, cableLossDb){
  return eDbuvm + gainDbi - 20 * Math.log10(freqMHz) - 77.2 - cableLossDb;
}
export const dbmToDbuv75 = p => p + 108.75;

// Wymagany C/N (przybliżony; kanał Rice, wartości teoretyczne + margines implementacji).
export const SYSTEM_PRESETS = {
  'dvbt2-256qam-23': { label: 'DVB-T2 256-QAM 2/3', cnDb: 19.0, implDb: 2, bwMHz: 7.77, note: 'C/N orientacyjny (ETSI TR 102 831, kanał Rice), ±1 dB' },
  'dvbt2-64qam-23': { label: 'DVB-T2 64-QAM 2/3', cnDb: 14.5, implDb: 2, bwMHz: 7.77, note: 'C/N orientacyjny (ETSI TR 102 831, kanał Rice), ±1 dB' },
  'dvbt-64qam-34': { label: 'DVB-T 64-QAM 3/4', cnDb: 18.6, implDb: 3, bwMHz: 7.61, note: 'ETSI EN 300 744, tab. A.1, kanał Rice' },
  'dvbt-64qam-23': { label: 'DVB-T 64-QAM 2/3', cnDb: 17.1, implDb: 3, bwMHz: 7.61, note: 'ETSI EN 300 744, tab. A.1, kanał Rice' }
};
export const DEFAULT_RX = { preset: 'dvbt2-256qam-23', gainUhfDbi: 10, gainVhfDbi: 7, cableLossDb: 3, noiseFigureDb: 6 };

/** Minimalne natężenie pola [dBµV/m] dla zadanych założeń instalacji odbiorczej. */
export function minFieldStrength(freqMHz, rx = DEFAULT_RX){
  const p = SYSTEM_PRESETS[rx.preset] || SYSTEM_PRESETS[DEFAULT_RX.preset];
  const noiseDbm = -174 + 10 * Math.log10(p.bwMHz * 1e6) + rx.noiseFigureDb;
  const pMin = noiseDbm + p.cnDb + p.implDb;
  const gain = freqMHz < 300 ? rx.gainVhfDbi : rx.gainUhfDbi;
  return { eMin: pMin - gain + rx.cableLossDb + 20 * Math.log10(freqMHz) + 77.2, pMinDbm: pMin, gainDbi: gain, preset: p };
}

// Skala wyniku: zapas natężenia pola ponad minimum (z modelu i założeń instalacji).
export const MARGIN_BANDS = [
  { id: 'none', min: -Infinity, label: 'Poniżej minimum', short: 'brak', color: '#C62828', pattern: 'cross' },
  // Progi uwzględniają zmienność lokalizacyjną (σ ≈ 5,5 dB): 0 dB = odbiór w ~50% miejsc, +10 dB ≈ 95%, +20 dB — pewny z zapasem na zaniki.
  { id: 'marginal', min: 0, label: 'Na granicy / słaby', short: 'granica', color: '#E0A100', pattern: 'diag' },
  { id: 'good', min: 10, label: 'Dobry zapas', short: 'dobry', color: '#2E9D5B', pattern: 'none' },
  { id: 'strong', min: 20, label: 'Duży zapas', short: 'duży', color: '#156B3A', pattern: 'none' }
];
export function marginBand(marginDb){
  let b = MARGIN_BANDS[0];
  if (!Number.isFinite(marginDb)) return b;
  for (const x of MARGIN_BANDS) if (marginDb >= x.min) b = x;
  return b;
}

/** Ocena odbioru w punkcie: wynik pochodzi z JEDNEJ analizy trasy (ta sama co wykres). */
export function assessPoint({ path, erpKw, antRelDb = 0, antStatus = 'none', rx = DEFAULT_RX, prop = null }){
  // prop = wynik modelu ITU-R P.1812 (propagation.js) — natężenie pola dla 1 kW; bez prop — model uproszczony (Deygout).
  const E = prop ? (erpKw > 0 ? prop.E1kW + 10 * Math.log10(erpKw) + antRelDb : null)
    : fieldStrengthDbuvm({ erpKw, distanceKm: path.distanceKm, antRelDb, excessLossDb: path.diffractionLossDb });
  if (E == null) return { ok: false, reason: 'Brak mocy ERP w bazie — nie można policzyć poziomu sygnału.' };
  const min = minFieldStrength(path.freqMHz, rx);
  const margin = E - min.eMin;
  const p = receiverPowerDbm(E, path.freqMHz, min.gainDbi, rx.cableLossDb);
  return {
    ok: true, fieldDbuvm: E, eMin: min.eMin, marginDb: margin, band: marginBand(margin),
    rxPowerDbm: p, rxLevelDbuv: dbmToDbuv75(p), gainDbi: min.gainDbi,
    antRelDb, antStatus, diffractionLossDb: path.diffractionLossDb, pathStatus: path.status,
    model: prop ? 'p1812' : 'simple', excessLossDb: prop ? prop.excessLossDb : path.diffractionLossDb, rxClutterLossDb: prop ? prop.rxClutterLossDb : 0
  };
}

/** Promień analizy obszaru: horyzont radiowy k=4/3 dla wysokości efektywnej + 10 km (maks. 100 km). */
export function areaRadiusKm(txHeightAglM, siteElevM, rxHeightM = 10){
  const heff = Math.max(10, txHeightAglM + Math.max(0, (Number.isFinite(siteElevM) ? siteElevM : 200) - 200));
  const horizon = 4.12 * (Math.sqrt(heff) + Math.sqrt(rxHeightM));
  return Math.max(15, Math.min(100, Math.round(horizon + 10)));
}

/**
 * Obliczenia wzdłuż promienia od nadajnika: d[0]=0 = nadajnik (txAlt), punkty odbioru w kolejnych próbkach.
 * Zwraca dla wskazanych indeksów natężenie pola. Te same funkcje co analiza punktu.
 */
export function rayFieldStrengths({ d, e, txAlt, rxHeightM, freqMHz, erpKw, antRelDb = 0, evalFrom = 1, k = K_FACTOR }){
  const lambda = wavelengthM(freqMHz);
  const out = new Float32Array(d.length).fill(NaN);
  const stat = new Uint8Array(d.length); // 0 clear,1 fresnel,2 blocked
  for (let j = Math.max(1, evalFrom); j < d.length; j++){
    const rxAlt = e[j] + rxHeightM;
    const dey = deygoutLossDb(d, e, 0, j, txAlt, rxAlt, lambda, k);
    out[j] = fieldStrengthDbuvm({ erpKw, distanceKm: d[j], antRelDb, excessLossDb: dey.lossDb });
    stat[j] = dey.main.h > 0 ? 2 : (dey.main.v > -0.6 * Math.SQRT2 ? 1 : 0); // jak w analyzePath: 60% F1
  }
  return { field: out, stat };
}
