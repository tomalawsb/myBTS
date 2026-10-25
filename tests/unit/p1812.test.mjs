import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { p1812, p2108TerminalLoss, invCumNorm, sigmaLoc } from '../../js/core/p1812.js';

const ref = JSON.parse(readFileSync(new URL('../fixtures/p1812-reference.json', import.meta.url)));

test('P.1812: zgodność z referencją ITU-R SG3 / Py1812 (±0.1 dB)', () => {
  let worst = 0;
  for (const c of ref.cases){
    const r = p1812({ f: c.f, p: c.p, d: c.d, h: c.h, R: c.R, zone: c.zone, htg: c.htg, hrg: c.hrg, pol: c.pol,
      phiT: c.phi_t, phiR: c.phi_r, lamT: c.lam_t, lamR: c.lam_r, pL: c.kw.pL, sigmaL: c.kw.sigmaL, Ptx: c.kw.Ptx, DN: c.kw.DN, N0: c.kw.N0, dct: c.kw.dct, dcr: c.kw.dcr });
    worst = Math.max(worst, Math.abs(r.Lb - c.Lb));
    assert.ok(Math.abs(r.Lb - c.Lb) < 0.1, `Lb ${r.Lb.toFixed(3)} vs ${c.Lb.toFixed(3)} (f=${c.f}, p=${c.p}, n=${c.d.length})`);
    assert.ok(Math.abs(r.E - c.E) < 0.1);
  }
  assert.ok(ref.cases.length >= 20);
});
test('P.1812: płaski krótki LOS ≈ wolna przestrzeń', () => {
  const d = Array.from({ length: 51 }, (_, i) => i * 0.2), h = d.map(() => 100);
  const r = p1812({ f: 0.6, d, h, htg: 150, hrg: 10, phiT: 52, phiR: 52.09, lamT: 21, lamR: 21 });
  assert.ok(Math.abs(r.Lb - r.Lbfs) < 3, `${r.Lb} vs ${r.Lbfs}`);
});
test('P.1812: przeszkoda zwiększa tłumienie, klutter R też', () => {
  const d = Array.from({ length: 101 }, (_, i) => i * 0.5), flat = d.map(() => 100);
  const hill = d.map((x) => 100 + 300 * Math.exp(-((x - 25) ** 2) / 4));
  const base = { f: 0.6, d, htg: 100, hrg: 10, phiT: 52, phiR: 52.45, lamT: 21, lamR: 21 };
  const a = p1812({ ...base, h: flat }), b = p1812({ ...base, h: hill });
  const c = p1812({ ...base, h: flat, R: d.map(() => 20) });
  assert.ok(b.Lb > a.Lb + 10); assert.ok(c.Lb > a.Lb);
});
test('P.2108 §3.1 i pomocnicze', () => {
  assert.equal(p2108TerminalLoss(0.6, 10, 0), 0);
  assert.equal(p2108TerminalLoss(0.6, 25, 20), 0);
  const u = p2108TerminalLoss(0.6, 2, 20, 'urban'); assert.ok(u > 5 && u < 30, String(u));
  const o = p2108TerminalLoss(0.6, 5, 10, 'open'); assert.ok(o > 3 && o < 8, String(o));
  assert.ok(Math.abs(invCumNorm(0.5)) < 1e-6); assert.ok(Math.abs(invCumNorm(0.1) - 1.2816) < 0.01);
  assert.equal(sigmaLoc(0.6, 30, 10), 0);
});
