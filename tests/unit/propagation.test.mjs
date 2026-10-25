import test from 'node:test';
import assert from 'node:assert/strict';
import { p1812OnProfile, MODELS, DEFAULT_MODEL } from '../../js/core/propagation.js';
import { p1812 } from '../../js/core/p1812.js';
import { analyzePath, assessPoint, fieldStrengthDbuvm } from '../../js/core/rf.js';
import { clcFromRgb, clutterHeight, radioZone } from '../../js/core/landcover.js';

function prof(n = 301, Dkm = 30, hill = 0){
  const d = Float64Array.from({ length: n }, (_, i) => Dkm * i / (n - 1));
  const e = Float64Array.from(d, x => 120 + hill * Math.exp(-((x - Dkm / 2) ** 2) / 2));
  const lats = Array.from(d, x => 52 + x / 111.2), lons = Array.from(d, () => 21);
  return { d, e, lats, lons };
}
test('domyślny model to P.1812', () => { assert.equal(DEFAULT_MODEL, 'p1812'); assert.ok(MODELS.simple && MODELS.p1812); });
test('odwrócenie profilu (Rx→Tx na Tx→Rx) zgodne z bezpośrednim wywołaniem', () => {
  const p = prof(201, 25, 150);
  const r = p1812OnProfile({ ...p, rxHeightM: 10, txHeightM: 200, txGroundM: 120, freqMHz: 600, pol: 'H' });
  const n = p.d.length, D = p.d[n - 1];
  const dir = p1812({ f: 0.6, d: Array.from(p.d, (_, i) => D - p.d[n - 1 - i]), h: Array.from(p.e).reverse(), htg: 200, hrg: 10, pol: 1, phiT: p.lats[n - 1], lamT: 21, phiR: p.lats[0], lamR: 21, DN: 45, N0: 320 });
  assert.ok(Math.abs(r.lbBase - dir.Lb) < 1e-9);
});
test('płaski LOS: P.1812 ≈ model uproszczony (±3 dB)', () => {
  const p = prof(301, 20, 0);
  const path = analyzePath({ d: p.d, e: p.e, rxHeightM: 10, txHeightM: 250, freqMHz: 600 });
  const prop = p1812OnProfile({ ...p, rxHeightM: 10, txHeightM: 250, txGroundM: 120, freqMHz: 600 });
  const a = assessPoint({ path, erpKw: 100 }), b = assessPoint({ path, erpKw: 100, prop });
  assert.equal(b.model, 'p1812'); assert.equal(a.model, 'simple');
  assert.ok(Math.abs(a.fieldDbuvm - b.fieldDbuvm) < 3, `${a.fieldDbuvm} vs ${b.fieldDbuvm}`);
  assert.ok(Math.abs(b.fieldDbuvm - (prop.E1kW + 20)) < 1e-9);
});
test('klutter: las na trasie i zabudowa przy odbiorniku obniżają pole', () => {
  const p = prof(301, 30, 0);
  const base = { ...p, rxHeightM: 10, txHeightM: 150, txGroundM: 120, freqMHz: 600 };
  const bare = p1812OnProfile(base);
  const forest = p1812OnProfile({ ...base, cover: Int16Array.from(p.d, () => 312) });
  const city = p1812OnProfile({ ...base, cover: Int16Array.from(p.d, (_, i) => i < 3 ? 111 : 211) });
  assert.ok(forest.E1kW < bare.E1kW - 1, `${forest.E1kW} ${bare.E1kW}`);
  assert.ok(city.rxClutterLossDb > 3 && city.E1kW < bare.E1kW); assert.equal(city.rxCover.code, 111);
  assert.equal(bare.clutterUsed, false); assert.equal(forest.clutterUsed, true);
});
test('CORINE: kolory legendy → kody, R i strefy', () => {
  assert.equal(clcFromRgb(230, 0, 77), 111); assert.equal(clcFromRgb(0, 166, 0), 312); assert.equal(clcFromRgb(1, 2, 3), 0);
  assert.equal(clutterHeight(111), 20); assert.equal(clutterHeight(211), 0); assert.equal(radioZone(523), 1); assert.equal(radioZone(312), 4);
});
