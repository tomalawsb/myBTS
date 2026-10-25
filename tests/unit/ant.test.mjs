import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseAnt, antGainAt, isPlaceholderAntUrl } from '../../js/core/ant.js';
const one = Array.from({ length: 360 }, (_, i) => (i < 180 ? 0 : -10).toFixed(1)).join('\n');
test('format RadioPolska: 360 wierszy', () => {
  const r = parseAnt(one); assert.ok(r.ok); assert.equal(r.gains.length, 360);
  assert.equal(antGainAt(r.gains, 90), 0); assert.equal(antGainAt(r.gains, 270), -10);
});
test('interpolacja z zawinięciem 359→0', () => {
  const v = Array.from({ length: 360 }, (_, i) => i === 359 ? '-10' : '0').join('\n');
  const r = parseAnt(v); assert.ok(Math.abs(antGainAt(r.gains, 359.5) - -5) < 1e-6);
});
test('pary azymut/wartość', () => {
  const r = parseAnt('0 0\n90 -3\n180 -20\n270 -3\n45 -1\n135 -10\n225 -10\n315 -1');
  assert.ok(r.ok); assert.ok(Math.abs(antGainAt(r.gains, 90) + 3) < 1e-6);
});
test('odrzuca HTML, same zera jako brak danych, wartości dodatnie', () => {
  assert.equal(parseAnt('<html><body>404</body></html>').ok, false);
  const z = parseAnt(Array(360).fill('-0').join('\n')); assert.ok(z.placeholder);
  assert.equal(parseAnt(Array.from({ length: 360 }, (_, i) => String(i % 7 + 2)).join('\n')).ok, false);
  assert.equal(parseAnt('abc').ok, false);
});
test('linki /0/ = brak pliku', () => {
  assert.ok(isPlaceholderAntUrl('https://mapy.radiopolska.pl/files/ant_file/0/MUX-3'));
  assert.ok(!isPlaceholderAntUrl('https://mapy.radiopolska.pl/files/ant_file/1547/x'));
});
test('pobrane pliki data/ant/*.ant przechodzą parser', () => {
  const dir = new URL('../../data/ant/', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.ant'))){
    const r = parseAnt(readFileSync(new URL(f, dir), 'utf8')); assert.ok(r.ok && !r.placeholder, f + ': ' + r.error);
  }
});
