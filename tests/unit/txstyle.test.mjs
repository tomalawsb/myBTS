import test from 'node:test';
import assert from 'node:assert/strict';
import { txMarkerClass, txLegend, txVisibleInRange, txVisible } from '../../js/core/txstyle.js';
import { MARGIN_BANDS } from '../../js/core/rf.js';

test('klasa kropki wg zapasu — progi jak legenda zasięgu', () => {
  assert.equal(txMarkerClass({ marginDb: 20 }).id, 'strong');
  assert.equal(txMarkerClass({ marginDb: 15 }).id, 'good');
  assert.equal(txMarkerClass({ marginDb: 8 }).id, 'marginal');
  assert.equal(txMarkerClass({ marginDb: 0 }).id, 'marginal');
  assert.equal(txMarkerClass({ marginDb: -3 }).id, 'none');
  assert.equal(txMarkerClass({ marginDb: -Infinity }).id, 'none');
  assert.equal(txMarkerClass(null).id, 'unknown');
  assert.equal(txMarkerClass(null, { scanning: true, candidate: true }).id, 'pending');
  for (const b of MARGIN_BANDS) assert.equal(txMarkerClass({ marginDb: b.min === -Infinity ? -50 : b.min }).color, b.color);
});
test('każda klasa ma symbol (kolor nie jedyną informacją)', () => {
  const l = txLegend(); assert.equal(l.length, 6);
  assert.equal(new Set(l.map(x => x.symbol)).size, 6);
});
test('filtr „Tylko w zasięgu”', () => {
  const base = { txId: 'a', selectedId: 'x', hasPoint: true };
  assert.equal(txVisibleInRange({ ...base, scan: null }), true);
  assert.equal(txVisibleInRange({ ...base, hasPoint: false, scan: { done: true } }), true);
  assert.equal(txVisibleInRange({ ...base, scan: { done: false }, candidate: false }), false, 'w trakcie skanu nie-kandydaci ukryci');
  assert.equal(txVisibleInRange({ ...base, scan: { done: false }, candidate: true }), true);
  assert.equal(txVisibleInRange({ ...base, scan: { done: true }, candidate: true }), false);
  assert.equal(txVisibleInRange({ ...base, scan: { done: true }, result: { inRange: false } }), false);
  assert.equal(txVisibleInRange({ ...base, scan: { done: true }, result: { inRange: true } }), true);
  assert.equal(txVisibleInRange({ ...base, selectedId: 'a', scan: { done: true }, result: { inRange: false } }), true);
});
test('brak danych nie jest pokazywany jako brak zasięgu', () => {
  assert.equal(txMarkerClass({ state: 'nodata', marginDb: null }).id, 'nodata');
  assert.notEqual(txMarkerClass({ state: 'nodata', marginDb: null }).id, 'none');
});
test('filtr domyślny „sprawdzone” nie ukrywa słabych; nadajniki bez MUX-a ukryte', () => {
  const b = { txId: 'a', selectedId: 'x', hasPoint: true, scan: { done: true } };
  assert.equal(txVisible({ ...b, result: { inRange: false, state: 'weak' } }), true);
  assert.equal(txVisible({ ...b, filter: 'inRange', result: { inRange: false } }), false);
  assert.equal(txVisible({ ...b, emits: false, filter: 'all' }), false);
  assert.equal(txVisible({ ...b, emits: false, selectedId: 'a' }), true);
  assert.equal(txVisible({ ...b }), false);
  assert.equal(txVisible({ ...b, candidate: true }), true);
});
