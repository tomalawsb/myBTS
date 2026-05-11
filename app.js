'use strict';

const APP_VERSION = '2.0.0-web';
const TILE_SIZE = 256;
const DEFAULT_CENTER = { lat: 50.2872, lon: 21.4231 };
const DEFAULT_ZOOM = 10;
const MIN_ZOOM = 5;
const MAX_ZOOM = 18;
const MAX_LIST_ROWS = 120;
const MAX_MARKERS = 260;
const MOBILE_MAX_MARKERS = 120;
const SEARCH_MIN_CHARS = 2;
const SETTINGS_KEY = 'mybts-web-settings-v2';
const DB_NAME = 'mybts-web-db';
const DB_VERSION = 1;
const DATASET_STORE = 'datasets';
const ACTIVE_DATASET_ID = 'active';
const SPATIAL_CELL_DEG = 0.25;
const XLSX_CDN_NOTE = 'Import XLSX wymaga biblioteki SheetJS z CDN albo połączenia z internetem.';

const OPERATOR_COLORS = {
  'Orange': '#ff7800',
  'T-Mobile': '#e6007e',
  'Play': '#6d33db',
  'Plus': '#009e47',
  'Aero2': '#1fa5f2',
  'Orange / T-Mobile': '#ef5133',
  'Aero2 / Plus': '#008a63',
  'Cyfrowy Polsat': '#f2bf1a',
  'Netia': '#0073bf',
  'Lycamobile': '#0559d9',
  'Sferia': '#777777'
};

const state = {
  stations: [],
  operators: ['Wszyscy'],
  bands: ['Wszystkie'],
  center: { ...DEFAULT_CENTER },
  zoom: DEFAULT_ZOOM,
  mapType: 'plan',
  theme: 'light',
  operator: 'Wszyscy',
  band: 'Wszystkie',
  radiusKm: null,
  search: '',
  measure: null,
  selected: null,
  setPointMode: false,
  currentItems: [],
  currentList: [],
  currentVisibleTotal: 0,
  renderTimer: null,
  spatialGrid: new Map(),
  dataSourceName: '',
  isSavingDataset: false,
  dataLoaded: false,
  deferredInstallPrompt: null
};

const el = {};

function initElements() {
  Object.assign(el, {
    body: document.body,
    statusText: document.getElementById('statusText'),
    datasetInfo: document.getElementById('datasetInfo'),
    map: document.getElementById('map'),
    tileLayer: document.getElementById('tileLayer'),
    canvas: document.getElementById('overlayCanvas'),
    measureMarker: document.getElementById('measureMarker'),
    searchInput: document.getElementById('searchInput'),
    operatorSelect: document.getElementById('operatorSelect'),
    bandSelect: document.getElementById('bandSelect'),
    radiusSelect: document.getElementById('radiusSelect'),
    totalCount: document.getElementById('totalCount'),
    visibleCount: document.getElementById('visibleCount'),
    zoomValue: document.getElementById('zoomValue'),
    stationList: document.getElementById('stationList'),
    listSubtitle: document.getElementById('listSubtitle'),
    detailCard: document.getElementById('detailCard'),
    detailTitle: document.getElementById('detailTitle'),
    detailSubtitle: document.getElementById('detailSubtitle'),
    detailBody: document.getElementById('detailBody'),
    closeDetailBtn: document.getElementById('closeDetailBtn'),
    locateBtn: document.getElementById('locateBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    importFileBtn: document.getElementById('importFileBtn'),
    dataFileInput: document.getElementById('dataFileInput'),
    remoteUrlInput: document.getElementById('remoteUrlInput'),
    loadUrlBtn: document.getElementById('loadUrlBtn'),
    clearCacheBtn: document.getElementById('clearCacheBtn'),
    storageStatus: document.getElementById('storageStatus'),
    themeBtn: document.getElementById('themeBtn'),
    installBtn: document.getElementById('installBtn'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    setPointBtn: document.getElementById('setPointBtn'),
    clearPointBtn: document.getElementById('clearPointBtn'),
    mapPlanBtn: document.getElementById('mapPlanBtn'),
    mapSatBtn: document.getElementById('mapSatBtn'),
    nearestBtn: document.getElementById('nearestBtn')
  });
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) state.center = { lat: parsed.lat, lon: parsed.lon };
    if (Number.isFinite(parsed.zoom)) state.zoom = clamp(Math.round(parsed.zoom), MIN_ZOOM, MAX_ZOOM);
    if (parsed.mapType === 'sat' || parsed.mapType === 'plan') state.mapType = parsed.mapType;
    if (parsed.theme === 'dark' || parsed.theme === 'light') state.theme = parsed.theme;
    if (parsed.operator) state.operator = parsed.operator;
    if (parsed.band) state.band = parsed.band;
    state.radiusKm = parsed.radiusKm === null || parsed.radiusKm === '' || parsed.radiusKm === undefined ? null : Number(parsed.radiusKm);
  } catch (_) {}
}

