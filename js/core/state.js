// Wspólny stan instalacji, klucze wyników i zarządzanie zadaniami (bez DOM — testowalne w Node).
import { ALGO_VERSION } from './version.js';

const r5 = v => Number(v).toFixed(5);
/** Niezmienny zestaw parametrów instalacji — wejście KAŻDEGO obliczenia. */
export function makeInstallationParams({ point, rxHeightM, tx, emission, antFingerprint = 'none', dataVersion, rx, model = 'p1812', terrain = 'dem', clutter = true }){
  if (!point || !tx || !emission) return null;
  return Object.freeze({
    point: Object.freeze({ lat: point.lat, lon: point.lon }),
    rxHeightM: Number(rxHeightM),
    txId: tx.id, txName: tx.name, txLat: tx.lat, txLon: tx.lon,
    muxKey: emission.muxKey, muxType: emission.mux?.name, variant: emission.mux?.variant ?? null, muxName: emission.mux?.name, channel: emission.mux?.channel,
    freqMHz: emission.freqMHz, erpKw: emission.erpKw,
    txHeightM: emission.txHeightM, heightSource: emission.heightSource, txGroundM: emission.txGroundM,
    antFingerprint, dataVersion, algoVersion: ALGO_VERSION, model, terrain, clutter: !!clutter, polarization: emission.mux?.polarization ?? null,
    rx: Object.freeze({ ...(rx || {}) })
  });
}
/** Teren zależy tylko od punktów końcowych — zmiana częstotliwości go NIE unieważnia. */
export const terrainKey = p => `T|${r5(p.point.lat)},${r5(p.point.lon)}|${r5(p.txLat)},${r5(p.txLon)}|${p.terrain || 'dem'}`;
export const geometryKey = p => `${terrainKey(p)}|h${p.rxHeightM}|tx${p.txHeightM}@${p.txGroundM ?? 'dem'}`;
export const rfKey = p => `${geometryKey(p)}|mux${p.muxKey}|f${p.freqMHz}|erp${p.erpKw}|pol${p.polarization}|ant${p.antFingerprint}|d${p.dataVersion}|a${p.algoVersion}|m${p.model || 'p1812'}|c${p.clutter ? 1 : 0}|rx${JSON.stringify(p.rx)}`;
/** Klucz POLA (dBµV/m) mapy zasięgu: emisja, model, teren, klutter, wysokości, ANT, obszar. Bez odbiornika —
 *  zapas liczy się z pola przy rysowaniu, więc zmiana zysku anteny/kabla nie wymaga nowej propagacji. */
export const areaKey = (p, mode, radiusKm) => `A|${mode}|${p.txId}|${p.muxKey}|${r5(p.txLat)},${r5(p.txLon)}|${mode === 'local' ? r5(p.point.lat) + ',' + r5(p.point.lon) : ''}|r${radiusKm}|h${p.rxHeightM}|tx${p.txHeightM}@${p.txGroundM ?? 'dem'}|f${p.freqMHz}|erp${p.erpKw}|pol${p.polarization}|ant${p.antFingerprint}|d${p.dataVersion}|a${p.algoVersion}|m${p.model || 'p1812'}|t${p.terrain || 'dem'}|c${p.clutter ? 1 : 0}`;
/** Klucz bieżącego WYBORU w interfejsie (synchroniczny) — wynik zadania jest pokazywany tylko, gdy wybór się nie zmienił. */
export const selectionKey = ({ point, txId, muxKey, muxType, rxHeightM, model, terrain, clutter, rx }) =>
  `${point ? r5(point.lat) + ',' + r5(point.lon) : '-'}|${txId}|${muxKey}|${muxType}|h${rxHeightM}|m${model}|t${terrain}|c${clutter ? 1 : 0}|${JSON.stringify(rx || {})}|a${ALGO_VERSION}`;

/** Co trzeba przeliczyć po zmianie parametrów. */
export function invalidation(prev, next){
  if (!prev || !next) return { terrain: true, geometry: true, rf: true };
  return { terrain: terrainKey(prev) !== terrainKey(next), geometry: geometryKey(prev) !== geometryKey(next), rf: rfKey(prev) !== rfKey(next) };
}

/** Zadania z identyfikatorem i stanem; nowe zadanie tego samego rodzaju przerywa poprzednie. */
export function createJobManager(onChange = () => {}){
  let seq = 0; const active = new Map(); // kind -> job
  function start(kind, { key = null, label = '' } = {}){
    const prev = active.get(kind);
    if (prev) prev.cancel('zastąpione nowym zadaniem');
    const ctl = new AbortController();
    const job = {
      id: ++seq, kind, key, label, state: 'running', progress: 0, error: null, signal: ctl.signal,
      isCurrent(){ return active.get(kind) === job && job.state === 'running'; },
      setProgress(p, text){ if (job.isCurrent()){ job.progress = p; job.progressText = text || ''; onChange(job); } },
      finish(){ if (active.get(kind) === job){ job.state = 'done'; active.delete(kind); onChange(job); return true; } return false; },
      fail(err){ if (active.get(kind) === job){ job.state = 'error'; job.error = err; active.delete(kind); onChange(job); } },
      cancel(reason = 'przerwane przez użytkownika'){ if (job.state === 'running'){ job.state = 'cancelled'; job.cancelReason = reason; ctl.abort(); if (active.get(kind) === job) active.delete(kind); onChange(job); } }
    };
    active.set(kind, job); onChange(job);
    return job;
  }
  return { start, get: kind => active.get(kind) || null, cancelAll(){ for (const j of [...active.values()]) j.cancel(); }, list: () => [...active.values()] };
}

/**
 * Magazyn wyników z ochroną przed nieaktualnymi odpowiedziami:
 * wynik zostaje zapisany tylko, gdy jego klucz odpowiada aktualnym parametrom.
 */
export function createResultStore(){
  let current = null; // { key, value }
  return {
    accept(key, currentKey, value){ if (key !== currentKey) return false; current = { key, value }; return true; },
    get(key){ return current && current.key === key ? current.value : null; },
    clear(){ current = null; }
  };
}

/** Jedyne miejsce, w którym parametry instalacji stają się wejściem analizy trasy (profil = RF). */
export function buildPathInput(params, profile){
  return { d: profile.d, e: profile.e, rxHeightM: params.rxHeightM, txHeightM: params.txHeightM, txGroundM: params.txGroundM, freqMHz: params.freqMHz };
}
