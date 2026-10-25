import test from 'node:test'; import assert from 'node:assert/strict';
import { areaNodeField, reduceProfileIdx, fillBetweenNodes } from '../../js/core/areanode.js';
import { p1812OnProfile } from '../../js/core/propagation.js';
import { assessPoint, analyzePath } from '../../js/core/rf.js';
import { destinationPoint } from '../../js/core/geo.js';

// Promień od nadajnika (ds[0] = nadajnik) z pagórkiem; ten sam profil w kolejności punkt→nadajnik dla analizy punktu.
function ray(nS, stepKm, hill = i => 0){
  const tx = { lat: 50.52, lon: 21.64 }, ds = new Float64Array(nS), e = new Float64Array(nS), lats = new Float64Array(nS), lons = new Float64Array(nS);
  for (let i = 0; i < nS; i++){ ds[i] = i * stepKm; const p = destinationPoint(tx.lat, tx.lon, 250, ds[i]); lats[i] = p.lat; lons[i] = p.lon; e[i] = 180 + 30 * Math.sin(i / 17) + hill(i); }
  return { ds, e, lats, lons };
}
const P = { rxHeightM: 10, txHeightM: 123, freqMHz: 514, pol: 'H', erpKw: 23.23, antRelDb: -3.1 };
test('punkt i węzeł obszaru: ta sama wartość (≤ 0,1 dB) na identycznym profilu', () => {
  const R = ray(200, 0.12), j = 199;
  const node = areaNodeField({ ...R, j, ...P, txGroundM: R.e[0] });
  // profil punktu: d[0] = odbiornik
  const n = j + 1, d = [], e = [], la = [], lo = [];
  for (let k = 0; k < n; k++){ const i = j - k; d.push(R.ds[j] - R.ds[i]); e.push(R.e[i]); la.push(R.lats[i]); lo.push(R.lons[i]); }
  const prop = p1812OnProfile({ d, e, lats: la, lons: lo, rxHeightM: P.rxHeightM, txHeightM: P.txHeightM, txGroundM: R.e[0], freqMHz: P.freqMHz, pol: P.pol });
  const path = analyzePath({ d, e, rxHeightM: P.rxHeightM, txHeightM: P.txHeightM, txGroundM: R.e[0], freqMHz: P.freqMHz });
  const pt = assessPoint({ path, erpKw: P.erpKw, antRelDb: P.antRelDb, prop });
  assert.ok(Math.abs(pt.fieldDbuvm - node.E) <= 0.1, `${pt.fieldDbuvm} vs ${node.E}`);
});
test('redukcja profilu zachowuje wąskie wierzchołki terenu (porównanie z pełnym profilem)', () => {
  const peakAt = 777;
  const R = ray(1200, 0.05, i => (i === peakAt ? 260 : 0));
  const idx = reduceProfileIdx(1199, R.e, 300);
  assert.ok(idx.length <= 300); assert.ok(idx.includes(peakAt), 'zgubiony wierzchołek'); assert.equal(idx[0], 1199); assert.equal(idx[idx.length - 1], 0);
  const full = areaNodeField({ ...R, j: 1199, ...P, txGroundM: R.e[0], maxPts: 5000 });
  const red = areaNodeField({ ...R, j: 1199, ...P, txGroundM: R.e[0] });
  assert.ok(Math.abs(full.E - red.E) < 1.5, `pełny ${full.E} vs zredukowany ${red.E}`);
  // dawna decymacja co n-tą próbkę pomijała przeszkodę:
  const stride = Math.ceil(1199 / 220), old = []; for (let i = 1199; i > 0; i -= stride) old.push(i);
  assert.ok(!old.includes(peakAt));
});
test('interpolacja między węzłami (osobno): liniowa, NaN nie jest zamieniany na wartość', () => {
  const out = new Float32Array(11).fill(NaN); out[2] = 50; out[6] = 70; out[10] = NaN;
  fillBetweenNodes(out, [2, 6, 10], 1);
  assert.equal(out[1], 50); assert.equal(out[4], 60); assert.ok(Number.isNaN(out[8]));
});
