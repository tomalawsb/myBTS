import test from 'node:test'; import assert from 'node:assert/strict';
import { FIELD_THRESHOLDS, fieldBand, colorize, coverageStats, sampleGrid, MASK } from '../../js/core/coverage.js';
const grid = () => { const width = 4, height = 1; return { width, height, field: Float32Array.from([40, 66, 90, NaN]), mask: Uint8Array.from([MASK.OK, MASK.OK, MASK.OK, MASK.NODATA]) }; };
test('stałe progi pola i oznaczenie poza skalą', () => {
  assert.deepEqual(FIELD_THRESHOLDS, [48, 53, 60, 65, 70, 74, 85]);
  assert.ok(fieldBand(40).below); assert.ok(fieldBand(85).above); assert.equal(fieldBand(66).id, 'f65');
});
test('brak danych nie jest pokazywany jako brak zasięgu; udziały tylko z obliczonych komórek', () => {
  const g = grid(), s = coverageStats(g, { eMin: 50 });
  assert.equal(s.computed, 3); assert.equal(s.noData, 1); assert.equal(s.noDataShare, 0.25);
  assert.ok(Math.abs(s.positiveShare - 2 / 3) < 1e-9);
  assert.equal(s.marginShare.none, 1 / 3);
  const img = colorize(g, { view: 'margin', eMin: 50 });
  const px = i => [...img.slice(i * 4, i * 4 + 3)];
  assert.notDeepEqual(px(3), px(0), 'brak danych ma inny kolor niż brak zasięgu');
});
test('zmiana widoku / progu odbiornika nie wymaga propagacji (to samo pole)', () => {
  const g = grid(); const a = colorize(g, { view: 'margin', eMin: 50 }), b = colorize(g, { view: 'margin', eMin: 70 });
  assert.notDeepEqual([...a.slice(4, 8)], [...b.slice(4, 8)]);
  assert.equal(g.field[1], 66);
});
test('odczyt z mapy: interpolacja, poza obszarem „nie obliczono”, brak danych', () => {
  const g = grid();
  assert.equal(sampleGrid(g, 1.5, 0.5).value, 66);
  assert.ok(Math.abs(sampleGrid(g, 2.0, 0.5).value - 78) < 1e-6);
  assert.equal(sampleGrid(g, 3.5, 0.5).state, 'nodata');
  assert.equal(sampleGrid(g, 9, 0.5).state, 'outside');
});
