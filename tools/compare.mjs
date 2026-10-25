#!/usr/bin/env node
// Porównanie modeli dla wybranych punktów: stary algorytm (272df9a), uproszczony (Deygout), ITU-R P.1812.
// Użycie: node tools/compare.mjs [--old /ścieżka/do/rozpakowanego/272df9a] [--json out.json]
// Stary algorytm: `git archive 272df9a js | tar -x -C /tmp/old272` (domyślna ścieżka /tmp/old272).
// Wymaga sieci (kafle Terrarium, CORINE). Kafle są zapisywane w /tmp/dvbt-cache.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OLD = arg('--old') || '/tmp/old272';

// ---- polyfille przeglądarki (PNG → RGBA, Cache Storage na dysku) ----
function decodePng(buf){
  let o = 8, w, h, ct, bd, idat = [], plte = null;
  while (o < buf.length){ const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR'){ w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === 'PLTE') plte = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; o += 12 + len; }
  if (bd !== 8) throw new Error('PNG bit depth ' + bd);
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], raw = inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++){ const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++){ const a = x >= ch ? px[y * stride + x - ch] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = y && x >= ch ? px[(y - 1) * stride + x - ch] : 0; let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1; else if (f === 4){ const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255; } }
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++){ if (ct === 3){ const k = px[i]; rgba.set([plte[k * 3], plte[k * 3 + 1], plte[k * 3 + 2], 255], i * 4); }
    else if (ct === 0 || ct === 4){ const g = px[i * ch]; rgba.set([g, g, g, 255], i * 4); }
    else { rgba[i * 4] = px[i * ch]; rgba[i * 4 + 1] = px[i * ch + 1]; rgba[i * 4 + 2] = px[i * ch + 2]; rgba[i * 4 + 3] = ch === 4 ? px[i * ch + 3] : 255; } }
  return { width: w, height: h, data: rgba };
}
globalThis.createImageBitmap = async blob => decodePng(Buffer.from(await blob.arrayBuffer()));
globalThis.OffscreenCanvas = class { constructor(w, h){ this.w = w; this.h = h; } getContext(){ let img = null; return { drawImage: b => { img = b; }, getImageData: () => ({ data: img.data }) }; } };
const CACHE = '/tmp/dvbt-cache'; mkdirSync(CACHE, { recursive: true });
const fileOf = u => path.join(CACHE, createHash('sha1').update(String(u.url || u)).digest('hex'));
globalThis.caches = { open: async () => ({ match: async u => existsSync(fileOf(u)) ? new Response(readFileSync(fileOf(u))) : undefined, put: async (u, r) => writeFileSync(fileOf(u), Buffer.from(await r.arrayBuffer())) }), delete: async () => true };
globalThis.fetch = (f => (u, o = {}) => { const { mode, ...rest } = o; return /^https?:/.test(String(u)) ? f(u, rest) : Promise.resolve(new Response(readFileSync(path.join(ROOT, String(u))))); })(globalThis.fetch);

const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const [{ buildProfile }, rf, { p1812OnProfile, MODELS }, geo, { parseAnt, antGainAt }, txd, st] = await Promise.all(
  ['js/app/dem.js', 'js/core/rf.js', 'js/core/propagation.js', 'js/core/geo.js', 'js/core/ant.js', 'js/core/txdata.js', 'js/core/state.js'].map(imp));
let old = null;
if (existsSync(path.join(OLD, 'js/core/rf.js'))){
  const o = p => import(pathToFileURL(path.join(OLD, p)).href);
  const [odem, orf] = await Promise.all([o('js/app/dem.js'), o('js/core/rf.js')]);
  old = { buildProfile: odem.buildProfile, rf: orf };
}

const DB = txd.normalizeDatabase(JSON.parse(readFileSync(path.join(ROOT, 'data/transmitters.json'), 'utf8')));
const txs = DB.txs;
const findTx = id => txs.find(t => t.id === id);
const RX = { ...rf.DEFAULT_RX, gainUhfDbi: 10, cableLossDb: 3 }, RXH = 10;
const antOf = mux => { if (!mux.antPath) return { gains: null, status: 'none' }; const p = parseAnt(readFileSync(path.join(ROOT, mux.antPath), 'utf8')); return p.ok && !p.placeholder ? { gains: p.gains, status: 'ok' } : { gains: null, status: 'invalid' }; };

