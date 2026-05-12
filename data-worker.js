'use strict';

const SEARCH_FIELDS_SEPARATOR = ' • ';
const XLSX_CDN_NOTE = 'Import XLSX wymaga biblioteki SheetJS z CDN albo połączenia z internetem.';

self.onmessage = async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === 'loadUrl') {
      postStatus(msg.id, 'Pobieram bazę…');
      const url = normalizeRemoteUrl(msg.url || 'stations.json');
      const response = await fetch(url, { cache: msg.forceNetwork ? 'reload' : 'default' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      const kind = detectRemoteType(url, contentType);
      const text = await response.text();
      postStatus(msg.id, 'Przetwarzam bazę…');
      const stations = parseTextPayload(text, kind);
      postResult(msg.id, stations, sourceNameFromUrl(url));
      return;
    }

    if (msg.type === 'parseText') {
      postStatus(msg.id, 'Przetwarzam plik…');
      const stations = parseTextPayload(String(msg.text || ''), msg.kind || detectRemoteType(msg.name || '', msg.contentType || ''));
      postResult(msg.id, stations, msg.name || 'import');
      return;
    }

    if (msg.type === 'parseRows') {
      postStatus(msg.id, 'Przetwarzam arkusz…');
      const stations = parseImportedRows(Array.isArray(msg.rows) ? msg.rows : []);
      postResult(msg.id, stations, msg.name || 'import XLSX');
      return;
    }

    throw new Error('Nieznane polecenie workera.');
  } catch (err) {
    self.postMessage({ id: msg.id, type: 'error', message: err.message || String(err) });
  }
};

function postStatus(id, text) {
  self.postMessage({ id, type: 'status', text });
}

