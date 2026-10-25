// Jednolity schemat bazy nadajników + walidacja. Brak danych ≠ 0; brak cichych wartości domyślnych.
import { isPlaceholderAntUrl } from './ant.js';
import { TX_SCHEMA_VERSION } from './version.js';

export function channelFrequencyMHz(ch){
  if (!Number.isInteger(ch)) return null;
  if (ch >= 5 && ch <= 12) return 177.5 + 7 * (ch - 5);  // VHF pasmo III, raster 7 MHz
  if (ch >= 21 && ch <= 69) return 474 + 8 * (ch - 21);  // UHF, raster 8 MHz
  return null;
}
export function bandOf(freq){ return freq == null ? null : (freq < 300 ? 'VHF' : 'UHF'); }
const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
const str = v => (v === null || v === undefined) ? '' : String(v).trim();
function parseChannel(m){
  const n = num(m.channel_no);
  if (n != null) return Math.round(n);
  const mm = /(\d{1,2})/.exec(str(m.channel));
  return mm ? Number(mm[1]) : null;
}
export function normalizePolarization(p){
  const s = str(p).toUpperCase();
  if (s.startsWith('H')) return 'H';
  if (s.startsWith('V')) return 'V';
  if (s.startsWith('M') || s.startsWith('C')) return 'M';
  return null;
}
export const POLARIZATION_TEXT = { H: 'pozioma (H) — elementy anteny poziomo', V: 'pionowa (V) — elementy anteny pionowo', M: 'mieszana/kołowa', null: 'brak danych' };

/** Normalizacja całej bazy. Zwraca meta, listę nadajników i listę problemów. */
export function normalizeDatabase(json){
  const issues = [];
  if (!json || !Array.isArray(json.transmitters)) throw new Error('Plik bazy nie zawiera listy "transmitters".');
  const meta = {
    schemaVersion: num(json.schema_version) ?? 1,
    dataVersion: str(json.data_version) || str(json.version) || 'nieznana',
    updatedAt: str(json.updated_at) || null,
    source: str(json.source) || 'nieznane',
    license: str(json.license_note)
  };
  if (meta.schemaVersion > TX_SCHEMA_VERSION) issues.push({ level: 'warn', text: `Baza w nowszym schemacie (${meta.schemaVersion}) niż obsługiwany (${TX_SCHEMA_VERSION}).` });
  const txs = []; const ids = new Set();
  for (const raw of json.transmitters){
    const lat = num(raw.lat), lon = num(raw.lon);
    const id = str(raw.id);
    if (!id || ids.has(id)){ issues.push({ level: 'error', text: `Pominięto nadajnik bez unikalnego id: ${str(raw.name)}` }); continue; }
    if (lat == null || lon == null || lat < -90 || lat > 90 || lon < -180 || lon > 180){ issues.push({ level: 'error', text: `Pominięto ${id}: błędne współrzędne.` }); continue; }
    if (lat < 47 || lat > 56.5 || lon < 12 || lon > 26) issues.push({ level: 'warn', text: `${id}: współrzędne poza obszarem Polski.` });
    ids.add(id);
    const tx = {
      id, name: str(raw.name) || id, shortName: str(raw.short_name) || str(raw.name) || id,
      location: str(raw.location), site: str(raw.site), lat, lon,
      siteElevationM: num(raw.site_elevation_m),
      structureHeightM: num(raw.mast_height_m),
      source: str(raw.source), muxes: []
    };
    for (const m of (raw.muxes || [])){
      const ch = parseChannel(m);
      const chFreq = channelFrequencyMHz(ch);
      let freq = num(m.frequency_mhz), freqSource = 'baza';
      if (freq == null && chFreq != null){ freq = chFreq; freqSource = 'z numeru kanału'; }
      if (freq != null && chFreq != null && Math.abs(freq - chFreq) > 0.6) issues.push({ level: 'warn', text: `${id} ${str(m.name)}: częstotliwość ${freq} MHz niezgodna z kanałem ${ch} (${chFreq} MHz).` });
      const antH = num(m.antenna_height_m);
      let heightM = antH, heightSource = 'antena MUX (baza)';
      if (antH == null && tx.structureHeightM != null){ heightM = tx.structureHeightM; heightSource = 'wysokość obiektu (zastępczo — brak wysokości anteny MUX)'; }
      if (heightM == null) heightSource = 'brak danych';
      const antUrl = str(m.ant_file_url);
      const mux = {
        key: `${id}|${str(m.name)}|${ch ?? '?'}`,
        name: str(m.name) || 'MUX bez nazwy', channel: ch, frequencyMHz: freq, freqSource,
        band: bandOf(freq), erpKw: num(m.erp_kw), polarization: normalizePolarization(m.polarization),
        pattern: str(m.pattern) || null, heightM, heightSource,
        antennaName: str(m.antenna_name), operator: str(m.operator),
        antUrl: isPlaceholderAntUrl(antUrl) ? null : antUrl,
        antId: str(m.ant_file_id) || null, antPath: str(m.ant_pattern_path) || null,
        emissionUrl: str(m.radiopolska_emission_url),
        variant: regionalVariant(str(m.name), antUrl)
      };
      const missing = [];
      if (mux.frequencyMHz == null) missing.push('częstotliwość');
      if (mux.erpKw == null) missing.push('moc ERP');
      if (mux.heightM == null) missing.push('wysokość anteny');
      mux.missing = missing;
      if (missing.length) issues.push({ level: 'warn', text: `${id} ${mux.name}: brak — ${missing.join(', ')}.` });
      tx.muxes.push(mux);
    }
    tx.muxNames = [...new Set(tx.muxes.map(m => m.name))];
    txs.push(tx);
  }
  return { meta, txs, issues };
}

