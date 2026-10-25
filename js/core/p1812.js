// ITU-R P.1812-7 — metoda przewidywania dla usług punkt-obszar (30 MHz–6 GHz) na profilu terenu.
// Port 1:1 części obliczeniowej referencyjnej implementacji Py1812 (I. Stevanovic, OFCOM, licencja BSD-3),
// zweryfikowany na zestawie walidacyjnym ITU-R SG3 (tests/unit/p1812.test.mjs).
// Bez map cyfrowych ITU: ΔN i N0 podawane jako stałe (dla Polski ΔN≈45, N0≈320 N-jednostek — wartości z map P.1812 dla obszaru PL).
// Uwzględnia: wolną przestrzeń, dyfrakcję delta-Bullington (profil + klutter R), kanałowanie/odbicia (anomalous), troposcatter,
// zmienność czasową p% i lokalizacyjną pL% (σL). Strefy: 1 morze, 3 ląd przybrzeżny, 4 ląd.

const log10 = Math.log10, sqrt = Math.sqrt, exp = Math.exp;
const J = nu => nu > -0.78 ? 6.9 + 20 * log10(sqrt((nu - 0.1) ** 2 + 1) + nu - 0.1) : 0;

export function invCumNorm(x){
  x = Math.min(0.999999, Math.max(0.000001, x));
  const T = y => sqrt(-2 * Math.log(y));
  const C = z => { const t = T(z); return ((0.010328 * t + 0.802853) * t + 2.515516698) / (((0.001308 * t + 0.189269) * t + 1.432788) * t + 1); };
  return x <= 0.5 ? T(x) - C(x) : -(T(1 - x) - C(1 - x));
}
function findIntervals(mask){ const s = [], e = []; for (let i = 0; i < mask.length; i++){ if (mask[i] && (i === 0 || !mask[i - 1])) s.push(i); if (mask[i] && (i === mask.length - 1 || !mask[i + 1])) e.push(i); } return [s, e]; }
function sectionLen(d, mask, agg){
  const [st, sp] = findIntervals(mask); let dm = 0; const n = d.length;
  for (let i = 0; i < st.length; i++){
    let delta = 0;
    if (d[sp[i]] < d[n - 1]) delta += (d[sp[i] + 1] - d[sp[i]]) / 2;
    if (d[st[i]] > 0) delta += (d[st[i]] - d[st[i] - 1]) / 2;
    const L = d[sp[i]] - d[st[i]] + delta;
    dm = agg === 'sum' ? dm + L : Math.max(dm, L);
  }
  return dm;
}
export function beta0(phi, dtm, dlm){
  const tau = 1 - exp(-(4.12e-4 * dlm ** 2.41));
  let mu1 = (10 ** (-dtm / (16 - 6.6 * tau)) + 10 ** (-5 * (0.496 + 0.354 * tau))) ** 0.2; if (mu1 > 1) mu1 = 1;
  if (Math.abs(phi) <= 70){ const mu4 = mu1 ** (-0.935 + 0.0176 * Math.abs(phi)); return 10 ** (-0.015 * Math.abs(phi) + 1.67) * mu1 * mu4; }
  return 4.17 * mu1 * mu1 ** 0.3;
}
function greatCirclePoint(lamR, lamT, phiR, phiT, Re, dpnt){
  const r = Math.PI / 180, sd = x => Math.sin(x * r), cd = x => Math.cos(x * r);
  const Dlon = lamR - lamT;
  const rr = sd(phiT) * sd(phiR) + cd(phiT) * cd(phiR) * cd(Dlon);
  const x1 = sd(phiR) - rr * sd(phiT), y1 = cd(phiT) * cd(phiR) * sd(Dlon);
  const Bt2r = Math.abs(x1) < 1e-9 && Math.abs(y1) < 1e-9 ? lamR : Math.atan2(y1, x1) / r;
  const P = dpnt / Re;
  const s = sd(phiT) * Math.cos(P) + cd(phiT) * Math.sin(P) * cd(Bt2r);
  const phi = Math.asin(s) / r;
  const x2 = Math.cos(P) - s * sd(phiT), y2 = cd(phiT) * Math.sin(P) * sd(Bt2r);
  const lam = x2 < 1e-9 && y2 < 1e-9 ? Bt2r : lamT + Math.atan2(y2, x2) / r;
  return { lam, phi };
}
function smoothEarth(d, h, htg, hrg, ae, f){
  const n = d.length, dtot = d[n - 1], hts = h[0] + htg, hrs = h[n - 1] + hrg;
  let v1 = 0, v2 = 0;
  for (let i = 1; i < n; i++){ const dd = d[i] - d[i - 1]; v1 += dd * (h[i] + h[i - 1]); v2 += dd * (h[i] * (2 * d[i] + d[i - 1]) + h[i - 1] * (d[i] + 2 * d[i - 1])); }
  let hst = (2 * v1 * dtot - v2) / dtot ** 2, hsr = (v2 - v1 * dtot) / dtot ** 2;
  let hobs = -Infinity, aot = -Infinity, aor = -Infinity;
  for (let i = 1; i < n - 1; i++){ const HH = h[i] - (hts * (dtot - d[i]) + hrs * d[i]) / dtot; hobs = Math.max(hobs, HH); aot = Math.max(aot, HH / d[i]); aor = Math.max(aor, HH / (dtot - d[i])); }
  const gt = aot / (aot + aor), gr = aor / (aot + aor);
  const hstp = hobs <= 0 ? hst : hst - hobs * gt, hsrp = hobs <= 0 ? hsr : hsr - hobs * gr;
  const hstd = hstp >= h[0] ? h[0] : hstp, hsrd = hsrp > h[n - 1] ? h[n - 1] : hsrp;
  let thMax = -Infinity, lt = 1;
  for (let i = 1; i < n - 1; i++){ const th = 1000 * Math.atan((h[i] - hts) / (1000 * d[i]) - d[i] / (2 * ae)); if (th > thMax){ thMax = th; lt = i; } }
  const thTd = 1000 * Math.atan((hrs - hts) / (1000 * dtot) - dtot / (2 * ae));
  const thRd = 1000 * Math.atan((hts - hrs) / (1000 * dtot) - dtot / (2 * ae));
  const pathtype = thMax > thTd ? 2 : 1;
  const thetaT = Math.max(thMax, thTd);
  let thetaR, dlt, dlr, lr;
  if (pathtype === 2){
    dlt = d[lt]; let tr = -Infinity;
    for (let i = 1; i < n - 1; i++){ const th = 1000 * Math.atan((h[i] - hrs) / (1000 * (dtot - d[i])) - (dtot - d[i]) / (2 * ae)); if (th >= tr){ tr = th; lr = i; } }
    thetaR = tr; dlr = dtot - d[lr];
  } else {
    thetaR = thRd; const lam = 0.2998 / f, Ce = 1 / ae; let nm = -Infinity;
    for (let i = 1; i < n - 1; i++){ const nu = (h[i] + 500 * Ce * d[i] * (dtot - d[i]) - (hts * (dtot - d[i]) + hrs * d[i]) / dtot) * sqrt(0.002 * dtot / (lam * d[i] * (dtot - d[i]))); if (nu >= nm){ nm = nu; lt = i; } }
    dlt = d[lt]; dlr = dtot - dlt; lr = lt;
  }
  const theta = 1e3 * dtot / ae + thetaT + thetaR;
  hst = Math.min(hst, h[0]); hsr = Math.min(hsr, h[n - 1]);
  const m = (hsr - hst) / dtot, hte = htg + h[0] - hst, hre = hrg + h[n - 1] - hsr;
  let hm = -Infinity; for (let i = lt; i <= lr; i++) hm = Math.max(hm, h[i] - (hst + m * d[i]));
  return { hstd, hsrd, hte, hre, hm, dlt, dlr, thetaT, thetaR, theta, pathtype };
}
function dlBull(d, g, hts, hrs, ap, f){
  const Ce = 1 / ap, lam = 0.2998 / f, n = d.length, dtot = d[n - 1] - d[0];
  let Stim = -Infinity; for (let i = 1; i < n - 1; i++) Stim = Math.max(Stim, (g[i] + 500 * Ce * d[i] * (dtot - d[i]) - hts) / d[i]);
  const Str = (hrs - hts) / dtot; let Luc;
  if (Stim < Str){
    let nm = -Infinity; for (let i = 1; i < n - 1; i++) nm = Math.max(nm, (g[i] + 500 * Ce * d[i] * (dtot - d[i]) - (hts * (dtot - d[i]) + hrs * d[i]) / dtot) * sqrt(0.002 * dtot / (lam * d[i] * (dtot - d[i]))));
    Luc = J(nm);
  } else {
    let Srim = -Infinity; for (let i = 1; i < n - 1; i++) Srim = Math.max(Srim, (g[i] + 500 * Ce * d[i] * (dtot - d[i]) - hrs) / (dtot - d[i]));
    const dbp = (hrs - hts + Srim * dtot) / (Stim + Srim);
    Luc = J((hts + Stim * dbp - (hts * (dtot - dbp) + hrs * dbp) / dtot) * sqrt(0.002 * dtot / (lam * dbp * (dtot - dbp))));
  }
  return Luc + (1 - exp(-Luc / 6)) * (10 + 0.02 * dtot);
}
function dlSeFtInner(er, sg, d, hte, hre, adft, f){
  const out = [];
  const K0 = 0.036 * (adft * f) ** (-1 / 3) * ((er - 1) ** 2 + (18 * sg / f) ** 2) ** (-1 / 4);
  for (const K of [K0, K0 * sqrt(er ** 2 + (18 * sg / f) ** 2)]){
    const b = (1 + 1.6 * K ** 2 + 0.67 * K ** 4) / (1 + 4.5 * K ** 2 + 1.53 * K ** 4);
    const X = 21.88 * b * (f / adft ** 2) ** (1 / 3) * d;
    const Y = 0.9575 * b * (f ** 2 / adft) ** (1 / 3);
    const Fx = X >= 1.6 ? 11 + 10 * log10(X) - 17.6 * X : -20 * log10(X) - 5.6488 * X ** 1.425;
    const G = B => Math.max(B > 2 ? 17.6 * (B - 1.1) ** 0.5 - 5 * log10(B - 1.1) - 8 : 20 * log10(B + 0.1 * B ** 3), 2 + 20 * log10(K));
    out.push(-Fx - G(b * Y * hte) - G(b * Y * hre));
  }
  return out;
}
function dlSeFt(d, hte, hre, adft, f, w){ const L = dlSeFtInner(22, 0.003, d, hte, hre, adft, f), S = dlSeFtInner(80, 5, d, hte, hre, adft, f); return [0, 1].map(i => w * S[i] + (1 - w) * L[i]); }
function dlSe(d, hte, hre, ap, f, w){
  const lam = 0.2998 / f, dlos = sqrt(2 * ap) * (sqrt(0.001 * hte) + sqrt(0.001 * hre));
  if (d >= dlos) return dlSeFt(d, hte, hre, ap, f, w);
  const c = (hte - hre) / (hte + hre), m = 250 * d * d / (ap * (hte + hre));
  const b = 2 * sqrt((m + 1) / (3 * m)) * Math.cos(Math.PI / 3 + Math.acos(3 * c / 2 * sqrt(3 * m / (m + 1) ** 3)) / 3);
  const d1 = d / 2 * (1 + b), d2 = d - d1;
  const hse = ((hte - 500 * d1 * d1 / ap) * d2 + (hre - 500 * d2 * d2 / ap) * d1) / d;
  const hreq = 17.456 * sqrt(d1 * d2 * lam / d);
  if (hse > hreq) return [0, 0];
  const aem = 500 * (d / (sqrt(hte) + sqrt(hre))) ** 2;
  return dlSeFt(d, hte, hre, aem, f, w).map(x => (1 - hse / hreq) * Math.max(0, x));
}
function dlDeltaBull(d, g, hts, hrs, hstd, hsrd, ap, f, w){
  const Lbulla = dlBull(d, g, hts, hrs, ap, f);
  const hts1 = hts - hstd, hrs1 = hrs - hsrd;
  const Lbulls = dlBull(d, new Float64Array(d.length), hts1, hrs1, ap, f);
  const Ldsph = dlSe(d[d.length - 1] - d[0], hts1, hrs1, ap, f, w);
  return { Ld: Ldsph.map(x => Lbulla + Math.max(x - Lbulls, 0)), Lbulla, Lbulls, Ldsph };
}
function tlAnomalous(dtot, dlt, dlr, dct, dcr, dlm, hts, hrs, hte, hre, hm, thT, thR, f, p, w, ae, b0){
  const Alf = f < 0.5 ? 45.375 - 137 * f + 92.5 * f * f : 0;
  const t2 = thT - 0.1 * dlt, r2 = thR - 0.1 * dlr;
  const Ast = t2 > 0 ? 20 * log10(1 + 0.361 * t2 * sqrt(f * dlt)) + 0.264 * t2 * f ** (1 / 3) : 0;
  const Asr = r2 > 0 ? 20 * log10(1 + 0.361 * r2 * sqrt(f * dlr)) + 0.264 * r2 * f ** (1 / 3) : 0;
  const Act = dct <= 5 && dct <= dlt && w >= 0.75 ? -3 * exp(-0.25 * dct * dct) * (1 + Math.tanh(0.07 * (50 - hts))) : 0;
  const Acr = dcr <= 5 && dcr <= dlr && w >= 0.75 ? -3 * exp(-0.25 * dcr * dcr) * (1 + Math.tanh(0.07 * (50 - hrs))) : 0;
  const gd = 5e-5 * ae * f ** (1 / 3);
  const t1 = thT > 0.1 * dlt ? 0.1 * dlt : thT, r1 = thR > 0.1 * dlr ? 0.1 * dlr : thR;
  const th1 = 1e3 * dtot / ae + t1 + r1;
  const dI = Math.min(dtot - dlt - dlr, 40);
  const mu3 = hm > 10 ? exp(-4.6e-5 * (hm - 10) * (43 + 6 * dI)) : 1;
  const tau = 1 - exp(-(4.12e-4 * dlm ** 2.41));
  const alpha = Math.max(-3.4, -0.6 - 3.5e-9 * dtot ** 3.1 * tau);
  const mu2 = Math.min(1, (500 / ae * dtot ** 2 / (sqrt(hte) + sqrt(hre)) ** 2) ** alpha);
  const beta = b0 * mu2 * mu3, lb = log10(beta);
  const Gam = 1.076 / (2.0058 - lb) ** 1.012 * exp(-(9.51 - 4.8 * lb + 0.198 * lb * lb) * 1e-6 * dtot ** 1.13);
  const Ap = -12 + (1.2 + 3.7e-3 * dtot) * log10(p / beta) + 12 * (p / beta) ** Gam;
  return 102.45 + 20 * log10(f) + 20 * log10(dlt + dlr) + Alf + Ast + Asr + Act + Acr + gd * th1 + Ap;
}

