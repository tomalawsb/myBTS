'use strict';

const APP_VERSION = '3.1 - 1205261410';
const DEFAULT_CENTER = [50.2872, 21.4231];
const DEFAULT_ZOOM = 10;
const MIN_ZOOM = 5;
const MAX_ZOOM = 18;
const MAX_LIST_ROWS = 140;
const MAX_MAP_OBJECTS_DESKTOP = 520;
const MAX_MAP_OBJECTS_MOBILE = 210;
const SEARCH_MIN_CHARS = 2;
const SETTINGS_KEY = 'mybts-web-settings-v3';
const DB_NAME = 'mybts-web-db-v3';
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
  spatialGrid: new Map(),
  operators: ['Wszyscy'],
  bands: ['Wszystkie'],
  center: DEFAULT_CENTER.slice(),
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
  activeTab: 'filters',
  currentList: [],
  currentVisibleTotal: 0,
  renderTimer: null,
  searchTimer: null,
  panelMode: 'half',
  panelDrag: null,
  dataSourceName: '',
  deferredInstallPrompt: null,
  workerSeq: 0,
  worker: null,
  map: null,
  planLayer: null,
  satLayer: null,
  markerLayer: null,
  sectorLayer: null,
  measureLayer: null,
  userMarker: null
};

const el = {};

function initElements() {
  Object.assign(el, {
    body: document.body,
    statusText: document.getElementById('statusText'),
    datasetInfo: document.getElementById('datasetInfo'),
    map: document.getElementById('map'),
    appPanel: document.getElementById('appPanel'),
    panelTitle: document.getElementById('panelTitle'),
    collapsePanelBtn: document.getElementById('collapsePanelBtn'),
    menuBtn: document.getElementById('menuBtn'),
    panelHandle: document.querySelector('.panel-handle'),
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    submitSearchBtn: document.getElementById('submitSearchBtn'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    operatorSelect: document.getElementById('operatorSelect'),
    bandSelect: document.getElementById('bandSelect'),
    radiusSelect: document.getElementById('radiusSelect'),
    totalCount: document.getElementById('totalCount'),
    visibleCount: document.getElementById('visibleCount'),
    zoomValue: document.getElementById('zoomValue'),
    stationList: document.getElementById('stationList'),
    listSubtitle: document.getElementById('listSubtitle'),
    detailCard: document.getElementById('detailCard'),
    emptyDetails: document.getElementById('emptyDetails'),
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
    setPointBtn: document.getElementById('setPointBtn'),
    clearPointBtn: document.getElementById('clearPointBtn'),
    mapPlanBtn: document.getElementById('mapPlanBtn'),
    mapSatBtn: document.getElementById('mapSatBtn'),
    nearestBtn: document.getElementById('nearestBtn'),
    tabs: Array.from(document.querySelectorAll('.tab')),
    tabPanels: {
      filters: document.getElementById('tabFilters'),
      list: document.getElementById('tabList'),
      details: document.getElementById('tabDetails'),
      settings: document.getElementById('tabSettings')
    }
  });
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (Number.isFinite(parsed.lat) && Number.isFinite(parsed.lon)) state.center = [parsed.lat, parsed.lon];
    if (Number.isFinite(parsed.zoom)) state.zoom = clamp(Math.round(parsed.zoom), MIN_ZOOM, MAX_ZOOM);
    if (parsed.mapType === 'sat' || parsed.mapType === 'plan') state.mapType = parsed.mapType;
    if (parsed.theme === 'dark' || parsed.theme === 'light') state.theme = parsed.theme;
    if (parsed.operator) state.operator = parsed.operator;
    if (parsed.band) state.band = parsed.band;
    if (parsed.activeTab) state.activeTab = parsed.activeTab;
    if (['collapsed', 'half', 'full'].includes(parsed.panelMode)) state.panelMode = parsed.panelMode;
    state.radiusKm = parsed.radiusKm === null || parsed.radiusKm === '' || parsed.radiusKm === undefined ? null : Number(parsed.radiusKm);
  } catch (_) {}
}