/** Wariant regionalny (np. MUX-3 „Rzeszow”) z nazwy pliku ANT RadioPolska: "MUX-3 Rzeszow - Tarnobrzeg …". */
export function regionalVariant(muxName, antUrl){
  const tail = decodeURIComponent(String(antUrl || '').split('/').pop() || '');
  const m = /^(\S+)\s+([^-]+?)\s+-\s/.exec(tail);
  return m && m[1] === muxName ? m[2].trim() : null;
}
/** Wszystkie typy MUX w bazie (nazwa → liczba nadajników), w kolejności naturalnej (MUX-1, MUX-2 … MUX-L1 …). */
export function listMuxTypes(txs){
  const c = new Map();
  for (const t of txs) for (const n of t.muxNames) c.set(n, (c.get(n) || 0) + 1);
  return [...c.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }));
}
/** Emisja danego typu MUX na nadajniku (bez zgadywania innego MUX). Przy kilku — najsilniejsza ERP. */
export function emissionOfType(tx, muxName){
  if (!tx || !muxName) return null;
  const list = tx.muxes.filter(m => m.name === muxName);
  return list.sort((a, b) => (b.erpKw ?? -1) - (a.erpKw ?? -1))[0] || null;
}
/** Parametry emisji wybranego MUX — wspólne dla profilu, oceny punktu, rankingu i mapy zasięgu.
 *  Emisja identyfikowana kluczem (txId|nazwa|kanał); BRAK domyślnego wyboru innego MUX. */
export function resolveEmission(tx, muxKey){
  const mux = tx?.muxes.find(m => m.key === muxKey);
  if (!mux) return { ok: false, missingMux: true, reason: 'Wybrany nadajnik nie nadaje wybranego MUX-a.' };
  return {
    ok: mux.missing.length === 0, reason: mux.missing.length ? `Brak w bazie: ${mux.missing.join(', ')}.` : '',
    mux, muxKey: mux.key, freqMHz: mux.frequencyMHz, erpKw: mux.erpKw,
    txHeightM: mux.heightM, heightSource: mux.heightSource, txGroundM: tx.siteElevationM
  };
}
/** @deprecated — tylko do migracji starych zapisów; nie używać do wyboru w UI. */
export function pickDefaultMux(tx){
  return [...tx.muxes].sort((a, b) => (b.erpKw ?? -1) - (a.erpKw ?? -1))[0] || null;
}
/** Czy nadajnik nadaje wszystkie wymagane MUX-y. */
export function hasRequiredMuxes(tx, required){ return !required?.length || required.every(r => tx.muxNames.includes(r)); }
