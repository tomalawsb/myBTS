import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeDatabase, resolveEmission, channelFrequencyMHz } from '../../js/core/txdata.js';
import { makeInstallationParams, buildPathInput } from '../../js/core/state.js';
import { analyzePath } from '../../js/core/rf.js';
import { flat } from '../fixtures/profiles.mjs';

const db = normalizeDatabase(JSON.parse(readFileSync(new URL('../../data/transmitters.json', import.meta.url))));
const find = (re) => db.txs.find(t => re.test(t.name));
function heightsFor(tx, muxName){
  const mux = tx.muxes.find(m => m.name === muxName);
  const em = resolveEmission(tx, mux.key);
  const params = makeInstallationParams({ point: { lat: tx.lat + 0.1, lon: tx.lon }, rxHeightM: 10, tx, emission: em, dataVersion: db.meta.dataVersion });
  const path = analyzePath(buildPathInput(params, flat(11, 200, 300)));
  return { em, params, path };
}
test('baza: schemat 3, 274 obiekty, brak cichych domyślnych', () => {
  assert.equal(db.meta.schemaVersion, 3);
  assert.equal(db.txs.length, 274);
  assert.ok(db.meta.updatedAt);
});
test('Solina MUX-8: 62 m w profilu i w RF (nie 90 m obiektu)', () => {
  const tx = find(/Solina/);
  const { em, params, path } = heightsFor(tx, 'MUX-8');
  assert.equal(em.txHeightM, 62); assert.equal(params.txHeightM, 62);
  assert.equal(path.txAlt, tx.siteElevationM + 62);
  assert.equal(tx.structureHeightM, 90);
});
test('Częstochowa/Wręczyca MUX-8: 180 m w profilu i w RF (nie 313 m)', () => {
  const tx = find(/Wręczyca/);
  const { em, path } = heightsFor(tx, 'MUX-8');
  assert.equal(em.txHeightM, 180);
  assert.equal(path.txAlt, tx.siteElevationM + 180);
  const other = tx.muxes.find(m => m.name !== 'MUX-8');
  assert.equal(resolveEmission(tx, other.key).txHeightM, 313);
});
test('brak wysokości anteny MUX → zastępczo wysokość obiektu, opisana', () => {
  const m = db.txs.flatMap(t => t.muxes).filter(m => m.heightSource.startsWith('wysokość obiektu'));
  for (const x of m) assert.ok(x.heightM > 0);
});
test('VHF i UHF: raster kanałów', () => {
  assert.equal(channelFrequencyMHz(5), 177.5); assert.equal(channelFrequencyMHz(12), 226.5);
  assert.equal(channelFrequencyMHz(21), 474); assert.equal(channelFrequencyMHz(69), 858);
  assert.equal(channelFrequencyMHz(13), null);
  const vhf = db.txs.flatMap(t => t.muxes).filter(m => m.band === 'VHF');
  assert.ok(vhf.length > 50);
  for (const m of vhf) assert.ok(m.frequencyMHz >= 174 && m.frequencyMHz <= 230);
  const errs = db.issues.filter(i => /niezgodna z kanałem/.test(i.text));
  assert.equal(errs.length, 0, errs.map(e => e.text).join('\n'));
});
test('walidacja: brak ERP = null, nie 0; zły rekord pominięty', () => {
  const r = normalizeDatabase({ schema_version: 3, transmitters: [
    { id: 'a', name: 'A', lat: 50, lon: 19, muxes: [{ name: 'MUX-1', channel_no: 30 }] },
    { id: 'b', name: 'B', lat: 'x', lon: 19, muxes: [] }] });
  assert.equal(r.txs.length, 1);
  const m = r.txs[0].muxes[0];
  assert.equal(m.erpKw, null); assert.equal(m.heightM, null); assert.equal(m.frequencyMHz, 546);
  assert.equal(resolveEmission(r.txs[0], m.key).ok, false);
});