/**
 * Tłumienność podstawowa Lb [dB] i natężenie pola E [dBµV/m] (dla ERP = Ptx kW) wg ITU-R P.1812.
 * f [GHz], p [% czasu 1–50], d [km] rosnąco od nadajnika (d[0]=0), h [m n.p.m.], R [m] wysokości klutteru, zone (1/3/4),
 * htg/hrg [m n.p.t.], pol 1=H 2=V, współrzędne końców [deg].
 */
export function p1812({ f, p = 50, d, h, R = null, zone = null, htg, hrg, pol = 1, phiT, phiR, lamT, lamR, pL = 50, sigmaL = 0, Ptx = 1, DN = 45, N0 = 320, dct = 500, dcr = 500 }){
  const n = d.length;
  if (n <= 4) throw new Error('P.1812: za mało punktów profilu.');
  if (!(p >= 1 && p <= 50)) throw new Error('P.1812: p musi być w zakresie 1–50%.');
  if (!(htg >= 1 && hrg >= 1)) throw new Error('P.1812: wysokości anten ≥ 1 m.');
  R = R || new Float64Array(n); zone = zone || new Array(n).fill(4);
  if (zone[0] === 1) dct = 0; if (zone[n - 1] === 1) dcr = 0;
  const mid = greatCirclePoint(lamR, lamT, phiR, phiT, 6371, 0.5 * (d[n - 1] - d[0]));
  const dtm = sectionLen(d, zone.map(z => z === 3 || z === 4), 'max');
  const dlm = sectionLen(d, zone.map(z => z === 4), 'max');
  const b0 = beta0(mid.phi, dtm, dlm);
  const ae = 6371 * 157 / (157 - DN), ab = 6371 * 3;
  const w = sectionLen(d, zone.map(z => z === 1), 'sum') / (d[n - 1] - d[0]);
  const se = smoothEarth(d, h, htg, hrg, ae, f);
  const dtot = d[n - 1] - d[0], hts = h[0] + htg, hrs = h[n - 1] + hrg;
  const g = Float64Array.from(h, (x, i) => x + R[i]); g[0] = h[0]; g[n - 1] = h[n - 1];
  const Fj = 1 - 0.5 * (1 + Math.tanh(3 * 0.8 * (se.theta - 0.3) / 0.3));
  const Fk = 1 - 0.5 * (1 + Math.tanh(3 * 0.5 * (dtot - 20) / 20));
  const Lbfs = 92.4 + 20 * log10(f) + 10 * log10(dtot ** 2 + ((hts - hrs) / 1000) ** 2);
  const Es = q => 2.6 * (1 - exp(-0.1 * (se.dlt + se.dlr))) * log10(q / 50);
  const Lb0p = Lbfs + Es(p), Lb0b = Lbfs + Es(b0);
  const D50 = dlDeltaBull(d, g, hts, hrs, se.hstd, se.hsrd, ae, f, w);
  const Ld50 = D50.Ld;
  let Ldp = Ld50;
  if (p < 50){
    const Db = dlDeltaBull(d, g, hts, hrs, se.hstd, se.hsrd, ab, f, w);
    const Fi = p > b0 ? invCumNorm(p / 100) / invCumNorm(b0 / 100) : 1;
    Ldp = Ld50.map((x, i) => x + Fi * (Db.Ld[i] - x));
  }
  const Lbd50 = Ld50.map(x => Lbfs + x), Lbd = Ldp.map(x => Lb0p + x);
  let Lminb0p = Ldp.map(x => Lb0p + (1 - w) * x);
  if (p >= b0){ const Fi = invCumNorm(p / 100) / invCumNorm(b0 / 100); Lminb0p = Ldp.map((x, i) => Lbd50[i] + (Lb0b + (1 - w) * x - Lbd50[i]) * Fi); }
  const Lba = tlAnomalous(dtot, se.dlt, se.dlr, dct, dcr, dlm, hts, hrs, se.hte, se.hre, se.hm, se.thetaT, se.thetaR, f, p, w, ae, b0);
  const Lminbap = 2.5 * Math.log(exp(Lba / 2.5) + exp(Lb0p / 2.5));
  const Lbda = Lbd.map(x => Lminbap <= x ? Lminbap + (x - Lminbap) * Fk : x);
  const Lbam = Lbda.map((x, i) => x + (Lminb0p[i] - x) * Fj);
  const Lbs = 190.1 + 25 * log10(f) - 2.5 * log10(f / 2) ** 2 + 20 * log10(dtot) + 0.573 * se.theta - 0.15 * N0 - 10.125 * log10(50 / p) ** 0.7;
  const Lbc = -5 * log10(10 ** (-0.2 * Lbs) + 10 ** (-0.2 * Lbam[pol - 1]));
  const Lloc = zone[n - 1] === 1 ? 0 : -invCumNorm(pL / 100) * sigmaL;
  const Lb = Math.max(Lb0p, Lbc + Lloc);
  const Ep = 199.36 + 20 * log10(f) - Lb;
  return { Lb, E: Ep + 10 * log10(Ptx), Lbfs, Ld50: Ld50[pol - 1], Lbulla: D50.Lbulla, Lbulls: D50.Lbulls, Ldsph: D50.Ldsph[pol - 1], Lba, Lbs, Lbc, Lloc, b0, pathtype: se.pathtype === 2 ? 'transhorizon' : 'los', thetaMrad: se.theta, dlt: se.dlt, dlr: se.dlr };
}

/** Odchylenie standardowe zmienności lokalizacyjnej (P.1812 §4.8) dla obszaru wa [m]. */
export function sigmaLoc(fGHz, hrg, R, wa = 100){
  const s = (0.52 + 0.024 * fGHz) * wa ** 0.28;
  const uh = hrg < R ? 1 : hrg >= R + 10 ? 0 : 1 - (hrg - R) / 10;
  return s * uh;
}

/** ITU-R P.2108 §3.1 — poprawka wysokościowa klutteru przy terminalu (antena niżej niż klutter R). Zwraca dB (≥ 0 typowo). */
export function p2108TerminalLoss(fGHz, h, R, type = 'urban', ws = 27){
  if (!(R > 0) || h >= R) return 0;
  if (type === 'open' || type === 'rural'){ const Kh2 = 21.8 + 6.2 * log10(fGHz); return -Kh2 * log10(h / R); }
  const hdif = R - h, thetaClut = Math.atan(hdif / ws) * 180 / Math.PI;
  const nu = 0.342 * sqrt(fGHz) * sqrt(hdif * thetaClut);
  return J(nu) - 6.03;
}