function saveSettings() {
  const payload = {
    lat: state.center.lat,
    lon: state.center.lon,
    zoom: state.zoom,
    mapType: state.mapType,
    theme: state.theme,
    operator: state.operator,
    band: state.band,
    radiusKm: state.radiusKm
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
}

function setStatus(text) {
  el.statusText.textContent = text;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function stationKey(station) {
  return `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
}

function compactNumber(value) {
  return new Intl.NumberFormat('pl-PL').format(value || 0);
}

function operatorColor(operator) {
  return OPERATOR_COLORS[operator] || '#3478f6';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function setStorageStatus(text) {
  if (el.storageStatus) el.storageStatus.textContent = text;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB nie jest dostępne w tej przeglądarce.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATASET_STORE)) db.createObjectStore(DATASET_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Błąd IndexedDB'));
  });
}

function idbPut(storeName, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Błąd zapisu IndexedDB')); };
  }));
}

function idbGet(storeName, key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Błąd odczytu IndexedDB'));
    tx.oncomplete = () => db.close();
  }));
}

function idbDelete(storeName, key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Błąd kasowania IndexedDB')); };
  }));
}

async function saveActiveDataset(stations, sourceName) {
  if (!stations || !stations.length) return;
  state.isSavingDataset = true;
  setStorageStatus('Pamięć lokalna: zapisuję bazę…');
  try {
    await idbPut(DATASET_STORE, {
      id: ACTIVE_DATASET_ID,
      sourceName,
      savedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      stations
    });
    setStorageStatus(`Pamięć lokalna: zapisano ${compactNumber(stations.length)} stacji.`);
  } catch (err) {
    console.warn(err);
    setStorageStatus(`Pamięć lokalna: nie zapisano bazy (${err.message}).`);
  } finally {
    state.isSavingDataset = false;
  }
}

async function loadActiveDataset() {
  try {
    const saved = await idbGet(DATASET_STORE, ACTIVE_DATASET_ID);
    if (saved && Array.isArray(saved.stations) && saved.stations.length) return saved;
  } catch (err) {
    console.warn(err);
    setStorageStatus(`Pamięć lokalna: błąd odczytu (${err.message}).`);
  }
  return null;
}

async function clearActiveDataset() {
  try {
    await idbDelete(DATASET_STORE, ACTIVE_DATASET_ID);
    setStorageStatus('Pamięć lokalna: wyczyszczona. Odświeżono bazę z pliku stations.json.');
    await loadStationsFromUrl('stations.json', { forceNetwork: true, save: true });
  } catch (err) {
    setStatus(`Nie udało się wyczyścić bazy: ${err.message}`);
  }
}

function normalizeColumnName(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
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
    records_count: numberFromCell(getAliased(row, ['records_count', 'recordscount', 'rekordy'])) || 1,
    source: getAliased(row, ['source', 'zrodlo', 'źródło']) || 'import'
  });
}

function parseCsv(text) {
  const sample = text.slice(0, 5000);
  const delimiters = [';', ',', '\t'];
  let delimiter = ';';
  let best = -1;
  for (const d of delimiters) {
    const score = (sample.match(new RegExp(d === '\\t' ? '\\t' : `\\${d}`, 'g')) || []).length;
    if (score > best) { best = score; delimiter = d === '\\t' ? '\t' : d; }
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
  const rows = parseCsv(text);
  const stations = [];
  for (const row of rows) {
    const station = normalizeImportedRow(row);
    if (station) stations.push(station);
  }
  if (!stations.length) throw new Error('Nie znaleziono stacji z poprawnymi współrzędnymi. Sprawdź nazwy kolumn: lat/lon/operator/pasma/adres.');
  return stations;
}

async function parseXlsxStations(fileOrBuffer) {
  if (!window.XLSX) throw new Error(XLSX_CDN_NOTE);
  const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('Plik XLSX nie ma arkuszy.');
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
  const normalizedRows = rows.map(row => {
    const out = {};
    for (const [key, value] of Object.entries(row)) out[normalizeColumnName(key)] = value;
    return out;
  });
  const stations = [];
  for (const row of normalizedRows) {
    const station = normalizeImportedRow(row);
    if (station) stations.push(station);
  }
  if (!stations.length) throw new Error('Nie znaleziono stacji z poprawnymi współrzędnymi w XLSX.');
  return stations;
}

function buildSpatialIndex(stations) {
  const grid = new Map();
  for (const station of stations) {
    const key = spatialKey(station.latitude, station.longitude);
    let bucket = grid.get(key);
    if (!bucket) { bucket = []; grid.set(key, bucket); }
    bucket.push(station);
  }
  state.spatialGrid = grid;
}

function spatialKey(lat, lon) {
  return `${Math.floor(lat / SPATIAL_CELL_DEG)}:${Math.floor(lon / SPATIAL_CELL_DEG)}`;
}

function stationsFromBounds(bounds) {
  if (!state.spatialGrid.size) return state.stations;
  if (bounds.east < bounds.west) return state.stations;
  const latMin = Math.floor(bounds.south / SPATIAL_CELL_DEG);
  const latMax = Math.floor(bounds.north / SPATIAL_CELL_DEG);
  const lonMin = Math.floor(bounds.west / SPATIAL_CELL_DEG);
  const lonMax = Math.floor(bounds.east / SPATIAL_CELL_DEG);
  if ((latMax - latMin) * (lonMax - lonMin) > 1200) return state.stations;
  const out = [];
  for (let la = latMin; la <= latMax; la++) {
    for (let lo = lonMin; lo <= lonMax; lo++) {
      const bucket = state.spatialGrid.get(`${la}:${lo}`);
      if (bucket) out.push(...bucket);
    }
  }
  return out;
}

function radiusBounds(center, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.max(0.18, Math.cos(center.lat * Math.PI / 180)));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    west: center.lon - lonDelta,
    east: center.lon + lonDelta
  };
}

function normalizeRemoteUrl(url) {
  let out = String(url || '').trim();
  if (!out) throw new Error('Wklej link do pliku JSON/CSV/XLSX.');
  const driveFile = out.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  const driveOpen = out.match(/[?&]id=([^&]+)/);
  const driveSheets = out.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (driveSheets) {
    const gid = out.match(/[?&#]gid=([^&#]+)/)?.[1] || '0';
    return `https://docs.google.com/spreadsheets/d/${driveSheets[1]}/export?format=csv&gid=${gid}`;
  }
  if (driveFile || (out.includes('drive.google.com') && driveOpen)) {
    const id = driveFile?.[1] || driveOpen?.[1];
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (out.includes('dropbox.com')) out = out.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace(/[?&]dl=0/, '').replace(/[?&]raw=1/, '');
  return out;
}

function detectRemoteType(url, contentType) {
  const lower = url.toLowerCase();
  if (contentType.includes('json') || lower.includes('.json')) return 'json';
  if (contentType.includes('spreadsheet') || lower.includes('.xlsx') || lower.includes('.xls')) return 'xlsx';
  return 'csv';
}

function normalizeStation(raw) {
  const lat = numberFromCell(raw.latitude ?? raw.lat);
  const lon = numberFromCell(raw.longitude ?? raw.lon ?? raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const bands = Array.isArray(raw.bands) ? raw.bands.map(String).filter(Boolean) : splitListCell(raw.bands);
  const sectorIds = Array.isArray(raw.sector_ids) ? raw.sector_ids.map(String) : splitListCell(raw.sector_ids);
  const cellNames = Array.isArray(raw.cell_names) ? raw.cell_names.map(String) : splitListCell(raw.cell_names);
  const azimuths = Array.isArray(raw.azimuths) ? raw.azimuths.map(Number).filter(Number.isFinite) : splitListCell(raw.azimuths).map(numberFromCell).filter(Number.isFinite);
  const station = {
    station_id: String(raw.station_id ?? raw.id ?? '').trim() || '—',
    operator: String(raw.operator ?? 'Nieznany').trim() || 'Nieznany',
    latitude: lat,
    longitude: lon,
    address: String(raw.address ?? '').trim(),
    city: String(raw.city ?? '').trim(),
    bands,
    sector_ids: sectorIds,
    cell_names: cellNames,
    records_count: Number(raw.records_count ?? 0) || 0,
    source: String(raw.source ?? '').trim(),
    azimuths,
    range_km: Number.isFinite(numberFromCell(raw.range_km)) ? numberFromCell(raw.range_km) : null
  };
  station.key = stationKey(station);
  station.searchText = normalizeText(`${station.station_id} ${station.operator} ${station.city} ${station.address} ${station.bands.join(' ')}`);
  return station;
}

function parseStationsPayload(payload) {
  let items = payload;
  if (!Array.isArray(items) && payload && typeof payload === 'object') {
    items = payload.stations || payload.items || payload.data || [];
  }
  if (!Array.isArray(items)) throw new Error('Nieobsługiwany format pliku stations.json');
  const stations = [];
  for (const raw of items) {
    const station = normalizeStation(raw);
    if (station) stations.push(station);
  }
  return stations;
}

async function loadStationsFromUrl(url = 'stations.json', options = {}) {
  const normalizedUrl = url === 'stations.json' ? url : normalizeRemoteUrl(url);
  setStatus(`Ładowanie bazy z ${normalizedUrl === 'stations.json' ? 'stations.json' : 'linku'}…`);
  el.stationList.innerHTML = '<div class="loading-box">Ładowanie danych BTS…</div>';
  const response = await fetch(normalizedUrl, { cache: options.forceNetwork ? 'reload' : 'default' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  const type = detectRemoteType(normalizedUrl, contentType);
  let stations;
  if (type === 'json') {
    stations = parseStationsPayload(await response.json());
  } else if (type === 'xlsx') {
    stations = await parseXlsxStations(await response.arrayBuffer());
  } else {
    stations = parseCsvStations(await response.text());
  }
  setStations(stations, normalizedUrl === 'stations.json' ? 'stations.json' : normalizedUrl, { save: options.save !== false });
}

function setStations(stations, sourceName, options = {}) {
  state.stations = stations;
  state.dataSourceName = sourceName;
  state.dataLoaded = true;
  state.selected = null;
  buildSpatialIndex(stations);
  state.operators = ['Wszyscy', ...Array.from(new Set(stations.map(s => s.operator).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pl'))];
  const bandSet = new Set();
  for (const station of stations) for (const band of station.bands) bandSet.add(band);
  state.bands = ['Wszystkie', ...Array.from(bandSet).sort(bandSort)];
  if (!state.operators.includes(state.operator)) state.operator = 'Wszyscy';
  if (!state.bands.includes(state.band)) state.band = 'Wszystkie';
  fillSelect(el.operatorSelect, state.operators, state.operator);
  fillSelect(el.bandSelect, state.bands, state.band);
  el.totalCount.textContent = compactNumber(stations.length);
  el.datasetInfo.textContent = `Baza: ${compactNumber(stations.length)} stacji • ${sourceName}`;
  setStatus(`Gotowe • ${compactNumber(stations.length)} stacji • wersja ${APP_VERSION}`);
  if (options.save) saveActiveDataset(stations, sourceName);
  scheduleRender();
}

function bandSort(a, b) {
  const na = Number(String(a).match(/\d+/)?.[0] || 0);
  const nb = Number(String(b).match(/\d+/)?.[0] || 0);
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b), 'pl');
}

function fillSelect(select, values, selected) {
  select.innerHTML = '';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (value === selected) option.selected = true;
    select.appendChild(option);
  }
}

function latLonToPoint(lat, lon, zoom) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const sinLat = Math.sin((clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function pointToLatLon(x, y, zoom) {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lon = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lon };
}

function stationToScreen(station) {
  const centerPoint = latLonToPoint(state.center.lat, state.center.lon, state.zoom);
  const lat = station.latitude ?? station.lat;
  const lon = station.longitude ?? station.lon;
  const point = latLonToPoint(lat, lon, state.zoom);
  const rect = el.map.getBoundingClientRect();
  return {
    x: point.x - centerPoint.x + rect.width / 2,
    y: point.y - centerPoint.y + rect.height / 2
  };
}

function screenToLatLon(clientX, clientY) {
  const rect = el.map.getBoundingClientRect();
  const centerPoint = latLonToPoint(state.center.lat, state.center.lon, state.zoom);
  const x = centerPoint.x - rect.width / 2 + (clientX - rect.left);
  const y = centerPoint.y - rect.height / 2 + (clientY - rect.top);
  return pointToLatLon(x, y, state.zoom);
}

function getMapBounds(marginPx = 80) {
  const rect = el.map.getBoundingClientRect();
  const centerPoint = latLonToPoint(state.center.lat, state.center.lon, state.zoom);
  const topLeft = pointToLatLon(centerPoint.x - rect.width / 2 - marginPx, centerPoint.y - rect.height / 2 - marginPx, state.zoom);
  const bottomRight = pointToLatLon(centerPoint.x + rect.width / 2 + marginPx, centerPoint.y + rect.height / 2 + marginPx, state.zoom);
  return {
    north: topLeft.lat,
    south: bottomRight.lat,
    west: topLeft.lon,
    east: bottomRight.lon
  };
}

function renderTiles() {
  const rect = el.map.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const z = state.zoom;
  const centerPoint = latLonToPoint(state.center.lat, state.center.lon, z);
  const topLeftX = centerPoint.x - rect.width / 2;
  const topLeftY = centerPoint.y - rect.height / 2;
  const startX = Math.floor(topLeftX / TILE_SIZE);
  const startY = Math.floor(topLeftY / TILE_SIZE);
  const endX = Math.floor((topLeftX + rect.width) / TILE_SIZE);
  const endY = Math.floor((topLeftY + rect.height) / TILE_SIZE);
  const worldTiles = Math.pow(2, z);
  const fragment = document.createDocumentFragment();

  for (let x = startX; x <= endX; x++) {
    for (let y = startY; y <= endY; y++) {
      if (y < 0 || y >= worldTiles) continue;
      const wrappedX = ((x % worldTiles) + worldTiles) % worldTiles;
      const img = document.createElement('img');
      img.className = 'tile';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      img.style.left = `${Math.round(x * TILE_SIZE - topLeftX)}px`;
      img.style.top = `${Math.round(y * TILE_SIZE - topLeftY)}px`;
      img.src = getTileUrl(z, wrappedX, y);
      fragment.appendChild(img);
    }
  }
  el.tileLayer.replaceChildren(fragment);
}

function getTileUrl(z, x, y) {
  if (state.mapType === 'sat') {
    return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function scheduleRender() {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(renderAll, 45);
}

function renderAll() {
  renderTiles();
  const filtered = getFilteredStations();
  state.currentVisibleTotal = filtered.length;
  state.currentList = buildStationList(filtered);
  state.currentItems = buildRenderItems(filtered);
  drawOverlay();
  renderList();
  updateStats();
  updateMeasureMarker();
  saveSettings();
}

function getOrigin() {
  return state.measure || state.center;
}

function getFilteredStations() {
  if (!state.dataLoaded) return [];
  const bounds = getMapBounds();
  const search = normalizeText(state.search);
  const useGlobalSearch = search.length >= SEARCH_MIN_CHARS;
  const origin = getOrigin();
  const radius = Number.isFinite(state.radiusKm) ? state.radiusKm : null;
  const inViewOnly = !useGlobalSearch && !radius;
  const candidates = useGlobalSearch ? state.stations : stationsFromBounds(radius ? radiusBounds(origin, radius) : bounds);
  const result = [];

  for (const station of candidates) {
    if (state.operator !== 'Wszyscy' && station.operator !== state.operator) continue;
    if (state.band !== 'Wszystkie' && !station.bands.includes(state.band)) continue;
    if (useGlobalSearch && !station.searchText.includes(search)) continue;
    if (radius !== null && haversineKm(origin.lat, origin.lon, station.latitude, station.longitude) > radius) continue;
    if (inViewOnly) {
      if (station.latitude > bounds.north || station.latitude < bounds.south) continue;
      if (station.longitude < bounds.west || station.longitude > bounds.east) continue;
    }
    result.push(station);
  }
  return result;
}

function buildStationList(stations) {
  const origin = getOrigin();
  return stations
    .map(station => ({ station, distance: haversineKm(origin.lat, origin.lon, station.latitude, station.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LIST_ROWS)
    .map(item => item.station);
}

function buildRenderItems(stations) {
  const rect = el.map.getBoundingClientRect();
  const candidates = [];
  for (const station of stations) {
    const p = stationToScreen(station);
    if (p.x < -60 || p.y < -60 || p.x > rect.width + 60 || p.y > rect.height + 60) continue;
    candidates.push({ type: 'station', station, x: p.x, y: p.y });
  }

  const maxMarkers = rect.width < 700 ? MOBILE_MAX_MARKERS : MAX_MARKERS;
  if (candidates.length <= maxMarkers || state.zoom >= 13) return candidates.slice(0, maxMarkers);

  const cell = state.zoom <= 8 ? 96 : state.zoom <= 10 ? 72 : 56;
  const groups = new Map();
  for (const item of candidates) {
    const key = `${Math.floor(item.x / cell)}:${Math.floor(item.y / cell)}`;
    let group = groups.get(key);
    if (!group) {
      group = { type: 'cluster', count: 0, x: 0, y: 0, lat: 0, lon: 0, operators: new Map() };
      groups.set(key, group);
    }
    group.count++;
    group.x += item.x;
    group.y += item.y;
    group.lat += item.station.latitude;
    group.lon += item.station.longitude;
    group.operators.set(item.station.operator, (group.operators.get(item.station.operator) || 0) + 1);
  }

  const out = [];
  for (const group of groups.values()) {
    if (group.count === 1) {
      const nearest = candidates.find(item => Math.abs(item.x - group.x) < 0.001 && Math.abs(item.y - group.y) < 0.001);
      if (nearest) out.push(nearest);
      continue;
    }
    group.x /= group.count;
    group.y /= group.count;
    group.lat /= group.count;
    group.lon /= group.count;
    out.push(group);
  }
  return out.slice(0, maxMarkers);
}

function resizeCanvas() {
  const rect = el.map.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  el.canvas.width = Math.max(1, Math.round(rect.width * dpr));
  el.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  el.canvas.style.width = `${rect.width}px`;
  el.canvas.style.height = `${rect.height}px`;
  const ctx = el.canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawOverlay() {
  resizeCanvas();
  const ctx = el.canvas.getContext('2d');
  const rect = el.map.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (state.selected) drawSelectedStationExtras(ctx);
  for (const item of state.currentItems) {
    if (item.type === 'cluster') drawCluster(ctx, item);
    else drawMarker(ctx, item.station, item.x, item.y, state.selected && item.station.key === state.selected.key);
  }
}

function drawMarker(ctx, station, x, y, selected) {
  const color = operatorColor(station.operator);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, selected ? 10 : 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(29,78,216,.35)';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCluster(ctx, cluster) {
  const mainOperator = Array.from(cluster.operators.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const color = operatorColor(mainOperator);
  const r = clamp(14 + Math.log10(cluster.count) * 8, 18, 34);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cluster.x, cluster.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.88;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(compactClusterCount(cluster.count), cluster.x, cluster.y);
  ctx.restore();
}

function compactClusterCount(value) {
  return value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value);
}

function drawSelectedStationExtras(ctx) {
  const station = state.selected;
  const stationPoint = stationToScreen(station);
  const origin = getOrigin();
  const originPoint = stationToScreen({ latitude: origin.lat, longitude: origin.lon });
  const range = estimateStationRangeKm(station);

  drawSectors(ctx, station, range);

  if (state.measure) {
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(14,165,233,.9)';
    ctx.beginPath();
    ctx.moveTo(originPoint.x, originPoint.y);
    ctx.lineTo(stationPoint.x, stationPoint.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawSectors(ctx, station, rangeKm) {
  const azimuths = stationSectorAzimuths(station);
  const center = stationToScreen(station);
  const rangePxPoint = stationToScreen(destinationPoint(station.latitude, station.longitude, 90, rangeKm));
  const radiusPx = Math.abs(rangePxPoint.x - center.x);
  if (!Number.isFinite(radiusPx) || radiusPx < 12 || radiusPx > 3000) return;

  const estimated = !station.azimuths || !station.azimuths.length;
  const halfWidth = estimated ? 70 : 55;
  const color = hexToRgb(operatorColor(station.operator));
  ctx.save();
  for (const az of azimuths) {
    drawSector(ctx, center.x, center.y, radiusPx, az - halfWidth, az + halfWidth, `rgba(${color.r},${color.g},${color.b},.16)`);
    drawSector(ctx, center.x, center.y, radiusPx * 0.58, az - halfWidth * 0.55, az + halfWidth * 0.55, `rgba(${color.r},${color.g},${color.b},.22)`);
  }
  ctx.restore();
}

function drawSector(ctx, x, y, radius, startDeg, endDeg, fill) {
  const start = ((startDeg - 90) * Math.PI) / 180;
  const end = ((endDeg - 90) * Math.PI) / 180;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, radius, start, end);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function stationSectorAzimuths(station) {
  if (station.azimuths && station.azimuths.length) return station.azimuths.slice(0, 6);
  return [0, 120, 240];
}

function estimateStationRangeKm(station) {
  if (Number.isFinite(station.range_km) && station.range_km > 0) return station.range_km;
  const bands = station.bands.join(' ').toUpperCase();
  if (bands.includes('3500') || bands.includes('3600') || bands.includes('3700') || bands.includes('NR78')) return 1.5;
  if (bands.includes('2600')) return 2.5;
  if (bands.includes('2100')) return 4.0;
  if (bands.includes('1800')) return 5.0;
  if (bands.includes('800') || bands.includes('900') || bands.includes('GSM900')) return 8.0;
  return 4.0;
}

function renderList() {
  if (!state.dataLoaded) return;
  const origin = getOrigin();
  el.stationList.innerHTML = '';
  if (!state.currentList.length) {
    el.stationList.innerHTML = '<div class="loading-box">Brak stacji dla aktualnych filtrów.</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const station of state.currentList) {
    const distance = haversineKm(origin.lat, origin.lon, station.latitude, station.longitude);
    const az = azimuthDeg(origin.lat, origin.lon, station.latitude, station.longitude);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `station-row${state.selected && state.selected.key === station.key ? ' active' : ''}`;
    row.innerHTML = `
      <div class="station-row-title">
        <span>${escapeHtml(station.city || station.station_id)}</span>
        <span class="operator-pill" style="background:${operatorColor(station.operator)}">${escapeHtml(station.operator)}</span>
      </div>
      <div class="station-row-sub">ID: ${escapeHtml(station.station_id)} • ${formatDistance(distance)} • azymut ${Math.round(az)}°</div>
      <div class="station-row-sub">${escapeHtml(formatBands(station.bands))}</div>
      <div class="station-row-sub">${escapeHtml(shorten(station.address, 90))}</div>`;
    row.addEventListener('click', () => selectStation(station, true));
    fragment.appendChild(row);
  }
  el.stationList.appendChild(fragment);
}

function updateStats() {
  el.visibleCount.textContent = compactNumber(state.currentVisibleTotal);
  el.zoomValue.textContent = String(state.zoom);
  el.listSubtitle.textContent = state.measure ? 'Najbliższe względem punktu pomiarowego' : 'Najbliższe względem środka mapy';
}

function updateMeasureMarker() {
  if (!state.measure) {
    el.measureMarker.classList.add('hidden');
    return;
  }
  const p = stationToScreen({ latitude: state.measure.lat, longitude: state.measure.lon });
  el.measureMarker.style.left = `${p.x}px`;
  el.measureMarker.style.top = `${p.y}px`;
  el.measureMarker.classList.remove('hidden');
}

function selectStation(station, centerOnMap = false) {
  state.selected = station;
  if (centerOnMap) state.center = { lat: station.latitude, lon: station.longitude };
  showStationDetails(station);
  renderAll();
}

function showStationDetails(station) {
  const origin = getOrigin();
  const distance = haversineKm(origin.lat, origin.lon, station.latitude, station.longitude);
  const az = azimuthDeg(origin.lat, origin.lon, station.latitude, station.longitude);
  const range = estimateStationRangeKm(station);
  const realAz = station.azimuths && station.azimuths.length;
  el.detailTitle.textContent = `${station.operator} • ${station.city || station.station_id}`;
  el.detailSubtitle.textContent = `ID ${station.station_id} • ${formatDistance(distance)} • ${Math.round(az)}°`;
  el.detailBody.innerHTML = `
    ${detailLine('Adres', station.address || '—')}
    ${detailLine('Pasma', formatBands(station.bands))}
    ${detailLine('Zasięg', `${range.toFixed(1)} km ${station.range_km ? '' : '(orientacyjnie)'}`)}
    ${detailLine('Sektory', realAz ? station.azimuths.map(a => `${Math.round(a)}°`).join(', ') : 'Brak realnych azymutów — układ orientacyjny 0°/120°/240°')}
    ${detailLine('Rekordy', station.records_count || '—')}
    ${detailLine('Źródło', station.source || '—')}
    ${detailLine('Współrzędne', `${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`)}
  `;
  el.detailCard.classList.remove('hidden');
}

function detailLine(label, value) {
  return `<div class="line"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`;
}

function hideDetails() {
  state.selected = null;
  el.detailCard.classList.add('hidden');
  renderAll();
}

function formatBands(bands) {
  return bands && bands.length ? bands.join(', ') : 'Brak danych';
}

function shorten(value, maxLen) {
  const text = String(value || '—');
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function azimuthDeg(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function destinationPoint(lat, lon, bearingDeg, distanceKm) {
  const R = 6371.0088;
  const delta = distanceKm / R;
  const theta = bearingDeg * Math.PI / 180;
  const phi1 = lat * Math.PI / 180;
  const lambda1 = lon * Math.PI / 180;
  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(sinPhi2);
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2);
  const lambda2 = lambda1 + Math.atan2(y, x);
  const outLon = ((lambda2 * 180 / Math.PI + 540) % 360) - 180;
  const outLat = phi2 * 180 / Math.PI;
  return { latitude: outLat, longitude: outLon, lat: outLat, lon: outLon };
}

function zoomTo(newZoom, anchorClientX = null, anchorClientY = null) {
  newZoom = clamp(Math.round(newZoom), MIN_ZOOM, MAX_ZOOM);
  if (newZoom === state.zoom) return;
  if (anchorClientX !== null && anchorClientY !== null) {
    const before = screenToLatLon(anchorClientX, anchorClientY);
    const rect = el.map.getBoundingClientRect();
    state.zoom = newZoom;
    const anchorPoint = latLonToPoint(before.lat, before.lon, state.zoom);
    const centerPoint = {
      x: anchorPoint.x - (anchorClientX - rect.left - rect.width / 2),
      y: anchorPoint.y - (anchorClientY - rect.top - rect.height / 2)
    };
    state.center = pointToLatLon(centerPoint.x, centerPoint.y, state.zoom);
  } else {
    state.zoom = newZoom;
  }
  scheduleRender();
}

function bindEvents() {
  el.searchInput.addEventListener('input', () => { state.search = el.searchInput.value; scheduleRender(); });
  el.operatorSelect.addEventListener('change', () => { state.operator = el.operatorSelect.value; scheduleRender(); });
  el.bandSelect.addEventListener('change', () => { state.band = el.bandSelect.value; scheduleRender(); });
  el.radiusSelect.addEventListener('change', () => { state.radiusKm = el.radiusSelect.value ? Number(el.radiusSelect.value) : null; scheduleRender(); });
  el.themeBtn.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveSettings(); });
  el.closeDetailBtn.addEventListener('click', hideDetails);
  el.refreshBtn.addEventListener('click', () => loadStationsFromUrl('stations.json', { forceNetwork: true, save: true }).catch(showLoadError));
  el.importFileBtn.addEventListener('click', () => el.dataFileInput.click());
  el.dataFileInput.addEventListener('change', importDataFile);
  el.loadUrlBtn.addEventListener('click', loadRemoteInput);
  el.clearCacheBtn.addEventListener('click', clearActiveDataset);
  el.locateBtn.addEventListener('click', locateUser);
  el.zoomInBtn.addEventListener('click', () => zoomTo(state.zoom + 1));
  el.zoomOutBtn.addEventListener('click', () => zoomTo(state.zoom - 1));
  el.clearPointBtn.addEventListener('click', clearMeasurePoint);
  el.setPointBtn.addEventListener('click', toggleSetPointMode);
  el.mapPlanBtn.addEventListener('click', () => setMapType('plan'));
  el.mapSatBtn.addEventListener('click', () => setMapType('sat'));
  el.nearestBtn.addEventListener('click', showNearest);
  el.installBtn.addEventListener('click', installPwa);
  bindMapPointerEvents();
  window.addEventListener('resize', scheduleRender);
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    el.installBtn.classList.remove('hidden');
  });
}

function setMapType(type) {
  state.mapType = type;
  el.mapPlanBtn.classList.toggle('active', type === 'plan');
  el.mapSatBtn.classList.toggle('active', type === 'sat');
  scheduleRender();
}

function toggleSetPointMode() {
  state.setPointMode = !state.setPointMode;
  el.setPointBtn.classList.toggle('active', state.setPointMode);
  el.setPointBtn.textContent = state.setPointMode ? 'Kliknij punkt na mapie' : 'Ustaw punkt z mapy';
}

function clearMeasurePoint() {
  state.measure = null;
  scheduleRender();
}

function setMeasurePoint(latLon) {
  state.measure = { lat: latLon.lat, lon: latLon.lon };
  state.setPointMode = false;
  el.setPointBtn.classList.remove('active');
  el.setPointBtn.textContent = 'Ustaw punkt z mapy';
  scheduleRender();
}

function showNearest() {
  const origin = getOrigin();
  const nearest = state.stations
    .filter(station => state.operator === 'Wszyscy' || station.operator === state.operator)
    .filter(station => state.band === 'Wszystkie' || station.bands.includes(state.band))
    .map(station => ({ station, distance: haversineKm(origin.lat, origin.lon, station.latitude, station.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LIST_ROWS)
    .map(item => item.station);
  state.currentList = nearest;
  state.currentVisibleTotal = nearest.length;
  renderList();
  updateStats();
  setStatus(`Pokazuję najbliższe stacje względem ${state.measure ? 'punktu pomiarowego' : 'środka mapy'}.`);
}

function locateUser() {
  if (!navigator.geolocation) {
    setStatus('Ta przeglądarka nie obsługuje GPS.');
    return;
  }
  setStatus('Pobieram pozycję GPS…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.center = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      state.measure = { ...state.center };
      state.zoom = Math.max(state.zoom, 13);
      setStatus(`Pozycja GPS ustawiona • dokładność ok. ${Math.round(pos.coords.accuracy)} m`);
      scheduleRender();
    },
    err => setStatus(`GPS niedostępny: ${err.message}`),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
  );
}

async function importDataFile() {
  const file = el.dataFileInput.files && el.dataFileInput.files[0];
  if (!file) return;
  try {
    setStatus(`Wczytuję ${file.name}…`);
    const name = file.name.toLowerCase();
    let stations;
    if (name.endsWith('.json') || file.type.includes('json')) {
      stations = parseStationsPayload(JSON.parse(await file.text()));
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      stations = await parseXlsxStations(file);
    } else {
      stations = parseCsvStations(await file.text());
    }
    setStations(stations, file.name, { save: true });
  } catch (err) {
    setStatus(`Błąd importu pliku: ${err.message}`);
  } finally {
    el.dataFileInput.value = '';
  }
}

async function loadRemoteInput() {
  try {
    const url = el.remoteUrlInput.value.trim();
    await loadStationsFromUrl(url, { forceNetwork: true, save: true });
  } catch (err) {
    setStatus(`Błąd pobierania z linku: ${err.message}`);
  }
}

async function installPwa() {
  if (!state.deferredInstallPrompt) return;
  state.deferredInstallPrompt.prompt();
  await state.deferredInstallPrompt.userChoice;
  state.deferredInstallPrompt = null;
  el.installBtn.classList.add('hidden');
}

function bindMapPointerEvents() {
  let pointer = null;
  el.map.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    el.map.setPointerCapture(event.pointerId);
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      centerPoint: latLonToPoint(state.center.lat, state.center.lon, state.zoom),
      moved: false
    };
  });

  el.map.addEventListener('pointermove', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pointer.moved = true;
    const p = { x: pointer.centerPoint.x - dx, y: pointer.centerPoint.y - dy };
    state.center = pointToLatLon(p.x, p.y, state.zoom);
    renderTiles();
    drawOverlay();
    updateMeasureMarker();
  });

  el.map.addEventListener('pointerup', (event) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const wasMoved = pointer.moved;
    pointer = null;
    if (!wasMoved) handleMapClick(event.clientX, event.clientY);
    else scheduleRender();
  });

  el.map.addEventListener('pointercancel', () => { pointer = null; scheduleRender(); });
  el.map.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomTo(state.zoom + (event.deltaY < 0 ? 1 : -1), event.clientX, event.clientY);
  }, { passive: false });
}

function handleMapClick(clientX, clientY) {
  if (state.setPointMode) {
    setMeasurePoint(screenToLatLon(clientX, clientY));
    return;
  }
  const rect = el.map.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = null;
  let bestDist = Infinity;
  for (const item of state.currentItems) {
    const dx = item.x - x;
    const dy = item.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const hit = item.type === 'cluster' ? clamp(15 + Math.log10(item.count) * 8, 20, 38) : 18;
    if (dist <= hit && dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  if (!best) return;
  if (best.type === 'cluster') {
    state.center = { lat: best.lat, lon: best.lon };
    state.zoom = clamp(state.zoom + 2, MIN_ZOOM, MAX_ZOOM);
    scheduleRender();
  } else {
    selectStation(best.station, false);
  }
}

function showLoadError(err) {
  console.error(err);
  setStatus(`Nie udało się wczytać bazy: ${err.message}. Uruchom przez serwer lokalny albo zaimportuj JSON/CSV/XLSX.`);
  el.stationList.innerHTML = '<div class="loading-box">Nie udało się wczytać bazy. Kliknij „Import pliku” albo uruchom przez serwer HTTP.</div>';
  setStorageStatus('Pamięć lokalna: brak działającej bazy.');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

async function boot() {
  initElements();
  loadSettings();
  applyTheme();
  bindEvents();
  setMapType(state.mapType);
  el.radiusSelect.value = state.radiusKm ?? '';
  registerServiceWorker();
  renderTiles();
  setStorageStatus('Pamięć lokalna: sprawdzanie…');
  const saved = await loadActiveDataset();
  if (saved) {
    const date = saved.savedAt ? new Date(saved.savedAt).toLocaleString('pl-PL') : 'brak daty';
    setStations(saved.stations.map(normalizeStation).filter(Boolean), `${saved.sourceName || 'zapisana baza'} • zapis ${date}`, { save: false });
    setStorageStatus(`Pamięć lokalna: użyto zapisanej bazy z ${date}.`);
    return;
  }
  setStorageStatus('Pamięć lokalna: brak zapisanej bazy, wczytuję stations.json…');
  loadStationsFromUrl('stations.json', { forceNetwork: false, save: true }).catch(showLoadError);
}

document.addEventListener('DOMContentLoaded', boot);