function saveSettings() {
  const center = state.map ? state.map.getCenter() : { lat: state.center[0], lng: state.center[1] };
  const payload = {
    lat: center.lat,
    lon: center.lng,
    zoom: state.map ? state.map.getZoom() : state.zoom,
    mapType: state.mapType,
    theme: state.theme,
    operator: state.operator,
    band: state.band,
    radiusKm: state.radiusKm,
    activeTab: state.activeTab,
    panelMode: state.panelMode
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
}

function setStatus(text) {
  el.statusText.textContent = text;
}

function setStorageStatus(text) {
  if (el.storageStatus) el.storageStatus.textContent = text;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compactNumber(value) {
  return new Intl.NumberFormat('pl-PL').format(value || 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function operatorColor(operator) {
  return OPERATOR_COLORS[operator] || '#3478f6';
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 900px)').matches;
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
    setStorageStatus('Pamięć lokalna: wyczyszczona. Wczytuję stations.json…');
    await loadStationsFromUrl('stations.json', { forceNetwork: true, save: true });
  } catch (err) {
    setStatus(`Nie udało się wyczyścić bazy: ${err.message}`);
  }
}

function ensureWorker() {
  if (state.worker) return state.worker;
  if (!window.Worker) return null;
  state.worker = new Worker('data-worker.js');
  return state.worker;
}

function workerRequest(payload) {
  return new Promise((resolve, reject) => {
    const worker = ensureWorker();
    if (!worker) {
      reject(new Error('Ta przeglądarka nie obsługuje Web Workera.'));
      return;
    }
    const id = ++state.workerSeq;
    const cleanup = () => worker.removeEventListener('message', onMessage);
    const onMessage = (event) => {
      const msg = event.data || {};
      if (msg.id !== id) return;
      if (msg.type === 'status') {
        setStatus(msg.text);
        return;
      }
      cleanup();
      if (msg.type === 'error') reject(new Error(msg.message || 'Błąd przetwarzania danych.'));
      else resolve(msg);
    };
    worker.addEventListener('message', onMessage);
    worker.postMessage({ ...payload, id });
  });
}

function initMap() {
  if (!window.L) {
    setStatus('Nie wczytano biblioteki Leaflet. Sprawdź internet albo cache przeglądarki.');
    return;
  }

  state.map = L.map('map', {
    center: state.center,
    zoom: state.zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    zoomControl: false,
    inertia: true,
    tap: true,
    attributionControl: true
  });

  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  state.planLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  });

  state.satLayer = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  });

  state.markerLayer = L.layerGroup().addTo(state.map);
  state.sectorLayer = L.layerGroup().addTo(state.map);
  state.measureLayer = L.layerGroup().addTo(state.map);

  setMapType(state.mapType, false);

  state.map.on('moveend zoomend resize', () => {
    const center = state.map.getCenter();
    state.center = [center.lat, center.lng];
    state.zoom = state.map.getZoom();
    scheduleRender();
    saveSettings();
  });

  state.map.on('click', event => {
    if (state.setPointMode) setMeasurePoint(event.latlng);
  });
}

function setMapType(type, rerender = true) {
  state.mapType = type === 'sat' ? 'sat' : 'plan';
  if (state.map) {
    if (state.mapType === 'sat') {
      if (state.map.hasLayer(state.planLayer)) state.map.removeLayer(state.planLayer);
      state.satLayer.addTo(state.map);
    } else {
      if (state.map.hasLayer(state.satLayer)) state.map.removeLayer(state.satLayer);
      state.planLayer.addTo(state.map);
    }
  }
  el.mapPlanBtn.classList.toggle('active', state.mapType === 'plan');
  el.mapSatBtn.classList.toggle('active', state.mapType === 'sat');
  saveSettings();
  if (rerender) scheduleRender();
}

function normalizeStationForMain(raw) {
  const station = { ...raw };
  station.latitude = Number(station.latitude);
  station.longitude = Number(station.longitude);
  station.bands = Array.isArray(station.bands) && station.bands.length ? station.bands.map(String) : ['Nieznane'];
  station.azimuths = Array.isArray(station.azimuths) ? station.azimuths.map(Number).filter(Number.isFinite) : [];
  station.sector_ids = Array.isArray(station.sector_ids) ? station.sector_ids : [];
  station.cell_names = Array.isArray(station.cell_names) ? station.cell_names : [];
  station.records_count = Number(station.records_count || 1) || 1;
  station._search = station._search || normalizeText([
    station.station_id,
    station.operator,
    station.city,
    station.address,
    station.bands.join(' '),
    station.source
  ].join(' • '));
  return Number.isFinite(station.latitude) && Number.isFinite(station.longitude) ? station : null;
}

