import test from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const { loadInstallations, saveInstallations } = await import('../../js/app/storage.js');
const { ALGO_VERSION } = await import('../../js/core/version.js');

test('zmiana wersji algorytmu (ALGO) nie usuwa zapisanych instalacji', () => {
  const list = [{ id: 'a', name: 'Dom', point: { lat: 50.33624, lon: 21.32573 }, txId: 'kielce-swiety-krzyz', muxType: 'MUX-3', params: { algoVersion: 'geo-rf-4.0' } }];
  saveInstallations(list);
  const back = loadInstallations();
  assert.notEqual(back[0].params.algoVersion, ALGO_VERSION);
  assert.equal(back.length, 1); assert.equal(back[0].name, 'Dom'); assert.equal(back[0].point.lat, 50.33624);
});
