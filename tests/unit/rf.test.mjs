import test from 'node:test'; import assert from 'node:assert/strict';
import { analyzePath, earthBulgeM, knifeEdgeLossDb, fieldStrengthDbuvm, receiverPowerDbm, minFieldStrength, marginBand, assessPoint, rayFieldStrengths, fresnelRadiusM } from '../../js/core/rf.js';
import { flat, hill } from '../fixtures/profiles.mjs';

test('wybrzuszenie Ziemi k=4/3: 30+30 km ≈ 53 m', () => {
  assert.ok(Math.abs(earthBulgeM(30, 30) - 52.97) < 0.2);
});
test('J(v): v=0 → ~6 dB, v=-1 → 0 dB', () => {
  assert.ok(Math.abs(knifeEdgeLossDb(0) - 6.0) < 0.1);
  assert.equal(knifeEdgeLossDb(-1), 0);
});
test('płaski teren 60 km: profil i wynik bez sprzeczności', () => {
  const p = flat(60);
  const a = analyzePath({ ...p, rxHeightM: 10, txHeightM: 300, freqMHz: 600 });
  assert.equal(a.losBlocked, false);
  // przy antenie 10 m ziemia przy odbiorniku lekko narusza 60% F1 — strata mała i jawna
  assert.ok(a.diffractionLossDb < 3, String(a.diffractionLossDb));
  assert.notEqual(a.status, 'blocked');
  // wykres: linia LOS nad terenem z krzywizną w każdym punkcie
  for (let i = 1; i < a.n - 1; i++) assert.ok(a.los[i] > a.eff[i]);
  const r = assessPoint({ path: a, erpKw: 100 });
  const fs = fieldStrengthDbuvm({ erpKw: 100, distanceKm: 60 });
  assert.ok(Math.abs(r.fieldDbuvm - (fs - a.diffractionLossDb)) < 1e-9, 'jedyna strata ponad wolną przestrzeń = dyfrakcja (bez podwójnych kar)');
  const hi = analyzePath({ ...p, rxHeightM: 60, txHeightM: 300, freqMHz: 600 });
  assert.equal(hi.status, 'clear'); assert.equal(hi.diffractionLossDb, 0);
});
test('płaski teren 60 km z niską anteną: krzywizna blokuje — profil i RF zgodne', () => {
  const p = flat(60);
  const a = analyzePath({ ...p, rxHeightM: 10, txHeightM: 40, freqMHz: 600 });
  assert.equal(a.status, 'blocked');
  assert.ok(a.diffractionLossDb > 6);
  const mid = a.obstacle.distFromRxKm; assert.ok(mid > 15 && mid < 45);
});
test('pojedyncze wzgórze: przeszkoda wskazana z odległością, strata dyfrakcji dodatnia', () => {
  const p = hill(20, 801, 200, 8, 150, 0.6);
  const a = analyzePath({ ...p, rxHeightM: 10, txHeightM: 50, freqMHz: 500 });
  assert.equal(a.status, 'blocked');
  assert.ok(Math.abs(a.obstacle.distFromRxKm - 8) < 0.2);
  assert.ok(a.diffractionLossDb > 10);
});
test('strefa Fresnela oddzielnie od LOS', () => {
  const p = hill(20, 801, 200, 10, 100, 0.5);
  // LOS 10 m nad szczytem: widoczność jest, ale 60% F1 (≈ 0,6·sqrt(0,6·10000·10000/20000)≈33 m) naruszone
  const a = analyzePath({ ...p, rxHeightM: 110 - 200 + 200, txHeightM: 110, freqMHz: 500, k: 1e9 });
  assert.equal(a.losBlocked, false);
  assert.equal(a.status, 'fresnel');
  assert.ok(fresnelRadiusM(500, 10, 10) > 50);
});
test('jednostki: P[dBm] = E + G − 20log f − 77,2; Emin rośnie z f', () => {
  assert.ok(Math.abs(receiverPowerDbm(60, 600, 10, 0) - (60 + 10 - 20*Math.log10(600) - 77.2)) < 1e-9);
  assert.ok(minFieldStrength(700).eMin > minFieldStrength(500).eMin);
  const m = minFieldStrength(600); assert.ok(m.eMin > 35 && m.eMin < 60, String(m.eMin));
});
test('pasma zapasu', () => {
  assert.equal(marginBand(-1).id, 'none'); assert.equal(marginBand(3).id, 'marginal');
  assert.equal(marginBand(12).id, 'good'); assert.equal(marginBand(20).id, 'strong');
});
test('ERP brak → brak wyniku (nie zero)', () => {
  const a = analyzePath({ ...flat(10), rxHeightM: 10, txHeightM: 100, freqMHz: 600 });
  assert.equal(assessPoint({ path: a, erpKw: null }).ok, false);
});
test('promień od nadajnika daje ten sam wynik co analiza punktu', () => {
  const p = hill(30, 601, 150, 12, 120, 1);
  // ścieżka od nadajnika (index 0) = odwrócony profil
  const rev = { d: Float64Array.from(p.d, x => 30 - x).reverse(), e: Float64Array.from(p.e).reverse() };
  const txAlt = rev.e[0] + 100;
  const ray = rayFieldStrengths({ d: rev.d, e: rev.e, txAlt, rxHeightM: 10, freqMHz: 600, erpKw: 10 });
  const a = analyzePath({ ...p, rxHeightM: 10, txHeightM: 100, freqMHz: 600 });
  const pt = assessPoint({ path: a, erpKw: 10 });
  assert.ok(Math.abs(ray.field[rev.d.length - 1] - pt.fieldDbuvm) < 0.01);
});
