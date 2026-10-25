import test from 'node:test'; import assert from 'node:assert/strict';
import { preselect, scanCandidates, evaluateTx, rankResults, recommend, scanKey } from '../../js/core/rank.js';
import { DEFAULT_RX } from '../../js/core/rf.js';
const mux = (name, o = {}) => ({ key: 'k|' + name + '|' + (o.channel ?? 30), name, channel: 30, frequencyMHz: 600, erpKw: 100, heightM: 200, polarization: 'H', missing: [], ...o });
const P = { lat: 52, lon: 21 };
const tx = (id, dLat, o = {}) => ({ id, name: id, lat: 52 + dLat, lon: 21, siteElevationM: 100, muxes: [mux('M1'), mux('M2')], ...o });
const flat = (km, n = 300) => ({ d: Array.from({ length: n }, (_, i) => km * i / (n - 1)), e: new Array(n).fill(100) });
test('kandydaci per MUX: promień 120 km, brak danych osobno, słabe osobno', () => {
  const txs = [tx('near', 0.3), tx('far', 1.5), tx('nodata', 0.2, { muxes: [mux('M1', { missing: ['moc ERP'], erpKw: null })] }), tx('weak', 0.9, { muxes: [mux('M1', { erpKw: 0.0001 })] }), tx('otherMux', 0.1, { muxes: [mux('M9')] })];
  const c = scanCandidates(P, txs, { muxName: 'M1' });
  assert.deepEqual(c.list.map(x => x.tx.id), ['near']);
  assert.deepEqual(c.noData.map(x => x.tx.id), ['nodata']);
  assert.deepEqual(c.weak.map(x => x.tx.id), ['weak']);
  assert.deepEqual(preselect(P, txs, { muxName: 'M9' }).map(x => x.tx.id), ['otherMux']);
});
test('ocena jednej emisji: płaski teren → w zasięgu, góra → przeszkoda; brak danych ≠ brak zasięgu', () => {
  const t = tx('a', 0.3), D = 33.36;
  const r = evaluateTx({ tx: t, mux: t.muxes[0], profile: flat(D), point: P, rxHeightM: 10, rx: DEFAULT_RX, model: 'simple' });
  assert.equal(r.inRange, true); assert.equal(r.mux, 'M1'); assert.equal(r.state, 'ok');
  const hill = flat(D); for (let i = 140; i < 160; i++) hill.e[i] = 900;
  const b = evaluateTx({ tx: t, mux: t.muxes[0], profile: hill, point: P, rxHeightM: 10, rx: DEFAULT_RX, model: 'simple' });
  assert.equal(b.status, 'blocked'); assert.ok(b.marginDb < r.marginDb); assert.equal(b.state, 'weak');
  const nd = evaluateTx({ tx: t, mux: mux('M1', { missing: ['moc ERP'] }), profile: flat(D), point: P, rxHeightM: 10, model: 'simple' });
  assert.equal(nd.state, 'nodata'); assert.equal(nd.marginDb, null);
});
test('ranking per MUX: zapas (kroki 3 dB) → widoczność; brak danych na końcu', () => {
  const L = [
    { txId: 'a', marginDb: 10.5, status: 'clear', inRange: true },
    { txId: 'b', marginDb: 10.0, status: 'fresnel', inRange: true },
    { txId: 'c', marginDb: 20, status: 'blocked', inRange: true },
    { txId: 'd', marginDb: -5, status: 'clear', inRange: false },
    { txId: 'n', marginDb: null, status: null, inRange: false, state: 'nodata' },
    { txId: 'e', marginDb: 10.2, status: 'clear', inRange: true }
  ];
  assert.deepEqual(rankResults(L).map(x => x.txId), ['c', 'a', 'e', 'b', 'd', 'n']);
  assert.equal(recommend(L).txId, 'c');
  assert.equal(recommend([L[3]]), null);
});
test('ranking zależy od MUX: ten sam punkt, inne MUX-y → inny polecany', () => {
  const A = tx('A', 0.3, { muxes: [mux('M1', { erpKw: 100 }), mux('M2', { erpKw: 0.5 })] });
  const B = tx('B', -0.3, { muxes: [mux('M1', { erpKw: 1 }), mux('M2', { erpKw: 100 })] });
  const run = name => recommend([A, B].map(t => evaluateTx({ tx: t, mux: t.muxes.find(m => m.name === name), profile: flat(33.36), point: P, rxHeightM: 10, model: 'simple' }))).txId;
  assert.equal(run('M1'), 'A'); assert.equal(run('M2'), 'B');
});
test('klucz skanu zależy od MUX, punktu, wysokości, odbiornika, modelu i terenu', () => {
  const k = o => scanKey({ point: P, muxName: 'MUX-3', rxHeightM: 10, rx: DEFAULT_RX, dataVersion: 'v1', model: 'p1812', terrain: 'nmt', ...o });
  const base = k({});
  for (const o of [{ muxName: 'MUX-1' }, { rxHeightM: 11 }, { rx: { ...DEFAULT_RX, gainUhfDbi: 5 } }, { model: 'simple' }, { terrain: 'dem' }, { clutter: false }]) assert.notEqual(k(o), base, JSON.stringify(o));
});