async function evaluate(pt, txId, muxName){
  const tx = findTx(txId), mk = tx.muxes.find(m => m.name === muxName)?.key;
  const em = txd.resolveEmission(tx, mk), mux = em.mux, ant = antOf(mux);
  const p = st.makeInstallationParams({ point: pt, rxHeightM: RXH, tx, emission: em, rx: RX, model: 'p1812', terrain: 'dem', clutter: true });
  const D = geo.distanceKm(pt, tx), azTx = geo.azimuthDeg(tx, pt), antRel = antGainAt(ant.gains, azTx);
  const out = { point: pt, tx: tx.name, mux: `${mux.name} ${mux.channel}`, freqMHz: p.freqMHz, erpKw: p.erpKw, distanceKm: D, azRxToTx: geo.azimuthDeg(pt, tx), azTxToRx: azTx, antRelDb: antRel, antFile: mux.antPath || 'brak (dookólna)',
    fspl: 106.92 + 10 * Math.log10(p.erpKw) + antRel - 20 * Math.log10(D) };
  if (old){
    const prof = await old.buildProfile(pt, tx, { online: true });
    const path0 = old.rf.analyzePath({ d: prof.d, e: prof.e, rxHeightM: RXH, txHeightM: p.txHeightM, txGroundM: p.txGroundM, freqMHz: p.freqMHz });
    const r = old.rf.assessPoint({ path: path0, erpKw: p.erpKw, antRelDb: antRel, rx: RX });
    out.old = { E: r.fieldDbuvm, margin: r.marginDb, lossDb: path0.diffractionLossDb, status: path0.status, spacingM: prof.spacingM ?? (D * 1000 / (prof.d.length - 1)) };
  }
  const profile = await buildProfile(pt, tx, { online: true, terrain: 'dem', cover: true });
  const path1 = rf.analyzePath(st.buildPathInput(p, profile));
  const s = rf.assessPoint({ path: path1, erpKw: p.erpKw, antRelDb: antRel, rx: RX });
  out.deygout = { E: s.fieldDbuvm, margin: s.marginDb, lossDb: path1.diffractionLossDb, status: path1.status, minClearanceM: path1.minClearanceM, minFresnel: path1.minFresnelRatio, spacingM: profile.spacingM };
  const prop = p1812OnProfile({ d: profile.d, e: profile.e, lats: profile.lats, lons: profile.lons, cover: profile.cover, rxHeightM: RXH, txHeightM: p.txHeightM, txGroundM: p.txGroundM, freqMHz: p.freqMHz, pol: p.polarization });
  const q = rf.assessPoint({ path: path1, erpKw: p.erpKw, antRelDb: antRel, rx: RX, prop });
  out.p1812 = { E: q.fieldDbuvm, margin: q.marginDb, Lb: prop.Lb, Lbfs: prop.Lbfs, Ld: prop.Ld, rxClutterLossDb: prop.rxClutterLossDb, rxCover: prop.rxCover?.label || null, clutterUsed: prop.clutterUsed, coverNote: profile.coverNote };
  out.eMin = q.eMin;
  return out;
}

const MAIN = { lat: 50.33624, lon: 21.32573, name: 'Punkt główny' };
const TB = findTx('tarnobrzeg-komin-zch-siarkopol');
const tbAnt = antOf(TB.muxes.find(m => m.name === 'MUX-3'));
let azMax = 0, azMin = 0; for (let a = 0; a < 360; a++){ const g = antGainAt(tbAnt.gains, a); if (g > antGainAt(tbAnt.gains, azMax)) azMax = a; if (g < antGainAt(tbAnt.gains, azMin)) azMin = a; }
const dst = (az, km, name) => { const p = geo.destinationPoint(TB.lat, TB.lon, az, km); return { lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), name }; };
const POINTS = [MAIN, { lat: 50.2870, lon: 21.4250, name: 'Mielec (centrum)' }, { lat: 50.3290, lon: 21.3290, name: 'Czermin (centrum)' },
  dst(azMax, 25, `Tarnobrzeg — kierunek silny (az ${azMax}°, 25 km)`), dst(azMin, 25, `Tarnobrzeg — kierunek słaby (az ${azMin}°, 25 km)`)];
const rows = [];
for (const pt of POINTS) for (const [id, m] of [['kielce-swiety-krzyz', 'MUX-3'], ['tarnobrzeg-komin-zch-siarkopol', 'MUX-3']]){
  const r = await evaluate(pt, id, m); r.pointName = pt.name; rows.push(r);
  const f = v => v == null ? '—' : v.toFixed(1);
  console.log(`${pt.name.padEnd(44)} ${r.tx.padEnd(36)} ${r.mux.padEnd(10)} d=${r.distanceKm.toFixed(1)} km  ANT ${f(r.antRelDb)} dB | stary ${f(r.old?.E)} | Deygout ${f(r.deygout.E)} (L ${f(r.deygout.lossDb)}) | P.1812 ${f(r.p1812.E)} (zapas ${f(r.p1812.margin)}) dBµV/m`);
}
const tbGain = { azMax, gMax: antGainAt(tbAnt.gains, azMax), azMin, gMin: antGainAt(tbAnt.gains, azMin) };
console.log('ANT 1712:', tbGain);
const outPath = arg('--json'); if (outPath) writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), rx: RX, rxHeightM: RXH, tbGain, rows }, null, 1));
