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
    .replace(/[łŁ]/g, match => match === 'Ł' ? 'L' : 'l')
    .replace(/[ąĄ]/g, match => match === 'Ą' ? 'A' : 'a')
    .replace(/[ćĆ]/g, match => match === 'Ć' ? 'C' : 'c')
    .replace(/[ęĘ]/g, match => match === 'Ę' ? 'E' : 'e')
    .replace(/[ńŃ]/g, match => match === 'Ń' ? 'N' : 'n')
    .replace(/[óÓ]/g, match => match === 'Ó' ? 'O' : 'o')
    .replace(/[śŚ]/g, match => match === 'Ś' ? 'S' : 's')
    .replace(/[źŹ]/g, match => match === 'Ź' ? 'Z' : 'z')
    .replace(/[żŻ]/g, match => match === 'Ż' ? 'Z' : 'z')
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


function coordinateFromCell(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (!text) return NaN;
  const numbers = text.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g) || [];
  if (numbers.length >= 3 && /[°'"NSWE]/i.test(text)) {
    const deg = Math.abs(Number(numbers[0]));
    const min = Math.abs(Number(numbers[1]));
    const sec = Math.abs(Number(numbers[2]));
    if ([deg, min, sec].every(Number.isFinite)) {
      let out = deg + min / 60 + sec / 3600;
      if (/[SW]/i.test(text) || String(numbers[0]).startsWith('-')) out *= -1;
      return out;
    }
  }
  const decimal = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return decimal ? Number(decimal[0]) : NaN;
}

function coordinatePairFromText(value) {
  const text = String(value || '');
  if (!text) return null;
  const dms = [];
  const dmsRe = /(\d{1,3})\D+(\d{1,2})\D+(\d{1,2}(?:[,.]\d+)?)\s*([NSEW])/gi;
  let match;
  while ((match = dmsRe.exec(text))) {
    let val = Math.abs(Number(match[1])) + Math.abs(Number(match[2])) / 60 + Math.abs(Number(String(match[3]).replace(',', '.'))) / 3600;
    const dir = match[4].toUpperCase();
    if (dir === 'S' || dir === 'W') val *= -1;
    dms.push({ val, dir });
  }
  if (dms.length >= 2) {
    const lat = dms.find(item => item.dir === 'N' || item.dir === 'S')?.val;
    const lon = dms.find(item => item.dir === 'E' || item.dir === 'W')?.val;
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
  }
  const nums = text.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  for (let i = 0; i < nums.length - 1; i++) {
    const lat = nums[i];
    const lon = nums[i + 1];
    if (lat >= 40 && lat <= 60 && lon >= 10 && lon <= 30) return { lat, lon };
  }
  return null;
}

function coordinatePairFromRow(row) {
  for (const value of Object.values(row || {})) {
    const pair = coordinatePairFromText(value);
    if (pair) return pair;
  }
  return null;
}

function getFuzzyCoordinate(row, kind) {
  for (const [key, value] of Object.entries(row || {})) {
    const k = normalizeColumnName(key);
    const isLat = kind === 'lat' && (k.includes('szerokosc') || k.includes('latitude') || k === 'lat' || k.endsWith('lat') || k === 'y');
    const isLon = kind === 'lon' && ((k.includes('dlugosc') && !k.includes('wysokosc')) || k.includes('longitude') || k === 'lon' || k === 'lng' || k.endsWith('lon') || k.endsWith('lng') || k === 'x');
    if (!isLat && !isLon) continue;
    const coord = coordinateFromCell(value);
    if (Number.isFinite(coord)) return coord;
  }
  return NaN;
}

function splitListCell(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text.split(/[;,|/]+|\s{2,}/).map(s => s.trim()).filter(Boolean);
}

function mergeUnique(a, b) {
  const out = [];
  const push = value => {
    const text = String(value ?? '').trim();
    if (!text) return;
    if (!out.some(item => normalizeText(item) === normalizeText(text))) out.push(text);
  };
  (Array.isArray(a) ? a : splitListCell(a)).forEach(push);
  (Array.isArray(b) ? b : splitListCell(b)).forEach(push);
  return out;
}

