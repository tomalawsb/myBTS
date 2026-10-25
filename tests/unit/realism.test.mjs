import test from 'node:test';
import assert from 'node:assert/strict';
import { p1812 } from '../../js/core/p1812.js';
import { minFieldStrength, marginBand } from '../../js/core/rf.js';

// Kontrola realizmu skali: nadajnik 100 km, teren płaski 150 m, antena nadawcza 150 m, odbiorcza 10 m, 600 MHz.
function E1kW(D, htg){ const n = 200, d = Array.from({ length: n }, (_, i) => i * D / (n - 1)), h = d.map(() => 150);
  return p1812({ f: 0.6, p: 50, d, h, R: d.map(() => 0), zone: d.map(() => 4), htg, hrg: 10, pol: 1, phiT: 52, lamT: 20, phiR: 52.6, lamR: 21, pL: 50, sigmaL: 0, Ptx: 1, DN: 45, N0: 320 }).E; }
test('100 km przy 10 kW ERP — co najwyżej sygnał na granicy, nie „duży zapas”', () => {
  const m = E1kW(100, 150) + 10 - minFieldStrength(600).eMin;
  assert.notEqual(marginBand(m).id, 'strong', String(m));
  assert.notEqual(marginBand(m).id, 'good', String(m));
});
test('20 km przy 100 kW ERP — dobry lub duży zapas', () => {
  const m = E1kW(20, 300) + 20 - minFieldStrength(600).eMin;
  assert.ok(['good', 'strong'].includes(marginBand(m).id), String(m));
});