function setStations(stations, sourceName, options = {}) {
  const normalized = [];
  const seen = new Set();
  for (const raw of stations || []) {
    const station = normalizeStationForMain(raw);
    if (!station) continue;
    const key = `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(station);
  }

  state.stations = normalized;
  state.dataSourceName = sourceName || 'baza';
  buildSpatialIndex(state.stations);
  buildFilterOptions();
  fillSelect(el.operatorSelect, state.operators, state.operator);
  fillSelect(el.bandSelect, state.bands, state.band);
  el.datasetInfo.textContent = `Baza: ${state.dataSourceName} • ${compactNumber(state.stations.length)} stacji`;
  setStatus(`Wczytano ${compactNumber(state.stations.length)} stacji.`);
  if (options.fit) fitMapToStations(state.stations);
  if (options.save) saveActiveDataset(state.stations, state.dataSourceName);
  if (state.search.length >= SEARCH_MIN_CHARS) runSearch({ center: false, showPanel: false });
  else scheduleRender();
}

function buildSpatialIndex(stations) {
  const grid = new Map();
  for (const station of stations) {
    const key = spatialKey(station.latitude, station.longitude);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(station);
  }
  state.spatialGrid = grid;
}

function spatialKey(lat, lon) {
  return `${Math.floor(lat / SPATIAL_CELL_DEG)}:${Math.floor(lon / SPATIAL_CELL_DEG)}`;
}

function stationsFromBounds(bounds) {
  if (!bounds || !state.spatialGrid.size) return [];
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const minLat = Math.floor(south / SPATIAL_CELL_DEG);
  const maxLat = Math.floor(north / SPATIAL_CELL_DEG);
  const minLon = Math.floor(west / SPATIAL_CELL_DEG);
  const maxLon = Math.floor(east / SPATIAL_CELL_DEG);
  const out = [];
  for (let lat = minLat; lat <= maxLat; lat++) {
    for (let lon = minLon; lon <= maxLon; lon++) {
      const bucket = state.spatialGrid.get(`${lat}:${lon}`);
      if (!bucket) continue;
      for (const station of bucket) {
        if (bounds.contains([station.latitude, station.longitude])) out.push(station);
      }
    }
  }
  return out;
}

function buildFilterOptions() {
  const operators = new Set();
  const bands = new Set();
  for (const station of state.stations) {
    operators.add(station.operator || 'Nieznany');
    for (const band of station.bands || []) bands.add(band);
  }
  state.operators = ['Wszyscy', ...Array.from(operators).sort((a, b) => a.localeCompare(b, 'pl'))];
  state.bands = ['Wszystkie', ...Array.from(bands).sort(bandSort)];
  if (!state.operators.includes(state.operator)) state.operator = 'Wszyscy';
  if (!state.bands.includes(state.band)) state.band = 'Wszystkie';
}

function bandSort(a, b) {
  const order = ['GSM900', 'UMTS900', 'LTE800', 'LTE900', 'LTE1800', 'LTE2100', 'LTE2600', 'NR2100', 'NR3500', '5G'];
  const ia = order.findIndex(item => normalizeText(a).includes(normalizeText(item)));
  const ib = order.findIndex(item => normalizeText(b).includes(normalizeText(item)));
  if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  return a.localeCompare(b, 'pl', { numeric: true });
}

function fillSelect(select, values, selected) {
  select.innerHTML = values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
  select.value = values.includes(selected) ? selected : values[0];
}

function scheduleRender() {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(renderMapAndList, 60);
}

function renderMapAndList() {
  if (!state.map || !state.markerLayer) return;
  const candidates = getVisibleCandidates();
  const filtered = candidates.filter(matchesFilters);
  const origin = getOrigin();

  state.currentVisibleTotal = filtered.length;
  state.currentList = filtered
    .map(station => ({ station, distance: haversineKm(origin.lat, origin.lng, station.latitude, station.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LIST_ROWS)
    .map(item => item.station);

  renderMarkers(filtered);
  renderList();
  updateMeasureMarker();
  updateStats();
  saveSettings();
}

function getVisibleCandidates() {
  if (!state.map) return [];
  if (state.search.length >= SEARCH_MIN_CHARS) return searchStations(state.search, 800);
  const bounds = state.map.getBounds().pad(0.18);
  const candidates = stationsFromBounds(bounds);
  return candidates.length ? candidates : state.stations.slice(0, 0);
}

function matchesFilters(station) {
  if (state.operator !== 'Wszyscy' && station.operator !== state.operator) return false;
  if (state.band !== 'Wszystkie' && !(station.bands || []).includes(state.band)) return false;
  if (state.search.length >= SEARCH_MIN_CHARS && !station._search.includes(normalizeText(state.search))) return false;
  if (Number.isFinite(state.radiusKm) && state.radiusKm > 0) {
    const origin = getOrigin();
    if (haversineKm(origin.lat, origin.lng, station.latitude, station.longitude) > state.radiusKm) return false;
  }
  return true;
}

function renderMarkers(stations) {
  state.markerLayer.clearLayers();
  state.sectorLayer.clearLayers();
  if (!stations.length) return;

  const limit = isMobileLayout() ? MAX_MAP_OBJECTS_MOBILE : MAX_MAP_OBJECTS_DESKTOP;
  const shouldCluster = stations.length > limit || state.map.getZoom() < 13;
  const items = shouldCluster ? buildClusters(stations) : stations.map(station => ({ type: 'station', station }));

  let rendered = 0;
  for (const item of items) {
    if (rendered >= limit) break;
    if (item.type === 'cluster') renderCluster(item);
    else renderStationMarker(item.station);
    rendered++;
  }
}

function buildClusters(stations) {
  const zoom = state.map.getZoom();
  const gridSize = zoom < 10 ? 80 : zoom < 13 ? 64 : 54;
  const cells = new Map();
  for (const station of stations) {
    const point = state.map.latLngToContainerPoint([station.latitude, station.longitude]);
    const key = `${Math.floor(point.x / gridSize)}:${Math.floor(point.y / gridSize)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { type: 'cluster', count: 0, lat: 0, lng: 0, stations: [], operators: new Map() };
      cells.set(key, cell);
    }
    cell.count++;
    cell.lat += station.latitude;
    cell.lng += station.longitude;
    cell.stations.push(station);
    cell.operators.set(station.operator, (cell.operators.get(station.operator) || 0) + 1);
  }

  const result = [];
  for (const cell of cells.values()) {
    if (cell.count === 1) result.push({ type: 'station', station: cell.stations[0] });
    else {
      cell.lat /= cell.count;
      cell.lng /= cell.count;
      result.push(cell);
    }
  }
  return result.sort((a, b) => (b.count || 1) - (a.count || 1));
}