function matrixToObjects(matrix) {
  const rows = (matrix || []).map(row => Array.from(row || []).map(value => String(value ?? '').trim()));
  const nonEmpty = rows.filter(row => row.some(Boolean));
  if (!nonEmpty.length) return [];
  let headerIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(nonEmpty.length, 30); i++) {
    const score = scoreHeaderRow(nonEmpty[i]);
    if (score > bestScore) { bestScore = score; headerIndex = i; }
  }
  if (bestScore < 2) headerIndex = 0;
  const headers = nonEmpty[headerIndex].map((header, index) => header || `kolumna_${index + 1}`);
  return nonEmpty.slice(headerIndex + 1).map(values => {
    const out = {};
    headers.forEach((header, index) => { if (header) out[header] = values[index] ?? ''; });
    return out;
  }).filter(row => Object.values(row).some(value => String(value || '').trim()));
}

function scoreHeaderRow(row) {
  const joined = normalizeText((row || []).join(' '));
  let score = 0;
  const tokens = ['szerokosc', 'dlugosc', 'wspolrzed', 'miejscowosc', 'operator', 'uzytkownik', 'adres', 'stacja', 'pozwolen', 'azymut', 'moc', 'eirp', 'technologia', 'pasmo', 'system', 'standard', 'wojewodztwo', 'powiat', 'gmina'];
  for (const token of tokens) if (joined.includes(token)) score++;
  return score;
}


function nrBandToLabel(n) {
  const key = String(n || '').replace(/^n/i, '');
  const map = {
    '1': 'NR2100',
    '3': 'NR1800',
    '7': 'NR2600',
    '8': 'NR900',
    '20': 'NR800',
    '28': 'NR700',
    '38': 'NR2600',
    '40': 'NR2300',
    '41': 'NR2600',
    '77': 'NR3700',
    '78': 'NR3500'
  };
  return map[key] || `NR n${key}`;
}

function extractBandsFromText(value) {
  const text = String(value || '');
  if (!text) return [];
  const out = [];
  const push = band => {
    const clean = String(band || '').toUpperCase().replace(/\s+/g, '');
    if (clean && !out.some(item => normalizeText(item) === normalizeText(clean))) out.push(clean);
  };

  let match;
  const lte = /(?:\bLTE|\bL)\s*[-_:]?\s*(700|800|850|900|1800|2100|2300|2600)\s*(?:FDD|TDD)?\b/gi;
  while ((match = lte.exec(text))) push(`LTE${match[1]}`);

  const gsm = /\b(?:GSM|G)\s*[-_:]?\s*(850|900|1800|1900)\b/gi;
  while ((match = gsm.exec(text))) push(`GSM${match[1]}`);

  const umts = /\b(?:UMTS|U)\s*[-_:]?\s*(850|900|1800|1900|2100)\b/gi;
  while ((match = umts.exec(text))) push(`UMTS${match[1]}`);

  const nr = /(?:\bNR|\b5G)\s*[-_:]?\s*n?\s*(1|3|7|8|20|28|38|40|41|77|78)\b/gi;
  while ((match = nr.exec(text))) push(nrBandToLabel(match[1]));

  const bracketNr = /\[\s*5G\s*:\s*n\s*(1|3|7|8|20|28|38|40|41|77|78)\s*\]/gi;
  while ((match = bracketNr.exec(text))) push(nrBandToLabel(match[1]));

  return out;
}

function getAliased(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeColumnName(alias);
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '') return row[key];
  }
  return '';
}


function buildAddress(row) {
  const direct = getAliased(row, ['address', 'adres', 'adresstacji', 'lokalizacja', 'lokalizacjastacji', 'location']);
  if (direct) return direct;
  const parts = [
    getAliased(row, ['ulica']),
    getAliased(row, ['nr', 'numer', 'numernieruchomosci', 'nrnieruchomosci']),
    getAliased(row, ['miejscowosc', 'miejscowość', 'miejscowoscstacji', 'miasto']),
    getAliased(row, ['gmina']),
    getAliased(row, ['powiat']),
    getAliased(row, ['wojewodztwo'])
  ].map(v => String(v || '').trim()).filter(Boolean);
  return [...new Set(parts)].join(', ');
}