function postResult(id, stations, sourceName) {
  self.postMessage({ id, type: 'result', stations, sourceName });
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeColumnName(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function compactSearchText(station) {
  return normalizeText([
    station.station_id,
    station.operator,
    station.city,
    station.address,
    station.bands.join(' '),
    station.source
  ].join(SEARCH_FIELDS_SEPARATOR));
}

function numberFromCell(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim().replace(',', '.');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function splitListCell(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text.split(/[;,|/]+|\s{2,}/).map(s => s.trim()).filter(Boolean);
}

function getAliased(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeColumnName(alias);
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '') return row[key];
  }
  return '';
}

function normalizeImportedRow(row) {
  const lat = numberFromCell(getAliased(row, ['latitude', 'lat', 'szerokosc', 'szerokoscgeograficzna', 'wgs84lat', 'y']));
  const lon = numberFromCell(getAliased(row, ['longitude', 'lon', 'lng', 'dlugosc', 'dlugoscgeograficzna', 'wgs84lon', 'x']));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const bandsRaw = getAliased(row, ['bands', 'pasma', 'pasmo', 'band', 'technologia', 'technology', 'system']);
  const azRaw = getAliased(row, ['azimuths', 'azymuty', 'azymut', 'azimuth']);
  const powerRaw = getAliased(row, ['power', 'power_w', 'moc', 'mocw', 'eirp', 'eirp_dbm', 'eirpdbm', 'erp', 'max_eirp_dbm', 'maxeirpdbm']);
  return normalizeStation({
    station_id: getAliased(row, ['station_id', 'stationid', 'id', 'nrstacji', 'idstacji', 'pozwolenie', 'btssid', 'siteid']) || '—',
    operator: getAliased(row, ['operator', 'sieć', 'siec', 'network', 'mno']) || 'Nieznany',
    latitude: lat,
    longitude: lon,
    address: getAliased(row, ['address', 'adres', 'lokalizacja', 'location', 'ulica']),
    city: getAliased(row, ['city', 'miasto', 'miejscowosc', 'miejscowość', 'gmina']),
    bands: splitListCell(bandsRaw),
    azimuths: splitListCell(azRaw).map(numberFromCell).filter(Number.isFinite),
    range_km: numberFromCell(getAliased(row, ['range_km', 'rangekm', 'zasieg', 'zasiegkm', 'zasięg', 'zasięgkm'])),
    power: powerRaw,
    records_count: numberFromCell(getAliased(row, ['records_count', 'recordscount', 'rekordy'])) || 1,
    source: getAliased(row, ['source', 'zrodlo', 'źródło']) || 'import'
  });
}

function normalizeStation(raw) {
  if (!raw) return null;
  const latitude = Number(raw.latitude ?? raw.lat);
  const longitude = Number(raw.longitude ?? raw.lon ?? raw.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const bands = splitListCell(raw.bands || raw.band || raw.technology || raw.technologie);
  const azimuths = splitListCell(raw.azimuths || raw.azymuty || raw.azimuth)
    .map(numberFromCell)
    .filter(Number.isFinite)
    .map(v => ((v % 360) + 360) % 360);
  const station = {
    station_id: String(raw.station_id ?? raw.id ?? raw.site_id ?? '—'),
    operator: String(raw.operator || 'Nieznany'),
    latitude,
    longitude,
    address: String(raw.address || raw.location || ''),
    city: String(raw.city || ''),
    bands: bands.length ? [...new Set(bands)] : ['Nieznane'],
    azimuths: [...new Set(azimuths)],
    sector_ids: splitListCell(raw.sector_ids || raw.sectors || raw.sektory),
    cell_names: splitListCell(raw.cell_names || raw.cells || raw.komorki),
    records_count: Number(raw.records_count || raw.records || 1) || 1,
    range_km: Number(raw.range_km || raw.range || 0) || null,
    power: raw.power ?? raw.power_w ?? raw.moc ?? raw.eirp ?? raw.eirp_dbm ?? raw.erp ?? raw.max_eirp_dbm ?? '',
    power_w: raw.power_w ?? '',
    eirp: raw.eirp ?? '',
    eirp_dbm: raw.eirp_dbm ?? '',
    erp: raw.erp ?? '',
    max_eirp_dbm: raw.max_eirp_dbm ?? '',
    source: String(raw.source || '')
  };
  station._search = compactSearchText(station);
  return station;
}

function parseStationsPayload(payload) {
  const source = Array.isArray(payload) ? payload : (payload.stations || payload.data || payload.items || []);
  if (!Array.isArray(source)) throw new Error('Plik JSON nie zawiera listy stacji.');
  const seen = new Set();
  const stations = [];
  for (const item of source) {
    const station = normalizeStation(item);
    if (!station) continue;
    const key = `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stations.push(station);
  }
  if (!stations.length) throw new Error('Nie znaleziono stacji z poprawnymi współrzędnymi.');
  return stations;
}

function parseTextPayload(text, kind) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Pusty plik.');
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || kind === 'json') return parseStationsPayload(JSON.parse(trimmed));
  return parseCsvStations(text);
}

function parseCsv(text) {
  const sample = text.slice(0, 5000);
  const delimiters = [';', ',', '\t'];
  let delimiter = ';';
  let best = -1;
  for (const d of delimiters) {
    const pattern = d === '\t' ? /\t/g : new RegExp(`\\${d}`, 'g');
    const score = (sample.match(pattern) || []).length;
    if (score > best) { best = score; delimiter = d === '\t' ? '\t' : d; }
  }

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
      continue;
    }
    if (!quoted && ch === delimiter) { row.push(cell); cell = ''; continue; }
    if (!quoted && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => String(v).trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some(v => String(v).trim() !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(normalizeColumnName);
  return rows.slice(1).map(values => {
    const out = {};
    headers.forEach((key, i) => { if (key) out[key] = String(values[i] ?? '').trim(); });
    return out;
  });
}

function parseCsvStations(text) {
  return parseImportedRows(parseCsv(text));
}

function parseImportedRows(rows) {
  const seen = new Set();
  const stations = [];
  for (const rawRow of rows) {
    const row = {};
    for (const [key, value] of Object.entries(rawRow || {})) row[normalizeColumnName(key)] = value;
    const station = normalizeImportedRow(row);
    if (!station) continue;
    const key = `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stations.push(station);
  }
  if (!stations.length) throw new Error('Nie znaleziono stacji z poprawnymi współrzędnymi. Sprawdź kolumny lat/lon/operator/pasma/adres.');
  return stations;
}

function normalizeRemoteUrl(url) {
  let out = String(url || '').trim();
  if (!out) throw new Error('Podaj link do bazy.');
  if (out.includes('dropbox.com/') && out.includes('dl=0')) out = out.replace('dl=0', 'dl=1');
  if (out.includes('drive.google.com/file/d/')) {
    const match = out.match(/\/d\/([^/]+)/);
    if (match) out = `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return out;
}

function detectRemoteType(url, contentType) {
  const lower = String(url || '').toLowerCase();
  const ct = String(contentType || '').toLowerCase();
  if (lower.endsWith('.csv') || ct.includes('csv')) return 'csv';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) throw new Error(XLSX_CDN_NOTE);
  return 'json';
}

function sourceNameFromUrl(url) {
  try {
    const parsed = new URL(url, self.location.href);
    const name = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
    return decodeURIComponent(name);
  } catch (_) {
    return url;
  }
}
