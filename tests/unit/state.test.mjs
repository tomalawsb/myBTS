import test from 'node:test'; import assert from 'node:assert/strict';
import { makeInstallationParams, invalidation, createJobManager, createResultStore, rfKey, terrainKey } from '../../js/core/state.js';
const tx = { id: 't', name: 'T', lat: 50, lon: 19 };
const em = (f, h = 100) => ({ muxKey: 'k' + f, mux: { name: 'MUX', channel: 30 }, freqMHz: f, erpKw: 10, txHeightM: h, txGroundM: 300 });
const P = (o = {}) => makeInstallationParams({ point: { lat: 50.2, lon: 19.1 }, rxHeightM: 10, tx, emission: em(538), dataVersion: 'd1', ...o });
test('parametry niezmienne', () => { const p = P(); assert.throws(() => { 'use strict'; p.rxHeightM = 3; }); });
test('zmiana częstotliwości zachowuje teren, unieważnia RF', () => {
  const inv = invalidation(P(), P({ emission: em(602) }));
  assert.equal(inv.terrain, false); assert.equal(inv.rf, true);
});
test('zmiana wysokości anteny MUX unieważnia geometrię', () => { assert.equal(invalidation(P(), P({ emission: em(538, 62) })).geometry, true); });
test('klucz wyniku zawiera wersję algorytmu i ANT', () => {
  const k = rfKey(P({ antFingerprint: 'abc' })); assert.match(k, /antabc/); assert.match(k, /\|ageo-rf-/);
  assert.notEqual(k, rfKey(P({ antFingerprint: 'xyz' })));
});
test('nieaktualny wynik nie nadpisuje nowszego', () => {
  const s = createResultStore(); const a = rfKey(P()), b = rfKey(P({ rxHeightM: 12 }));
  assert.equal(s.accept(a, b, 'stary'), false); assert.equal(s.accept(b, b, 'nowy'), true); assert.equal(s.get(b), 'nowy'); assert.equal(s.get(a), null);
});
test('zadania: nowe przerywa stare, Przerwij, isCurrent', () => {
  const jm = createJobManager(); const j1 = jm.start('point'); const j2 = jm.start('point');
  assert.equal(j1.signal.aborted, true); assert.equal(j1.isCurrent(), false); assert.equal(j2.isCurrent(), true);
  j2.cancel(); assert.equal(j2.state, 'cancelled'); assert.equal(j2.finish(), false);
});
test('terrainKey nie zależy od wysokości', () => { assert.equal(terrainKey(P()), terrainKey(P({ rxHeightM: 20 }))); });
import { areaKey, selectionKey } from '../../js/core/state.js';
test('areaKey zawiera model, teren, klutter i emisję; nie zależy od odbiornika (zapas liczony z pola)', () => {
  const a = areaKey(P(), 'area', 100);
  assert.notEqual(a, areaKey(P({ model: 'simple' }), 'area', 100));
  assert.notEqual(a, areaKey(P({ terrain: 'nmt' }), 'area', 100));
  assert.notEqual(a, areaKey(P({ clutter: false }), 'area', 100));
  assert.notEqual(a, areaKey(P(), 'area', 60));
  assert.notEqual(a, areaKey(P({ emission: em(602) }), 'area', 100));
  assert.equal(a, areaKey(P({ rx: { gainUhfDbi: 3 } }), 'area', 100));
});
test('selectionKey: każda zmiana wyboru zmienia klucz (wynik nieaktualny nie jest pokazywany)', () => {
  const s = { point: { lat: 50, lon: 20 }, txId: 'a', muxKey: 'a|MUX-3|26', muxType: 'MUX-3', rxHeightM: 10, model: 'p1812', terrain: 'nmt', clutter: true, rx: {} };
  const k = selectionKey(s);
  for (const o of [{ txId: 'b' }, { muxKey: 'a|MUX-1|30' }, { point: { lat: 50.001, lon: 20 } }, { rxHeightM: 11 }, { model: 'simple' }]) assert.notEqual(selectionKey({ ...s, ...o }), k);
});