function normalizeImportedRow(row) {
  const pair = coordinatePairFromRow(row);
  let lat = coordinateFromCell(getAliased(row, ['latitude', 'lat', 'szerokosc', 'szerokoscgeograficzna', 'szerokoscgeograficznastacji', 'wgs84lat', 'latwgs84', 'y']));
  let lon = coordinateFromCell(getAliased(row, ['longitude', 'lon', 'lng', 'dlugosc', 'dlugoscgeograficzna', 'dlugoscgeograficznastacji', 'wgs84lon', 'lonwgs84', 'lngwgs84', 'x']));
  if (!Number.isFinite(lat)) lat = getFuzzyCoordinate(row, 'lat');
  if (!Number.isFinite(lon)) lon = getFuzzyCoordinate(row, 'lon');
  if (!Number.isFinite(lat) && pair) lat = pair.lat;
  if (!Number.isFinite(lon) && pair) lon = pair.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const bandsRaw = getAliased(row, ['bands', 'pasma', 'pasmo', 'band', 'technologia', 'technology', 'system', 'standard', 'zakres', 'ukeband']);
  const azRaw = getAliased(row, ['azimuths', 'azymuty', 'azymut', 'azimuth', 'azymutanteny', 'kierunek']);
  const powerRaw = getAliased(row, ['power', 'power_w', 'moc', 'mocw', 'mocpromieniowana', 'mocpromieniowanaw', 'eirp', 'eirp_dbm', 'eirpdbm', 'erp', 'max_eirp_dbm', 'maxeirpdbm', 'maksymalnamoc', 'maksymalnamocpromieniowana']);
  const address = buildAddress(row);
  const textForBands = [bandsRaw, address, Object.values(row).join(' ')].join(' ');
  const extractedBands = extractBandsFromText(textForBands);
  return normalizeStation({
    station_id: getAliased(row, ['station_id', 'stationid', 'id', 'nrstacji', 'idstacji', 'identyfikatorstacji', 'nazwaobiektu', 'nazwastacji', 'pozwolenie', 'nrpozwolenia', 'numerpozwolenia', 'numerdecyzji', 'nrdecyzji', 'znaksprawy', 'btssid', 'siteid']) || '—',
    operator: getAliased(row, ['operator', 'sieć', 'siec', 'network', 'mno', 'uzytkownik', 'uzytkownikpozwolenia', 'nazwaoperatora', 'nazwauzytkownika', 'podmiot', 'przedsiebiorca']) || 'Nieznany',
    latitude: lat,
    longitude: lon,
    address,
    city: getAliased(row, ['city', 'miasto', 'miejscowosc', 'miejscowość', 'miejscowoscstacji', 'gmina']),
    bands: mergeUnique(splitListCell(bandsRaw), extractedBands),
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
  const textForBands = [raw.bands, raw.band, raw.technology, raw.technologie, raw.address, raw.location, raw.city, raw.station_id, raw.source].join(' ');
  const bands = mergeUnique(splitListCell(raw.bands || raw.band || raw.technology || raw.technologie), extractBandsFromText(textForBands));
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
    source: String(raw.source || ''),
    shared_operators: splitListCell(raw.shared_operators || raw.sharedoperators || raw.wspoldzielone || raw.wspoloperatorzy),
    shared_site: !!(raw.shared_site || raw.sharedsite || raw.wspoldzielony)
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
  if (trimmed.startsWith('<') || kind === 'xml' || kind === 'html') {
    throw new Error('XML/HTML jest odczytywany w głównym wątku aplikacji. Użyj importu pliku, nie workera.');
  }
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

  return matrixToObjects(rows).map(object => {
    const out = {};
    for (const [key, value] of Object.entries(object)) out[normalizeColumnName(key)] = String(value ?? '').trim();
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
  if (lower.endsWith('.xml') || ct.includes('xml')) return 'xml';
  if (lower.endsWith('.html') || lower.endsWith('.htm') || ct.includes('html')) return 'html';
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