function renderStationMarker(station) {
  const color = operatorColor(station.operator);
  const radius = state.selected && stationKey(station) === stationKey(state.selected) ? 10 : 7;
  const marker = L.circleMarker([station.latitude, station.longitude], {
    radius,
    color: '#ffffff',
    weight: 2,
    fillColor: color,
    fillOpacity: .92
  });
  marker.on('click', () => selectStation(station, false));
  marker.bindPopup(() => popupHtml(station));
  marker.addTo(state.markerLayer);
}

function renderCluster(cluster) {
  const size = clamp(34 + Math.log10(cluster.count) * 11, 36, 62);
  const marker = L.marker([cluster.lat, cluster.lng], {
    icon: L.divIcon({
      html: `<span>${compactClusterCount(cluster.count)}</span>`,
      className: 'cluster-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    })
  });
  marker.on('click', () => {
    state.map.setView([cluster.lat, cluster.lng], clamp(state.map.getZoom() + 2, MIN_ZOOM, MAX_ZOOM), { animate: true });
  });
  marker.addTo(state.markerLayer);
}

function compactClusterCount(value) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(value);
}

function popupHtml(station) {
  return `
    <div class="popup-title">${escapeHtml(station.operator)} • ${escapeHtml(station.station_id)}</div>
    <div class="popup-meta">${escapeHtml(station.city || station.address || 'Brak lokalizacji')}</div>
  `;
}

function selectStation(station, centerOnMap = true) {
  state.selected = station;
  if (centerOnMap && state.map) state.map.setView([station.latitude, station.longitude], Math.max(state.map.getZoom(), 14), { animate: true });
  showStationDetails(station);
  renderSelectedStationExtras(station);
  if (isMobileLayout()) {
    setTab('details');
    el.appPanel.classList.remove('collapsed');
  }
  scheduleRender();
}

function renderSelectedStationExtras(station) {
  state.sectorLayer.clearLayers();
  if (!station || !Array.isArray(station.azimuths) || !station.azimuths.length) return;
  const rangeKm = estimateStationRangeKm(station);
  for (const azimuth of station.azimuths) {
    const polygon = sectorPolygon(station.latitude, station.longitude, azimuth, rangeKm, 34);
    L.polygon(polygon, {
      color: operatorColor(station.operator),
      weight: 1,
      fillColor: operatorColor(station.operator),
      fillOpacity: .14,
      interactive: false
    }).addTo(state.sectorLayer);
  }
}

function sectorPolygon(lat, lon, bearing, rangeKm, widthDeg) {
  const points = [[lat, lon]];
  const start = bearing - widthDeg / 2;
  const end = bearing + widthDeg / 2;
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const b = start + (end - start) * (i / steps);
    const dest = destinationPoint(lat, lon, b, rangeKm);
    points.push([dest.lat, dest.lng]);
  }
  points.push([lat, lon]);
  return points;
}

function estimateStationRangeKm(station) {
  if (Number.isFinite(station.range_km) && station.range_km > 0) return station.range_km;
  const normalizedBands = (station.bands || []).map(normalizeText).join(' ');
  if (normalizedBands.includes('nr3500')) return 1.5;
  if (normalizedBands.includes('lte2600')) return 2.5;
  if (normalizedBands.includes('lte2100') || normalizedBands.includes('nr2100')) return 4;
  if (normalizedBands.includes('lte1800')) return 5;
  if (normalizedBands.includes('lte800') || normalizedBands.includes('lte900') || normalizedBands.includes('gsm900')) return 8;
  return 4;
}

