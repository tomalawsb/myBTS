import test from 'node:test'; import assert from 'node:assert/strict';
import { processHeading, compassState, turnInstruction, headingFromEvent } from '../../js/core/compass-math.js';
test('wygładzanie przez 359→0 nie kręci się dookoła', () => {
  const h = processHeading(358, 2, { alpha: 0.5 }); assert.ok(Math.abs(h - 0) < 1e-9 || Math.abs(h - 360) < 1e-9);
});
test('odwrócenie i korekta', () => { assert.equal(processHeading(null, 90, { invert: true }), 270); assert.equal(processHeading(null, 355, { offset: 10 }), 5); });
test('stany czujnika', () => {
  assert.equal(compassState({ supported: true, permission: 'granted', lastTs: 0, now: 10 }), 'waiting');
  assert.equal(compassState({ supported: true, permission: 'granted', lastTs: 1000, now: 1500 }), 'ok');
  assert.equal(compassState({ supported: true, permission: 'granted', lastTs: 1000, now: 9000 }), 'stale');
  assert.equal(compassState({ supported: true, permission: 'denied' }), 'denied');
  assert.equal(compassState({ supported: false }), 'unsupported');
});
test('polecenie obrotu', () => {
  assert.equal(turnInstruction(10, 40, 5, 'ok').text, 'Obróć 30° w prawo');
  assert.equal(turnInstruction(350, 10, 5, 'ok').text, 'Obróć 20° w prawo');
  assert.equal(turnInstruction(40, 10, 5, 'ok').text, 'Obróć 30° w lewo');
  assert.equal(turnInstruction(12, 10, 5, 'ok').precise, true);
  assert.equal(turnInstruction(12, 10, null, 'ok').precise, false, 'bez znanej dokładności nie ma "prawidłowy"');
  assert.equal(turnInstruction(null, 10, null, 'waiting').diff, null);
});
test('alpha względna nie jest kursem; orientacja ekranu', () => {
  assert.equal(headingFromEvent({ alpha: 30, absolute: false }), null);
  assert.equal(headingFromEvent({ alpha: 30, absolute: true }, 0).heading, 330);
  assert.equal(headingFromEvent({ alpha: 30, absolute: true }, 90).heading, 60);
  assert.equal(headingFromEvent({ webkitCompassHeading: 12, webkitCompassAccuracy: 8 }).accuracy, 8);
});
