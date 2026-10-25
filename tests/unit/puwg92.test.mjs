import test from 'node:test';
import assert from 'node:assert/strict';
import { toPuwg92 } from '../../js/core/puwg92.js';
// Niezależny łuk południka GRS80 (całkowanie numeryczne) — na południku osiowym x = m0·M(φ) − 5 300 000, y = 500 000.
function meridianArc(deg){ const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f); let s = 0; const n = 20000, h = deg * Math.PI / 180 / n;
  for (let i = 0; i < n; i++){ const p = (i + 0.5) * h; s += a * (1 - e2) / (1 - e2 * Math.sin(p) ** 2) ** 1.5 * h; } return s; }
test('PUWG92: południk osiowy', () => {
  for (const lat of [49.5, 52, 54.5]){ const p = toPuwg92(lat, 19); assert.ok(Math.abs(p.x - (0.9993 * meridianArc(lat) - 5300000)) < 0.01); assert.ok(Math.abs(p.y - 500000) < 1e-6); }
});
test('PUWG92: Warszawa (PKiN) ≈ x 487 km, y 637 km; symetria względem λ0', () => {
  const p = toPuwg92(52.2318, 21.006); assert.ok(Math.abs(p.x - 487400) < 1500 && Math.abs(p.y - 637000) < 1500, JSON.stringify(p));
  const a = toPuwg92(51, 17), b = toPuwg92(51, 21); assert.ok(Math.abs(a.x - b.x) < 1e-6 && Math.abs((a.y - 500000) + (b.y - 500000)) < 1e-6);
});