function showStationDetails(station) {
  el.emptyDetails.classList.add('hidden');
  el.detailCard.classList.remove('hidden');
  const origin = getOrigin();
  const distance = haversineKm(origin.lat, origin.lng, station.latitude, station.longitude);
  const bearing = azimuthDeg(origin.lat, origin.lng, station.latitude, station.longitude);
  el.detailTitle.textContent = `${station.operator} • ${station.station_id}`;
  el.detailSubtitle.textContent = station.city || station.address || 'Brak opisu lokalizacji';
  el.detailBody.innerHTML = [
    detailLine('Operator', station.operator),
    detailLine('ID stacji', station.station_id),
    detailLine('Miejscowość', station.city || '—'),
    detailLine('Adres', station.address || '—'),
    detailLine('Pasma', formatBands(station.bands)),
    detailLine('Azymuty', station.azimuths && station.azimuths.length ? `${station.azimuths.join('°, ')}°` : 'Brak danych o azymutach — kierunek niepewny'),
    detailLine('Rekordy', compactNumber(station.records_count)),
    detailLine('Odległość', formatDistance(distance)),
    detailLine('Kierunek', `${Math.round(bearing)}°`),
    detailLine('Współrzędne', `${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`),
    detailLine('Źródło', station.source || '—')
  ].join('');
}

function detailLine(label, value) {
  return `<div class="detail-line"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function hideDetails() {
  state.selected = null;
  state.sectorLayer.clearLayers();
  el.detailCard.classList.add('hidden');
  el.emptyDetails.classList.remove('hidden');
  scheduleRender();
}

function formatBands(bands) {
  return Array.isArray(bands) && bands.length ? bands.join(', ') : '—';
}

function renderList() {
  const origin = getOrigin();
  const total = state.currentVisibleTotal;
  el.listSubtitle.textContent = total
    ? `${compactNumber(total)} w widoku, lista pokazuje maks. ${MAX_LIST_ROWS}`
    : 'Brak stacji dla bieżących filtrów';

  if (!state.currentList.length) {
    el.stationList.innerHTML = '<div class="empty-state">Brak stacji w tym widoku. Oddal mapę albo zmień filtry.</div>';
    return;
  }

  el.stationList.innerHTML = state.currentList.map(station => {
    const distance = haversineKm(origin.lat, origin.lng, station.latitude, station.longitude);
    const color = operatorColor(station.operator);
    return `
      <button class="station-row" type="button" data-key="${escapeHtml(stationKey(station))}">
        <strong><span class="operator-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(station.operator)} • ${escapeHtml(station.station_id)}</strong>
        <p>${escapeHtml(station.city || station.address || 'Brak adresu')}</p>
        <div class="station-meta">
          <span class="badge">${escapeHtml(formatDistance(distance))}</span>
          <span class="badge">${escapeHtml(formatBands(station.bands))}</span>
          <span class="badge">rek. ${escapeHtml(compactNumber(station.records_count))}</span>
        </div>
      </button>
    `;
  }).join('');

  el.stationList.querySelectorAll('.station-row').forEach(button => {
    button.addEventListener('click', () => {
      const station = state.currentList.find(item => stationKey(item) === button.dataset.key);
      if (station) selectStation(station, true);
    });
  });
}

function stationKey(station) {
  return `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
}

function updateStats() {
  el.totalCount.textContent = compactNumber(state.stations.length);
  el.visibleCount.textContent = compactNumber(state.currentVisibleTotal);
  el.zoomValue.textContent = state.map ? state.map.getZoom() : '—';
}

