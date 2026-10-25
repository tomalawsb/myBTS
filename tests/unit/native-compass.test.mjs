import test from 'node:test'; import assert from 'node:assert/strict';
// Atrapa mostka aplikacji Android (window.DVBTNative) — JS ma używać natywnego źródła, gdy jest dostępne.
const calls = [];
globalThis.window = globalThis;
globalThis.screen = { orientation: { angle: 0 } };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.DVBTNative = { hasCompass: () => true, startCompass: () => calls.push('start'), stopCompass: () => calls.push('stop'), setLocation: (a, b, c) => calls.push(['loc', a, b, c]), declination: () => 6.2 };
const { createCompass } = await import('../../js/app/compass.js');
test('natywny kompas: start, odczyt, kalibracja, stop', async () => {
  const c = createCompass({ getCalib: () => ({ invert: false, offset: 0 }) });
  assert.equal(c.source, 'native'); assert.equal(c.needsGesture(), false);
  const seen = []; c.subscribe(s => seen.push(s));
  await c.start(); assert.deepEqual(calls.slice(-1), ['start']);
  c.setLocation(52, 21, 0); assert.deepEqual(calls.slice(-1)[0], ['loc', 52, 21, 0]);
  window.__nativeCompass(123.4, 5, false, 'rv', 6.2);
  let s = c.snapshot(); assert.equal(s.state, 'ok'); assert.ok(Math.abs(s.heading - 123.4) < 1e-9); assert.equal(s.accuracy, 5); assert.equal(s.needsCalibration, false); assert.equal(s.declination, 6.2);
  window.__nativeCompass(125, 30, true, 'rv', 6.2);
  s = c.snapshot(); assert.equal(s.needsCalibration, true); assert.ok(s.heading > 123.4 && s.heading < 125);
  window.__nativeCompass(1, null, false, 'rv', 6.2); // przejście przez północ bez kręcenia
  assert.equal(c.snapshot().needsCalibration, true, 'nieznana dokładność = poproś o kalibrację');
  c.stop(); assert.deepEqual(calls.slice(-1), ['stop']);
  window.__nativeCompass(50, 5, false, 'rv', 6.2);
  assert.equal(c.snapshot().heading, null, 'po stop ignoruje odczyty');
  assert.ok(seen.length >= 3);
});