function getOrigin() {
  if (state.measure) return { lat: state.measure.lat, lng: state.measure.lng };
  if (state.map) {
    const center = state.map.getCenter();
    return { lat: center.lat, lng: center.lng };
  }
  return { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
}

function updateMeasureMarker() {
  state.measureLayer.clearLayers();
  if (!state.measure) return;
  const icon = L.divIcon({ className: '', html: '<div class="measure-pin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  L.marker([state.measure.lat, state.measure.lng], { icon, interactive: false }).addTo(state.measureLayer);
  if (Number.isFinite(state.radiusKm) && state.radiusKm > 0) {
    L.circle([state.measure.lat, state.measure.lng], {
      radius: state.radiusKm * 1000,
      color: '#0ea5e9',
      weight: 1,
      fillColor: '#0ea5e9',
      fillOpacity: .07,
      interactive: false
    }).addTo(state.measureLayer);
  }
}

function toggleSetPointMode() {
  state.setPointMode = !state.setPointMode;
  el.setPointBtn.classList.toggle('active', state.setPointMode);
  el.setPointBtn.textContent = state.setPointMode ? 'Kliknij punkt na mapie' : 'Ustaw punkt pomiaru';
  setStatus(state.setPointMode ? 'Kliknij miejsce na mapie, aby ustawić punkt pomiarowy.' : 'Tryb ustawiania punktu wyłączony.');
}

function setMeasurePoint(latlng) {
  state.measure = { lat: latlng.lat, lng: latlng.lng };
  state.setPointMode = false;
  el.setPointBtn.classList.remove('active');
  el.setPointBtn.textContent = 'Ustaw punkt pomiaru';
  setStatus('Ustawiono punkt pomiarowy. Odległości liczone są od tego punktu.');
  scheduleRender();
}

function clearMeasurePoint() {
  state.measure = null;
  setStatus('Punkt pomiarowy wyczyszczony. Odległości liczone są od środka mapy.');
  scheduleRender();
}

function showNearest() {
  if (!state.stations.length) return;
  const origin = getOrigin();
  const nearest = state.stations
    .filter(matchesNonSpatialFilters)
    .map(station => ({ station, distance: haversineKm(origin.lat, origin.lng, station.latitude, station.longitude) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_LIST_ROWS)
    .map(item => item.station);
  state.currentList = nearest;
  state.currentVisibleTotal = nearest.length;
  renderList();
  updateStats();
  setTab('list');
  setStatus(`Pokazuję najbliższe stacje względem ${state.measure ? 'punktu pomiarowego' : 'środka mapy'}.`);
}

function matchesNonSpatialFilters(station) {
  if (state.operator !== 'Wszyscy' && station.operator !== state.operator) return false;
  if (state.band !== 'Wszystkie' && !(station.bands || []).includes(state.band)) return false;
  if (state.search.length >= SEARCH_MIN_CHARS && !station._search.includes(normalizeText(state.search))) return false;
  return true;
}


function fitMapToStations(stations) {
  if (!state.map || !Array.isArray(stations) || !stations.length || !window.L) return;
  try {
    const bounds = L.latLngBounds([]);
    for (const station of stations) bounds.extend([station.latitude, station.longitude]);
    if (bounds.isValid()) state.map.fitBounds(bounds.pad(0.08), { maxZoom: 12, animate: false });
  } catch (err) {
    console.warn(err);
  }
}

function matchesSearchQuery(station, query) {
  const normalized = normalizeText(query);
  if (normalized.length < SEARCH_MIN_CHARS) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.every(token => station._search.includes(token));
}

function scoreStationSearch(station, query) {
  const normalized = normalizeText(query);
  const city = normalizeText(station.city);
  const id = normalizeText(station.station_id);
  const address = normalizeText(station.address);
  let score = 0;
  if (city === normalized) score += 120;
  else if (city.startsWith(normalized)) score += 90;
  else if (city.includes(normalized)) score += 55;
  if (id === normalized) score += 115;
  else if (id.startsWith(normalized)) score += 85;
  else if (id.includes(normalized)) score += 60;
  if (address.includes(normalized)) score += 35;
  for (const token of normalized.split(/\s+/).filter(Boolean)) {
    if (city.includes(token)) score += 14;
    if (id.includes(token)) score += 13;
    if (address.includes(token)) score += 8;
  }
  return score;
}

function searchStations(query, limit = 400) {
  const normalized = normalizeText(query);
  if (normalized.length < SEARCH_MIN_CHARS) return [];
  const origin = getOrigin();
  return state.stations
    .filter(station => matchesSearchQuery(station, normalized))
    .map(station => ({
      station,
      score: scoreStationSearch(station, normalized),
      distance: haversineKm(origin.lat, origin.lng, station.latitude, station.longitude)
    }))
    .sort((a, b) => (b.score - a.score) || (a.distance - b.distance))
    .slice(0, limit)
    .map(item => item.station);
}

function runSearch(options = {}) {
  const center = options.center !== false;
  const showPanel = options.showPanel !== false;
  state.search = normalizeText(el.searchInput.value);

  if (state.search.length < SEARCH_MIN_CHARS) {
    setStatus('Wpisz co najmniej 2 znaki do wyszukania.');
    scheduleRender();
    return;
  }

  if (!state.stations.length) {
    setStatus('Najpierw wczytaj albo zaimportuj bazę stacji.');
    return;
  }

  const results = searchStations(state.search, 900);
  if (!results.length) {
    state.currentList = [];
    state.currentVisibleTotal = 0;
    renderMarkers([]);
    renderList();
    updateStats();
    setStatus(`Brak wyników dla: ${el.searchInput.value.trim()}`);
    if (showPanel) {
      setTab('list');
      setPanelMode('half');
    }
    return;
  }

  state.currentList = results.slice(0, MAX_LIST_ROWS);
  state.currentVisibleTotal = results.length;
  renderMarkers(results);
  renderList();
  updateMeasureMarker();
  updateStats();

  if (center && state.map) {
    const best = results[0];
    state.map.setView([best.latitude, best.longitude], Math.max(state.map.getZoom(), 13), { animate: true });
  }

  if (showPanel) {
    setTab('list');
    setPanelMode('half');
  }
  setStatus(`Wyniki: ${compactNumber(results.length)} dla „${el.searchInput.value.trim()}”.`);
}

function setPanelMode(mode = 'half', save = true) {
  if (!el.appPanel) return;
  if (!['collapsed', 'half', 'full'].includes(mode)) mode = 'half';
  state.panelMode = mode;
  el.appPanel.classList.toggle('collapsed', mode === 'collapsed');
  el.appPanel.classList.toggle('full', mode === 'full');
  if (mode !== 'custom') el.appPanel.style.removeProperty('--panel-height');
  if (el.collapsePanelBtn) {
    el.collapsePanelBtn.textContent = mode === 'collapsed' ? '▴' : '▾';
    el.collapsePanelBtn.setAttribute('aria-label', mode === 'collapsed' ? 'Rozwiń panel' : 'Zwiń panel');
  }
  if (state.map) setTimeout(() => state.map.invalidateSize(), 210);
  if (save) saveSettings();
}

function togglePanelCollapsed() {
  setPanelMode(state.panelMode === 'collapsed' ? 'half' : 'collapsed');
}

function bindPanelDrag() {
  if (!el.panelHandle) return;
  let drag = null;

  el.panelHandle.addEventListener('pointerdown', event => {
    if (!isMobileLayout()) return;
    const rect = el.appPanel.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: rect.height,
      moved: false
    };
    el.panelHandle.setPointerCapture(event.pointerId);
    el.appPanel.classList.add('dragging');
    event.preventDefault();
  });

  el.panelHandle.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const dy = drag.startY - event.clientY;
    const height = clamp(drag.startHeight + dy, 88, Math.round(viewportHeight * 0.82));
    if (Math.abs(dy) > 6) drag.moved = true;
    el.appPanel.classList.remove('collapsed', 'full');
    el.appPanel.style.setProperty('--panel-height', `${height}px`);
    state.panelMode = 'half';
  });

  const finish = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const rect = el.appPanel.getBoundingClientRect();
    el.appPanel.classList.remove('dragging');
    el.appPanel.style.removeProperty('--panel-height');
    try { el.panelHandle.releasePointerCapture(event.pointerId); } catch (_) {}

    if (!drag.moved) {
      setPanelMode(state.panelMode === 'collapsed' ? 'half' : 'collapsed');
    } else if (rect.height < 150) {
      setPanelMode('collapsed');
    } else if (rect.height > viewportHeight * 0.64) {
      setPanelMode('full');
    } else {
      setPanelMode('half');
    }
    drag = null;
  };

  el.panelHandle.addEventListener('pointerup', finish);
  el.panelHandle.addEventListener('pointercancel', finish);
}

function locateUser() {
  if (!navigator.geolocation) {
    setStatus('Ta przeglądarka nie obsługuje GPS.');
    return;
  }
  setStatus('Pobieram pozycję GPS…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      state.map.setView(latlng, Math.max(state.map.getZoom(), 13), { animate: true });
      state.measure = { lat: latlng[0], lng: latlng[1] };
      if (state.userMarker) state.userMarker.remove();
      state.userMarker = L.circle(latlng, {
        radius: Math.max(25, pos.coords.accuracy || 25),
        color: '#0ea5e9',
        weight: 1,
        fillColor: '#0ea5e9',
        fillOpacity: .09
      }).addTo(state.map);
      setStatus(`Pozycja GPS ustawiona • dokładność ok. ${Math.round(pos.coords.accuracy)} m`);
      scheduleRender();
    },
    err => setStatus(`GPS niedostępny: ${err.message}`),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
  );
}

async function loadStationsFromUrl(url = 'stations.json', options = {}) {
  const result = await workerRequest({ type: 'loadUrl', url, forceNetwork: !!options.forceNetwork });
  setStations(result.stations, result.sourceName || url, { save: !!options.save, fit: !!options.fit });
}

async function importDataFile() {
  const file = el.dataFileInput.files && el.dataFileInput.files[0];
  if (!file) return;
  try {
    setStatus(`Wczytuję ${file.name}…`);
    const name = file.name.toLowerCase();
    let result;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      if (!window.XLSX) throw new Error(XLSX_CDN_NOTE);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('Plik XLSX nie ma arkuszy.');
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });
      result = await workerRequest({ type: 'parseRows', rows, name: file.name });
    } else {
      result = await workerRequest({ type: 'parseText', text: await file.text(), name: file.name, contentType: file.type });
    }
    setStations(result.stations, result.sourceName || file.name, { save: true, fit: true });
    setStatus(`Zaimportowano ${compactNumber(result.stations.length)} stacji z ${file.name}. Baza jest aktywna od razu.`);
  } catch (err) {
    setStatus(`Błąd importu pliku: ${err.message}`);
  } finally {
    el.dataFileInput.value = '';
  }
}

async function loadRemoteInput() {
  try {
    const url = el.remoteUrlInput.value.trim();
    await loadStationsFromUrl(url, { forceNetwork: true, save: true, fit: true });
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

function setTab(tabName) {
  if (!el.tabPanels[tabName]) return;
  state.activeTab = tabName;
  el.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
  Object.entries(el.tabPanels).forEach(([name, panel]) => panel.classList.toggle('active', name === tabName));
  const titles = { filters: 'Filtry', list: 'Lista stacji', details: 'Szczegóły', settings: 'Ustawienia' };
  el.panelTitle.textContent = titles[tabName] || 'Panel';
  saveSettings();
}

function bindEvents() {
  el.searchForm.addEventListener('submit', event => {
    event.preventDefault();
    runSearch({ center: true, showPanel: true });
    el.searchInput.blur();
  });
  el.searchInput.addEventListener('input', () => {
    state.search = normalizeText(el.searchInput.value);
    clearTimeout(state.searchTimer);
    if (state.search.length < SEARCH_MIN_CHARS) {
      scheduleRender();
      return;
    }
    state.searchTimer = setTimeout(() => runSearch({ center: false, showPanel: false }), 280);
  });
  el.searchInput.addEventListener('focus', () => {
    if (isMobileLayout()) setPanelMode('collapsed', false);
  });
  el.clearSearchBtn.addEventListener('click', () => {
    clearTimeout(state.searchTimer);
    el.searchInput.value = '';
    state.search = '';
    setStatus(state.stations.length ? `Wczytano ${compactNumber(state.stations.length)} stacji.` : 'Wyszukiwanie wyczyszczone.');
    scheduleRender();
  });
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
  el.clearPointBtn.addEventListener('click', clearMeasurePoint);
  el.setPointBtn.addEventListener('click', toggleSetPointMode);
  el.mapPlanBtn.addEventListener('click', () => setMapType('plan'));
  el.mapSatBtn.addEventListener('click', () => setMapType('sat'));
  el.nearestBtn.addEventListener('click', showNearest);
  el.installBtn.addEventListener('click', installPwa);
  el.menuBtn.addEventListener('click', () => { setTab('settings'); setPanelMode(isMobileLayout() ? 'full' : 'half'); });
  el.collapsePanelBtn.addEventListener('click', () => togglePanelCollapsed());
  bindPanelDrag();
  el.tabs.forEach(tab => tab.addEventListener('click', () => {
    setTab(tab.dataset.tab);
    setPanelMode(state.panelMode === 'collapsed' ? 'half' : state.panelMode);
  }));
  window.addEventListener('resize', () => {
    if (state.map) state.map.invalidateSize();
    scheduleRender();
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredInstallPrompt = event;
    el.installBtn.classList.remove('hidden');
  });
}

function showLoadError(err) {
  console.error(err);
  setStatus(`Nie udało się wczytać bazy: ${err.message}. Uruchom przez serwer lokalny albo zaimportuj JSON/CSV/XLSX.`);
  el.stationList.innerHTML = '<div class="empty-state">Nie udało się wczytać bazy. Kliknij „Import JSON / CSV / XLSX” albo uruchom przez serwer HTTP.</div>';
  setStorageStatus('Pamięć lokalna: brak działającej bazy.');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(2).replace('.', ',')} km`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function azimuthDeg(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const toDeg = rad => rad * 180 / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function destinationPoint(lat, lon, bearingDeg, distanceKm) {
  const R = 6371;
  const brng = bearingDeg * Math.PI / 180;
  const phi1 = lat * Math.PI / 180;
  const lambda1 = lon * Math.PI / 180;
  const delta = distanceKm / R;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(brng));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(brng) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
  );
  return { lat: phi2 * 180 / Math.PI, lng: ((lambda2 * 180 / Math.PI + 540) % 360) - 180 };
}

async function boot() {
  initElements();
  loadSettings();
  applyTheme();
  bindEvents();
  setTab(state.activeTab || 'filters');
  setPanelMode(state.panelMode || 'half', false);
  el.radiusSelect.value = state.radiusKm ?? '';
  registerServiceWorker();
  initMap();
  setStorageStatus('Pamięć lokalna: sprawdzanie…');
  const saved = await loadActiveDataset();
  if (saved) {
    const date = saved.savedAt ? new Date(saved.savedAt).toLocaleString('pl-PL') : 'brak daty';
    setStations(saved.stations, `${saved.sourceName || 'zapisana baza'} • zapis ${date}`, { save: false });
    setStorageStatus(`Pamięć lokalna: użyto zapisanej bazy z ${date}.`);
    return;
  }
  setStorageStatus('Pamięć lokalna: brak zapisanej bazy, wczytuję stations.json…');
  loadStationsFromUrl('stations.json', { forceNetwork: false, save: true }).catch(showLoadError);
}

document.addEventListener('DOMContentLoaded', boot);
