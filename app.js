'use strict';

const APP_VERSION = '3.18 - 1305260910';
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
const XLSX_CDN_NOTE = 'Import XLSX wymaga załadowanej biblioteki SheetJS 0.20.3.';
const PDF_CDN_NOTE = 'Import PDF wymaga załadowanej biblioteki PDF.js 5.4.149.';
const ZIP_CDN_NOTE = 'Import ZIP wymaga biblioteki JSZip z CDN albo połączenia z internetem.';
const PDFJS_MODULE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs';
const UKE_BIP_PAGE = 'https://bip.uke.gov.pl/pozwolenia-radiowe/wykaz-pozwolen-radiowych-tresci/stacje-gsm-umts-lte-5gnr-oraz-cdma%2C12%2C0.html';
const SI2PEM_MAP_URL = 'https://si2pem.gov.pl/map/';
const SI2PEM_API_DOCS_URL = 'https://si2pem.gov.pl/api-docs/';
const GOV_SI2PEM_HELP_URL = 'https://www.gov.pl/web/si2pem/jak-korzystac-z-systemu-si2pem';
const UKE_DATA_GOV_RESOURCES = 'https://api.dane.gov.pl/1.4/datasets/1075/resources?lang=pl&per_page=100';
const UKE_DATA_GOV_METADATA = 'https://api.dane.gov.pl/1.4/datasets/1075/resources/metadata.csv?lang=pl';
const UKE_LINK_LIMIT = 24;
const UKE_ONLINE_IMPORT_ENABLED = false;
const UKE_ONLINE_DISABLED_MESSAGE = 'Automatyczne pobieranie UKE online z frontendu jest wyłączone. Użyj importu ZIP/XLSX/CSV albo własnego backendu.';
const SI2PEM_BACKEND_ENDPOINT = '/api/si2pem/enrich';
const SI2PEM_BACKEND_BATCH_LIMIT = 80;
const COMPASS_UI_INTERVAL_MS = 140;
const COMPASS_MIN_DELTA_DEG = 2.4;
const COMPASS_SMOOTHING = 0.22;
const COMPASS_ABSOLUTE_LOCK_MS = 1500;
const COVERAGE_GRADIENT_RINGS = [
  { scale: 1, opacity: 0.07, weight: 1, label: 'słaby' },
  { scale: 0.66, opacity: 0.13, weight: 1.5, label: 'średni' },
  { scale: 0.33, opacity: 0.24, weight: 2, label: 'mocny' }
];
const DEFAULT_SECTOR_WIDTH_DEG = 70;

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
  measureSource: null,
  userLocation: null,
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
  userMarker: null,
  userAccuracyCircle: null,
  userWatchId: null,
  gpsTracking: false,
  compassActive: false,
  compassHeading: null,
  compassSmoothedHeading: null,
  compassAbsolute: false,
  lastCompassUiUpdate: 0,
  lastAbsoluteCompassAt: 0,
  longPressTimer: null,
  stationPopup: null,
  selectedPopupOpen: false,
  suppressPopupClose: false,
  statusHideTimer: null,
  ukeUpdateRunning: false,
  si2pemBackendUrl: '',
  si2pemBackendRunning: false
};

const el = {};

function initElements() {
  Object.assign(el, {
    body: document.body,
    statusText: document.getElementById('statusText'),
    statusToast: document.getElementById('statusToast'),
    statusToastTitle: document.getElementById('statusToastTitle'),
    statusToastMessage: document.getElementById('statusToastMessage'),
    statusToastClose: document.getElementById('statusToastClose'),
    statusProgress: document.getElementById('statusProgress'),
    statusProgressFill: document.getElementById('statusProgressFill'),
    ukeStatusBox: document.getElementById('ukeStatusBox'),
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
    compassWidget: document.getElementById('compassWidget'),
    compassPhoneArrow: document.getElementById('compassPhoneArrow'),
    compassTargetArrow: document.getElementById('compassTargetArrow'),
    compassHeadingLabel: document.getElementById('compassHeadingLabel'),
    compassTargetLabel: document.getElementById('compassTargetLabel'),
    refreshBtn: document.getElementById('refreshBtn'),
    ukeUpdateBtn: document.getElementById('ukeUpdateBtn'),
    openUkePageBtn: document.getElementById('openUkePageBtn'),
    openSi2pemBtn: document.getElementById('openSi2pemBtn'),
    si2pemBackendUrlInput: document.getElementById('si2pemBackendUrlInput'),
    saveSi2pemBackendBtn: document.getElementById('saveSi2pemBackendBtn'),
    autoEnrichSelectedBtn: document.getElementById('autoEnrichSelectedBtn'),
    autoEnrichVisibleBtn: document.getElementById('autoEnrichVisibleBtn'),
    openTechSourcesBtn: document.getElementById('openTechSourcesBtn'),
    downloadParamTemplateBtn: document.getElementById('downloadParamTemplateBtn'),
    importFileBtn: document.getElementById('importFileBtn'),
    importParamFileBtn: document.getElementById('importParamFileBtn'),
    dataFileInput: document.getElementById('dataFileInput'),
    paramFileInput: document.getElementById('paramFileInput'),
    remoteUrlInput: document.getElementById('remoteUrlInput'),
    loadUrlBtn: document.getElementById('loadUrlBtn'),
    loadParamUrlBtn: document.getElementById('loadParamUrlBtn'),
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
    if (parsed.si2pemBackendUrl) state.si2pemBackendUrl = String(parsed.si2pemBackendUrl).trim();
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
    panelMode: state.panelMode,
    si2pemBackendUrl: state.si2pemBackendUrl
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
}

function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
}

function setStatus(text) {
  if (el.statusText) el.statusText.textContent = text;
}

function setStorageStatus(text) {
  if (el.storageStatus) el.storageStatus.textContent = text;
}

function updateSearchControls() {
  if (!el.searchForm || !el.searchInput) return;
  el.searchForm.classList.toggle('has-query', el.searchInput.value.trim().length > 0);
}

function showStatusToast(title, message, type = 'info', options = {}) {
  if (!el.statusToast) return;
  clearTimeout(state.statusHideTimer);
  el.statusToast.classList.remove('hidden', 'info', 'success', 'error', 'busy');
  el.statusToast.classList.add(type);
  if (el.statusToastTitle) el.statusToastTitle.textContent = title || 'Status';
  if (el.statusToastMessage) el.statusToastMessage.textContent = message || '';

  const hasProgress = Number.isFinite(options.progress);
  if (el.statusProgress) el.statusProgress.classList.toggle('hidden', !hasProgress);
  if (el.statusProgressFill && hasProgress) {
    el.statusProgressFill.style.width = `${clamp(options.progress, 0, 100)}%`;
  }

  if (!options.sticky) {
    state.statusHideTimer = setTimeout(() => hideStatusToast(), options.timeout || 5200);
  }
}

function hideStatusToast() {
  clearTimeout(state.statusHideTimer);
  if (el.statusToast) el.statusToast.classList.add('hidden');
}

function setUkeStatus(message, progress = null, type = 'busy', sticky = true) {
  setStatus(message);
  if (el.ukeStatusBox) {
    el.ukeStatusBox.textContent = message;
    el.ukeStatusBox.classList.remove('info', 'success', 'error', 'busy');
    el.ukeStatusBox.classList.add(type);
  }
  showStatusToast('Aktualizacja UKE', message, type, { progress, sticky });
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function formatOptionalNumber(value, unit = '') {
  const number = numberOrNull(value);
  if (!Number.isFinite(number)) return '—';
  const text = Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return unit ? `${text.replace('.', ',')} ${unit}` : text.replace('.', ',');
}

function operatorColor(operator) {
  return OPERATOR_COLORS[operator] || '#3478f6';
}

function normalizePowerValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return { value, unit: 'W' };
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(',', '.').toLowerCase();
  const match = normalized.match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  if (normalized.includes('dbm')) return { value: number, unit: 'dBm' };
  if (normalized.includes('dbw')) return { value: number, unit: 'dBW' };
  if (normalized.includes('kw')) return { value: number, unit: 'kW' };
  if (normalized.includes('w')) return { value: number, unit: 'W' };
  return { value: number, unit: '' };
}

function getBestPowerInfo(station) {
  const candidates = [station.power, station.power_w, station.eirp, station.eirp_dbm, station.erp, station.max_eirp_dbm, station.supplement_power, station.supplement_eirp, station.supplement_eirp_dbm];
  for (const candidate of candidates) {
    const parsed = normalizePowerValue(candidate);
    if (!parsed) continue;
    const watts = powerInfoToWatts(parsed);
    return { ...parsed, watts };
  }
  return null;
}

function powerInfoToWatts(info) {
  if (!info || !Number.isFinite(info.value)) return null;
  const unit = String(info.unit || '').toLowerCase();
  if (unit === 'kw') return info.value * 1000;
  if (unit === 'w') return info.value;
  if (unit === 'dbm') return 10 ** ((info.value - 30) / 10);
  if (unit === 'dbw') return 10 ** (info.value / 10);
  return null;
}

function formatPowerInfo(info) {
  if (!info) return 'Brak danych o mocy w bazie';
  const value = Number.isInteger(info.value) ? String(info.value) : info.value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return info.unit ? `${value} ${info.unit}` : value;
}

function formatPower(station) {
  return formatPowerInfo(getBestPowerInfo(station));
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
  try {
    state.worker = new Worker('data-worker.js');
    return state.worker;
  } catch (err) {
    console.warn('Worker niedostępny, używam parsera awaryjnego:', err);
    state.worker = null;
    return null;
  }
}

function workerRequest(payload) {
  return new Promise((resolve, reject) => {
    const worker = ensureWorker();
    if (!worker) {
      fallbackWorkerRequest(payload).then(resolve, reject);
      return;
    }
    const id = ++state.workerSeq;
    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.removeEventListener('messageerror', onError);
    };
    const onError = (event) => {
      cleanup();
      console.warn('Worker przerwany, używam parsera awaryjnego:', event);
      fallbackWorkerRequest(payload).then(resolve, reject);
    };
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
    worker.addEventListener('error', onError);
    worker.addEventListener('messageerror', onError);
    try {
      worker.postMessage({ ...payload, id });
    } catch (err) {
      cleanup();
      fallbackWorkerRequest(payload).then(resolve, reject);
    }
  });
}

async function fallbackWorkerRequest(payload) {
  const id = payload.id || ++state.workerSeq;
  if (payload.type === 'loadUrl') {
    setStatus('Pobieram bazę…');
    const url = normalizeRemoteUrlMain(payload.url || 'stations.json');
    const response = await fetch(url, { cache: payload.forceNetwork ? 'reload' : 'default' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    const kind = detectRemoteTypeMain(url, contentType);
    const text = await response.text();
    setStatus('Przetwarzam bazę…');
    const stations = parseTextPayloadMain(text, kind);
    return { id, type: 'result', stations, sourceName: sourceNameFromUrlSafe(url) };
  }
  if (payload.type === 'parseText') {
    setStatus('Przetwarzam plik…');
    const stations = parseTextPayloadMain(String(payload.text || ''), payload.kind || detectRemoteTypeMain(payload.name || '', payload.contentType || ''));
    return { id, type: 'result', stations, sourceName: payload.name || 'import' };
  }
  if (payload.type === 'parseRows') {
    setStatus('Przetwarzam arkusz…');
    const stations = parseImportedRowsMain(Array.isArray(payload.rows) ? payload.rows : []);
    return { id, type: 'result', stations, sourceName: payload.name || 'import' };
  }
  throw new Error('Nieznane polecenie parsera.');
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
    if (state.setPointMode) setMeasurePoint(event.latlng, 'manual');
  });

  state.map.on('contextmenu', event => {
    setMeasurePoint(event.latlng, 'manual');
  });

  bindMapLongPress();
  updateNavigationIndicator();
}

function bindMapLongPress() {
  if (!state.map || !window.L) return;
  const container = state.map.getContainer();
  let press = null;

  const clearPress = () => {
    if (state.longPressTimer) clearTimeout(state.longPressTimer);
    state.longPressTimer = null;
    press = null;
  };

  container.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (event.target.closest('.leaflet-control, .leaflet-marker-icon, .leaflet-popup, button, input, select')) return;
    const rect = container.getBoundingClientRect();
    const latlng = state.map.containerPointToLatLng(L.point(event.clientX - rect.left, event.clientY - rect.top));
    press = { x: event.clientX, y: event.clientY, latlng };
    state.longPressTimer = setTimeout(() => {
      if (!press) return;
      setMeasurePoint(press.latlng, 'manual');
      setStatus('Punkt pomiarowy ustawiony długim przytrzymaniem mapy.');
      press = null;
    }, 650);
  }, { passive: true });

  container.addEventListener('pointermove', event => {
    if (!press) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (Math.hypot(dx, dy) > 12) clearPress();
  }, { passive: true });

  container.addEventListener('pointerup', clearPress, { passive: true });
  container.addEventListener('pointercancel', clearPress, { passive: true });
  container.addEventListener('pointerleave', clearPress, { passive: true });
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
  const extractedBands = extractBandsFromText([station.bands, station.address, station.city, station.station_id, station.source].join(' '));
  station.bands = cleanBands(mergeUnique(Array.isArray(station.bands) && station.bands.length ? station.bands.map(String) : [], extractedBands));
  if (!station.bands.length) station.bands = ['Nieznane'];
  station.azimuths = Array.isArray(station.azimuths) ? station.azimuths.map(Number).filter(Number.isFinite) : [];
  station.sector_ids = Array.isArray(station.sector_ids) ? station.sector_ids : [];
  station.cell_names = Array.isArray(station.cell_names) ? station.cell_names : [];
  station.records_count = Number(station.records_count || 1) || 1;
  station.range_km = Number(station.range_km || station.range || 0) || null;
  station.power = station.power ?? station.power_w ?? station.moc ?? station.eirp ?? station.eirp_dbm ?? station.erp ?? station.max_eirp_dbm ?? '';
  station.supplement_power = station.supplement_power ?? '';
  station.supplement_eirp = station.supplement_eirp ?? '';
  station.supplement_eirp_dbm = station.supplement_eirp_dbm ?? '';
  station.antenna_height_m = numberOrNull(station.antenna_height_m ?? station.height_m ?? station.wysokosc_anteny_m ?? station.wysokosc);
  station.tilt_deg = numberOrNull(station.tilt_deg ?? station.antenna_tilt_deg ?? station.pochylenie_anteny_deg ?? station.pochylenie);
  station.param_sources = Array.isArray(station.param_sources) ? station.param_sources.map(String).filter(Boolean) : [];
  station.shared_operators = Array.isArray(station.shared_operators) ? station.shared_operators.map(String).filter(Boolean) : [];
  station.shared_site = !!station.shared_site;
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
  const byKey = new Map();
  for (const raw of stations || []) {
    const station = normalizeStationForMain(raw);
    if (!station) continue;
    const key = `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
    const existing = byKey.get(key);
    if (existing) mergeStationInto(existing, station);
    else byKey.set(key, station);
  }

  const normalized = Array.from(byKey.values());
  annotateSharedOperatorInfo(normalized);

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
  if (state.search.length >= SEARCH_MIN_CHARS) void runSearch({ center: false, showPanel: false });
  else scheduleRender();
}

function mergeStationInto(target, source) {
  target.bands = cleanBands(mergeUnique(target.bands, source.bands));
  target.azimuths = mergeUnique(target.azimuths, source.azimuths).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  target.sector_ids = mergeUnique(target.sector_ids, source.sector_ids);
  target.cell_names = mergeUnique(target.cell_names, source.cell_names);
  target.records_count = (Number(target.records_count) || 1) + (Number(source.records_count) || 1);
  if (!target.city && source.city) target.city = source.city;
  if (!target.address && source.address) target.address = source.address;
  if (!target.power && source.power) target.power = source.power;
  if (!target.power_w && source.power_w) target.power_w = source.power_w;
  if (!target.eirp && source.eirp) target.eirp = source.eirp;
  if (!target.eirp_dbm && source.eirp_dbm) target.eirp_dbm = source.eirp_dbm;
  if (!target.erp && source.erp) target.erp = source.erp;
  if (!target.max_eirp_dbm && source.max_eirp_dbm) target.max_eirp_dbm = source.max_eirp_dbm;
  if (!target.supplement_power && source.supplement_power) target.supplement_power = source.supplement_power;
  if (!target.supplement_eirp && source.supplement_eirp) target.supplement_eirp = source.supplement_eirp;
  if (!target.supplement_eirp_dbm && source.supplement_eirp_dbm) target.supplement_eirp_dbm = source.supplement_eirp_dbm;
  if (!Number.isFinite(target.antenna_height_m) && Number.isFinite(source.antenna_height_m)) target.antenna_height_m = source.antenna_height_m;
  if (!Number.isFinite(target.tilt_deg) && Number.isFinite(source.tilt_deg)) target.tilt_deg = source.tilt_deg;
  target.param_sources = mergeUnique(target.param_sources, source.param_sources);
  if (!target.range_km && source.range_km) target.range_km = source.range_km;
  target.source = mergeSourceNames(target.source, source.source);
  target._search = normalizeText([
    target.station_id,
    target.operator,
    target.city,
    target.address,
    target.bands.join(' '),
    target.source
  ].join(' • '));
}

function mergeUnique(a, b) {
  const out = [];
  const seen = new Set();
  for (const value of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    const key = normalizeText(text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

// UWAGA: te same reguły czyszczenia pasm są zdublowane w data-worker.js. Każdą zmianę parsera trzeba wykonać w obu plikach.
const VALID_NR_BANDS = new Set([
  'NR1', 'NR3', 'NR7', 'NR8', 'NR20', 'NR28', 'NR38', 'NR40', 'NR41', 'NR77', 'NR78'
]);

function cleanBands(bands) {
  if (!Array.isArray(bands)) return [];

  return [...new Set(
    bands
      .map(b => String(b).trim().toUpperCase().replace(/\s+/g, ''))
      .filter(Boolean)
      .filter(b => {
        if (b.startsWith('NR')) return VALID_NR_BANDS.has(b);
        return true;
      })
  )];
}

function mergeSourceNames(a, b) {
  return mergeUnique(String(a || '').split(/\s*\|\s*/), String(b || '').split(/\s*\|\s*/)).slice(0, 6).join(' | ');
}

function annotateSharedOperatorInfo(stations) {
  const groups = new Map();
  for (const station of stations) {
    const key = `${station.latitude.toFixed(5)}|${station.longitude.toFixed(5)}`;
    if (!groups.has(key)) groups.set(key, new Set());
    for (const op of splitOperators(station.operator)) groups.get(key).add(op);
  }

  for (const station of stations) {
    const key = `${station.latitude.toFixed(5)}|${station.longitude.toFixed(5)}`;
    const own = new Set(splitOperators(station.operator).map(normalizeText));
    const others = Array.from(groups.get(key) || [])
      .filter(op => !own.has(normalizeText(op)))
      .sort((a, b) => a.localeCompare(b, 'pl'));
    const explicit = splitOperators(station.shared_operators || []);
    station.shared_operators = mergeUnique(others, explicit);
    station.shared_site = station.shared_site || station.shared_operators.length > 0 || splitOperators(station.operator).length > 1;
  }
}

function splitOperators(value) {
  const raw = Array.isArray(value) ? value.join('/') : String(value || '');
  return raw.split(/\s*(?:\/|,|;|\+|&| i )\s*/i).map(v => v.trim()).filter(Boolean);
}

function formatSharedOperators(station) {
  const operatorParts = splitOperators(station.operator);
  if (operatorParts.length > 1) return `Tak: ${operatorParts.join(', ')}`;
  if (station.shared_operators && station.shared_operators.length) return `Tak: ${station.shared_operators.join(', ')}`;
  return 'Nie wykryto współdzielenia tej samej lokalizacji w bazie';
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
  const order = ['GSM900', 'UMTS900', 'LTE800', 'LTE900', 'LTE1800', 'LTE2100', 'LTE2600', 'NR1', 'NR3', 'NR7', 'NR8', 'NR20', 'NR28', 'NR38', 'NR40', 'NR41', 'NR77', 'NR78', '5G'];
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
  if (state.selected) {
    renderSelectedStationExtras(state.selected);
    if (state.selectedPopupOpen) refreshStationPopupContent(state.selected);
  }
  renderList();
  updateMeasureMarker();
  updateNavigationIndicator();
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
  if (state.search.length >= SEARCH_MIN_CHARS && !matchesSearchQuery(station, state.search) && !matchesRelaxedSearchQuery(station, state.search)) return false;
  if (Number.isFinite(state.radiusKm) && state.radiusKm > 0) {
    const origin = getOrigin();
    if (haversineKm(origin.lat, origin.lng, station.latitude, station.longitude) > state.radiusKm) return false;
  }
  return true;
}

function renderMarkers(stations) {
  state.markerLayer.clearLayers();
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
  marker.on('click', event => {
    if (event?.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
    selectStation(station, false, true);
  });
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
  const origin = getOrigin();
  const distance = haversineKm(origin.lat, origin.lng, station.latitude, station.longitude);
  const bearing = azimuthDeg(origin.lat, origin.lng, station.latitude, station.longitude);
  const rangeKm = estimateStationRangeKm(station);
  const azimuthText = station.azimuths && station.azimuths.length ? `${station.azimuths.join('°, ')}°` : 'brak — zasięg orientacyjny';
  const bands = (station.bands || []).slice(0, 8).map(band => `<span>${escapeHtml(band)}</span>`).join('');
  const extraBands = station.bands && station.bands.length > 8 ? `<span>+${station.bands.length - 8}</span>` : '';
  return `
    <div class="bts-popup-card">
      <div class="bts-popup-head">
        <div>
          <strong>${escapeHtml(station.city || station.address || 'Stacja BTS')}</strong>
          <small>${escapeHtml(station.address || station.city || 'Brak adresu')}</small>
        </div>
        <b>${escapeHtml(station.operator)}</b>
      </div>
      <div class="bts-popup-distance">
        <span>Odległość</span>
        <strong>${escapeHtml(formatDistance(distance))}</strong>
        <em>${Math.round(bearing)}°</em>
      </div>
      <div class="bts-popup-bands">${bands}${extraBands}</div>
      <div class="bts-popup-grid">
        <div><span>ID</span><b>${escapeHtml(station.station_id)}</b></div>
        <div><span>Zasięg</span><b>~${escapeHtml(formatRangeShort(rangeKm))}</b></div>
        <div><span>Azymut</span><b>${escapeHtml(azimuthText)}</b></div>
        <div><span>Moc</span><b>${escapeHtml(formatPower(station))}</b></div>
      </div>
      <div class="bts-popup-share"><span>Współdzielenie</span><b>${escapeHtml(formatSharedOperators(station))}</b></div>
      <div class="bts-popup-note">Mapa pokazuje gradient orientacyjny: najmocniej blisko BTS, słabiej przy granicy zasięgu. Źródło: ${escapeHtml(coverageReliability(station))}.</div>
      <div class="bts-popup-actions"><button type="button" data-action="enrich-selected-si2pem">SI2PEM</button><button type="button" data-action="import-selected-pdf">Plik parametrów</button></div>
    </div>
  `;
}

function openStationPopup(station) {
  if (!state.map || !window.L || !station) return;

  if (!state.stationPopup) {
    state.stationPopup = L.popup({
      className: 'bts-leaflet-popup',
      closeButton: false,
      autoPan: true,
      autoClose: true,
      closeOnClick: true,
      keepInView: true,
      maxWidth: 280,
      minWidth: 230
    });
    state.stationPopup.on('remove', () => {
      if (!state.suppressPopupClose) state.selectedPopupOpen = false;
    });
  }

  state.selectedPopupOpen = true;
  state.suppressPopupClose = true;
  state.stationPopup
    .setLatLng([station.latitude, station.longitude])
    .setContent(popupHtml(station))
    .openOn(state.map);
  state.suppressPopupClose = false;
}

function refreshStationPopupContent(station) {
  if (!station || !state.selectedPopupOpen) return;
  if (state.stationPopup && state.map && state.map.hasLayer(state.stationPopup)) {
    state.stationPopup
      .setLatLng([station.latitude, station.longitude])
      .setContent(popupHtml(station));
    return;
  }
  openStationPopup(station);
}

function selectStation(station, centerOnMap = true, openPopup = true) {
  state.selected = station;
  if (centerOnMap && state.map) state.map.setView([station.latitude, station.longitude], Math.max(state.map.getZoom(), 14), { animate: true });
  showStationDetails(station);
  renderSelectedStationExtras(station);
  updateNavigationIndicator();
  if (openPopup) openStationPopup(station);
}

function renderSelectedStationExtras(station) {
  state.sectorLayer.clearLayers();
  if (!station || !window.L) return;

  const color = operatorColor(station.operator);
  const rangeKm = estimateStationRangeKm(station);
  const azimuths = Array.isArray(station.azimuths) ? station.azimuths.filter(Number.isFinite) : [];

  renderCoverageGradient(station, color, rangeKm, azimuths);

  L.circleMarker([station.latitude, station.longitude], {
    radius: 13,
    color,
    weight: 3,
    fillColor: '#ffffff',
    fillOpacity: .36,
    interactive: false
  }).addTo(state.sectorLayer);

  addCoverageLabel(station, color, rangeKm, azimuths);
}

function renderCoverageGradient(station, color, rangeKm, azimuths) {
  const hasAzimuth = Array.isArray(azimuths) && azimuths.length > 0;
  const rings = COVERAGE_GRADIENT_RINGS;
  const center = [station.latitude, station.longitude];

  for (const ring of rings) {
    const radiusKm = Math.max(rangeKm * ring.scale, 0.05);
    if (hasAzimuth) {
      for (const azimuth of azimuths) {
        L.polygon(sectorPolygon(station.latitude, station.longitude, azimuth, radiusKm, DEFAULT_SECTOR_WIDTH_DEG), {
          color,
          weight: ring.weight,
          opacity: ring.scale === 1 ? .92 : .28,
          fillColor: color,
          fillOpacity: ring.opacity,
          interactive: false
        }).addTo(state.sectorLayer);
      }
    } else {
      L.circle(center, {
        radius: radiusKm * 1000,
        color,
        weight: ring.weight,
        opacity: ring.scale === 1 ? .84 : .28,
        dashArray: ring.scale === 1 ? '8 7' : null,
        fillColor: color,
        fillOpacity: ring.opacity,
        interactive: false
      }).addTo(state.sectorLayer);
    }
  }
}

function addCoverageLabel(station, color, rangeKm, azimuths) {
  const hasAzimuth = Array.isArray(azimuths) && azimuths.length > 0;
  if (hasAzimuth) {
    for (const azimuth of azimuths) {
      const labelPoint = destinationPoint(station.latitude, station.longitude, azimuth, Math.max(rangeKm * .7, .28));
      L.marker([labelPoint.lat, labelPoint.lng], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          html: `<div class="sector-label"><b>${Math.round(azimuth)}°</b><span>~${formatRangeShort(rangeKm)}</span></div>`,
          iconSize: [92, 28],
          iconAnchor: [46, 14]
        })
      }).addTo(state.sectorLayer);
    }
    return;
  }

  const labelPoint = destinationPoint(station.latitude, station.longitude, 45, Math.max(rangeKm * .62, .25));
  L.marker([labelPoint.lat, labelPoint.lng], {
    interactive: false,
    icon: L.divIcon({
      className: '',
      html: `<div class="sector-label"><b>zasięg ~${formatRangeShort(rangeKm)}</b><span>orientacyjnie</span></div>`,
      iconSize: [132, 28],
      iconAnchor: [66, 14]
    })
  }).addTo(state.sectorLayer);
}

function sectorPolygon(lat, lon, bearing, rangeKm, widthDeg) {
  const points = [[lat, lon]];
  const start = bearing - widthDeg / 2;
  const end = bearing + widthDeg / 2;
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const b = start + (end - start) * (i / steps);
    const dest = destinationPoint(lat, lon, b, rangeKm);
    points.push([dest.lat, dest.lng]);
  }
  points.push([lat, lon]);
  return points;
}

function baseRangeFromBands(station) {
  const normalizedBands = (station.bands || []).map(normalizeText).join(' ');
  if (normalizedBands.includes('nr3500') || normalizedBands.includes('nr3600') || normalizedBands.includes('5g3600')) return 1.5;
  if (normalizedBands.includes('lte2600')) return 2.5;
  if (normalizedBands.includes('lte2100') || normalizedBands.includes('nr2100')) return 4;
  if (normalizedBands.includes('lte1800')) return 5;
  if (normalizedBands.includes('lte800') || normalizedBands.includes('lte900') || normalizedBands.includes('gsm900')) return 8;
  return 4;
}

function powerRangeMultiplier(station) {
  const info = getBestPowerInfo(station);
  if (!info || !Number.isFinite(info.watts) || info.watts <= 0) return 1;
  return clamp(Math.sqrt(info.watts / 20), .65, 1.7);
}

function estimateStationRangeKm(station) {
  if (Number.isFinite(station.range_km) && station.range_km > 0) return station.range_km;
  return Math.round(baseRangeFromBands(station) * powerRangeMultiplier(station) * 10) / 10;
}

function coverageReliability(station) {
  const hasRange = Number.isFinite(station.range_km) && station.range_km > 0;
  const hasAzimuth = Array.isArray(station.azimuths) && station.azimuths.length > 0;
  const hasPower = !!getBestPowerInfo(station);
  if (hasRange && hasAzimuth && hasPower) return 'dane: zasięg + azymut + moc';
  if (hasAzimuth && hasPower) return 'szacunek z pasma, mocy i azymutu';
  if (hasAzimuth) return 'szacunek z pasma i azymutu';
  if (hasPower) return 'szacunek z pasma i mocy, bez kierunku';
  return 'szacunek z pasma, bez mocy i azymutu';
}

function formatRangeShort(km) {
  if (!Number.isFinite(km)) return '—';
  return km < 10 ? `${String(km).replace('.', ',')} km` : `${Math.round(km)} km`;
}

function formatCoverageInfo(station) {
  const range = estimateStationRangeKm(station);
  const azimuths = station.azimuths && station.azimuths.length ? `${station.azimuths.join('°, ')}°` : 'Brak danych o azymutach — pokazuję orientacyjny promień';
  return `gradient ~${formatRangeShort(range)}; ${azimuths}; ${coverageReliability(station)}`;
}

function formatTechnicalDataQuality(station) {
  const parts = [];
  parts.push(station.azimuths && station.azimuths.length ? 'azymut: z danych' : 'azymut: brak');
  parts.push(getBestPowerInfo(station) ? 'moc/EIRP: z danych' : 'moc/EIRP: brak');
  parts.push(Number.isFinite(station.antenna_height_m) ? 'wysokość: z danych' : 'wysokość: brak');
  const sources = station.param_sources && station.param_sources.length ? `źródło: ${station.param_sources.slice(0, 3).join(', ')}` : 'źródło: baza główna / brak uzupełnienia';
  return `${parts.join(' • ')} • ${sources}`;
}

function showStationDetails(station) {
  el.emptyDetails.classList.add('hidden');
  el.detailCard.classList.remove('hidden');
  const origin = getOrigin();
  const distance = haversineKm(origin.lat, origin.lng, station.latitude, station.longitude);
  const bearing = azimuthDeg(origin.lat, origin.lng, station.latitude, station.longitude);
  const bearingText = `${Math.round(bearing)}°`;
  el.detailTitle.textContent = `${station.operator} • ${station.station_id}`;
  el.detailSubtitle.textContent = station.city || station.address || 'Brak opisu lokalizacji';
  el.detailBody.innerHTML = [
    distanceHero(distance, bearing, getOriginLabel()),
    detailLine('Operator', station.operator),
    detailLine('ID stacji', station.station_id),
    detailLine('Miejscowość', station.city || '—'),
    detailLine('Adres', station.address || '—'),
    detailLine('Pasma', formatBands(station.bands)),
    detailLine('Moc nadawania', formatPower(station)),
    detailLine('Wysokość anteny', formatOptionalNumber(station.antenna_height_m, 'm')),
    detailLine('Pochylenie anteny', formatOptionalNumber(station.tilt_deg, '°')),
    detailLine('Jakość danych technicznych', formatTechnicalDataQuality(station)),
    detailLine('Współdzielony nadajnik', formatSharedOperators(station)),
    detailLine('Zasięg na mapie', formatCoverageInfo(station)),
    detailLine('Model gradientu', '0–33% mocny kolor, 33–66% średni, 66–100% słaby'),
    detailLine('Azymuty', station.azimuths && station.azimuths.length ? `${station.azimuths.join('°, ')}°` : 'Brak danych o azymutach — kierunek niepewny'),
    detailLine('Rekordy', compactNumber(station.records_count)),
    detailLine('Odległość', formatDistance(distance)),
    detailLine('Kierunek', bearingText),
    detailLine('Współrzędne', `${station.latitude.toFixed(6)}, ${station.longitude.toFixed(6)}`),
    detailLine('Źródło', station.source || '—'),
    detailLine('Źródła parametrów', station.param_sources && station.param_sources.length ? station.param_sources.join(', ') : '—')
  ].join('');
}

function distanceHero(distance, bearing, originLabel) {
  return `
    <div class="distance-hero">
      <div>
        <span class="distance-hero-label">Odległość do BTS</span>
        <strong>${escapeHtml(formatDistance(distance))}</strong>
        <small>${escapeHtml(originLabel)}</small>
      </div>
      <div class="bearing-hero">
        <span class="bearing-arrow" style="--bearing:${Number.isFinite(bearing) ? bearing : 0}deg"></span>
        <b>${escapeHtml(Number.isFinite(bearing) ? `${Math.round(bearing)}°` : '—')}</b>
      </div>
    </div>
  `;
}

function getOriginLabel() {
  if (state.measureSource === 'gps') return 'liczone od Twojej pozycji GPS';
  if (state.measureSource === 'manual') return 'liczone od punktu pomiarowego';
  return 'liczone od środka mapy';
}

function detailLine(label, value) {
  return `<div class="detail-line"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function hideDetails() {
  state.selected = null;
  state.sectorLayer.clearLayers();
  if (state.stationPopup && state.map) state.map.closePopup(state.stationPopup);
  state.stationPopup = null;
  el.detailCard.classList.add('hidden');
  el.emptyDetails.classList.remove('hidden');
  updateNavigationIndicator();
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
          <span class="badge distance-badge">${escapeHtml(formatDistance(distance))}</span>
          <span class="badge">${escapeHtml(formatBands(station.bands))}</span>
          <span class="badge">${escapeHtml(station.azimuths && station.azimuths.length ? `az. ${station.azimuths.length}` : 'az. brak')}</span>
          <span class="badge">${escapeHtml(getBestPowerInfo(station) ? 'moc: tak' : 'moc: brak')}</span>
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
  if (state.measureSource !== 'gps') {
    const icon = L.divIcon({
      className: '',
      html: '<div class="measure-pin"><span></span></div>',
      iconSize: [34, 42],
      iconAnchor: [17, 40]
    });
    L.marker([state.measure.lat, state.measure.lng], { icon, interactive: false }).addTo(state.measureLayer);
  }
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

function setMeasurePoint(latlng, source = 'manual') {
  state.measure = { lat: latlng.lat, lng: latlng.lng };
  state.measureSource = source;
  state.setPointMode = false;
  el.setPointBtn.classList.remove('active');
  el.setPointBtn.textContent = 'Ustaw punkt pomiaru';
  setStatus(source === 'gps' ? 'Odległości liczone są od Twojej pozycji GPS.' : 'Ustawiono punkt pomiarowy. Odległości liczone są od tego punktu.');
  if (state.selected) showStationDetails(state.selected);
  updateNavigationIndicator();
  scheduleRender();
}

function clearMeasurePoint() {
  state.measure = null;
  state.measureSource = null;
  setStatus('Punkt pomiarowy wyczyszczony. Odległości liczone są od środka mapy.');
  if (state.selected) showStationDetails(state.selected);
  updateNavigationIndicator();
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
  setStatus(`Pokazuję najbliższe stacje względem ${state.measureSource === 'gps' ? 'GPS' : state.measure ? 'punktu pomiarowego' : 'środka mapy'}.`);
}

function matchesNonSpatialFilters(station) {
  if (state.operator !== 'Wszyscy' && station.operator !== state.operator) return false;
  if (state.band !== 'Wszystkie' && !(station.bands || []).includes(state.band)) return false;
  if (state.search.length >= SEARCH_MIN_CHARS && !matchesSearchQuery(station, state.search) && !matchesRelaxedSearchQuery(station, state.search)) return false;
  return true;
}


function fitMapToStations(stations) {
  if (!state.map || !Array.isArray(stations) || !stations.length || !window.L) return;
  try {
    const bounds = L.latLngBounds([]);
    for (const station of stations) bounds.extend([station.latitude, station.longitude]);
    if (bounds.isValid()) state.map.fitBounds(bounds.pad(0.08), { maxZoom: 13, animate: true });
  } catch (err) {
    console.warn(err);
  }
}

function searchTokens(query) {
  return normalizeText(query).split(/\s+/).filter(Boolean);
}

function matchesSearchQuery(station, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return true;
  return tokens.every(token => station._search.includes(token));
}

function matchesRelaxedSearchQuery(station, query) {
  const tokens = searchTokens(query);
  const textTokens = tokens.filter(token => /[a-ząćęłńóśźż]/i.test(token));
  if (!textTokens.length || textTokens.length === tokens.length) return false;
  return textTokens.every(token => station._search.includes(token));
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
  let strict = true;
  let matches = state.stations.filter(station => matchesSearchQuery(station, normalized));
  if (!matches.length) {
    matches = state.stations.filter(station => matchesRelaxedSearchQuery(station, normalized));
    strict = false;
  }
  return matches
    .map(station => ({
      station,
      score: scoreStationSearch(station, normalized) + (strict ? 20 : 0),
      distance: haversineKm(origin.lat, origin.lng, station.latitude, station.longitude)
    }))
    .sort((a, b) => (b.score - a.score) || (a.distance - b.distance))
    .slice(0, limit)
    .map(item => item.station);
}

async function runSearch(options = {}) {
  const center = options.center !== false;
  const showPanel = options.showPanel !== false;
  const rawQuery = el.searchInput.value.trim();
  state.search = normalizeText(rawQuery);

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
    const place = center ? await geocodePlace(rawQuery).catch(() => null) : null;
    const fallbackPlace = !place && center ? await geocodePlace(cleanPlaceQueryForGeocode(rawQuery)).catch(() => null) : null;
    const foundPlace = place || fallbackPlace;
    if (foundPlace && state.map) {
      state.search = '';
      state.map.setView([foundPlace.lat, foundPlace.lon], Math.max(state.map.getZoom(), 13), { animate: true });
      scheduleRender();
      setStatus(`Przeniesiono mapę do: ${foundPlace.label}`);
      if (showPanel) setPanelMode('collapsed');
      return;
    }

    state.currentList = [];
    state.currentVisibleTotal = 0;
    renderMarkers([]);
    renderList();
    updateStats();
    setStatus(`Brak wyników dla: ${rawQuery}`);
    if (showPanel) {
      setTab('list');
      setPanelMode('half');
    }
    return;
  }

  state.currentList = results.slice(0, MAX_LIST_ROWS);
  state.currentVisibleTotal = results.length;
  renderMarkers(results);
  if (state.selected) renderSelectedStationExtras(state.selected);
  renderList();
  updateMeasureMarker();
  updateNavigationIndicator();
  updateStats();

  if (center && state.map) {
    focusSearchResults(results, rawQuery);
  }

  if (showPanel) {
    setTab('list');
    setPanelMode('half');
  }

  setStatus(`Wyniki: ${compactNumber(results.length)} dla „${rawQuery}”.`);
}

function focusSearchResults(results, rawQuery) {
  if (!state.map || !results.length) return;
  const normalized = normalizeText(rawQuery);
  const exactId = results.find(station => normalizeText(station.station_id) === normalized);
  if (exactId) {
    selectStation(exactId, true);
    return;
  }

  const textTokens = searchTokens(normalized).filter(token => /[a-ząćęłńóśźż]/i.test(token));
  const cityMatches = textTokens.length
    ? results.filter(station => textTokens.every(token => normalizeText(station.city).includes(token)))
    : [];
  const focused = cityMatches.length >= 2 ? cityMatches : results;
  if (focused.length === 1) {
    state.map.setView([focused[0].latitude, focused[0].longitude], Math.max(state.map.getZoom(), 14), { animate: true });
    return;
  }

  fitMapToStations(focused.slice(0, 80));
}

function cleanPlaceQueryForGeocode(query) {
  const tokens = String(query || '').trim().split(/\s+/).filter(Boolean);
  const textTokens = tokens.filter(token => /[a-ząćęłńóśźż]/i.test(token));
  return textTokens.length ? textTokens.join(' ') : query;
}

async function geocodePlace(query) {
  const normalized = String(query || '').trim();
  if (normalized.length < SEARCH_MIN_CHARS) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pl&q=${encodeURIComponent(normalized)}`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) return null;
  const data = await response.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, label: first.display_name || normalized };
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

async function locateUser() {
  if (!navigator.geolocation) {
    setStatus('Ta przeglądarka nie obsługuje GPS.');
    return;
  }

  await startCompassTracking(false);

  if (state.userWatchId !== null) {
    setStatus('GPS jest już aktywny. Odległości są liczone od Twojej pozycji.');
    centerOnUser();
    return;
  }

  setStatus('Uruchamiam GPS i śledzenie pozycji…');
  state.gpsTracking = true;
  let firstFix = true;
  state.userWatchId = navigator.geolocation.watchPosition(
    pos => {
      updateUserPosition(pos, firstFix);
      firstFix = false;
    },
    err => {
      setStatus(`GPS niedostępny: ${err.message}`);
      state.gpsTracking = false;
      state.userWatchId = null;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
  );
}

function updateUserPosition(pos, centerFirst = false) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  state.userLocation = {
    lat,
    lng,
    accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
    heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
    speed: Number.isFinite(pos.coords.speed) ? pos.coords.speed : null
  };

  state.measure = { lat, lng };
  state.measureSource = 'gps';

  updateUserLocationMarker();
  updateNavigationIndicator();
  if (state.selected) showStationDetails(state.selected);
  if (centerFirst && state.map) centerOnUser();

  const accuracyText = state.userLocation.accuracy ? ` • dokładność ok. ${Math.round(state.userLocation.accuracy)} m` : '';
  setStatus(`Pozycja GPS aktywna${accuracyText}`);
  scheduleRender();
}

function centerOnUser() {
  if (!state.map || !state.userLocation) return;
  state.map.setView([state.userLocation.lat, state.userLocation.lng], Math.max(state.map.getZoom(), 15), { animate: true });
}

function updateUserLocationMarker() {
  if (!state.map || !state.userLocation || !window.L) return;
  const latlng = [state.userLocation.lat, state.userLocation.lng];
  const accuracy = state.userLocation.accuracy || 25;

  if (!state.userAccuracyCircle) {
    state.userAccuracyCircle = L.circle(latlng, {
      radius: Math.max(20, accuracy),
      color: '#2563eb',
      weight: 1,
      fillColor: '#2563eb',
      fillOpacity: .08,
      interactive: false
    }).addTo(state.map);
  } else {
    state.userAccuracyCircle.setLatLng(latlng);
    state.userAccuracyCircle.setRadius(Math.max(20, accuracy));
  }

  if (!state.userMarker) {
    state.userMarker = L.marker(latlng, { icon: userLocationIcon(), interactive: false, zIndexOffset: 1000 }).addTo(state.map);
  } else {
    state.userMarker.setLatLng(latlng);
    updateUserMarkerHeading();
  }
}

function currentPhoneHeading() {
  const heading = Number.isFinite(state.compassHeading) ? state.compassHeading : state.userLocation?.heading;
  return Number.isFinite(heading) ? heading : 0;
}

function updateUserMarkerHeading() {
  const marker = state.userMarker?.getElement?.();
  const element = marker ? marker.querySelector('.user-location-marker') : null;
  if (element) element.style.setProperty('--heading', `${currentPhoneHeading()}deg`);
  else if (state.userMarker) state.userMarker.setIcon(userLocationIcon());
}

function userLocationIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="user-location-marker" style="--heading:${currentPhoneHeading()}deg"><span class="user-north">N</span><span class="user-heading"></span><span class="user-dot"></span></div>`,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });
}

async function startCompassTracking(showErrors = true) {
  if (state.compassActive) return true;
  if (typeof DeviceOrientationEvent === 'undefined') {
    if (showErrors) setStatus('Ta przeglądarka nie udostępnia kompasu telefonu.');
    return false;
  }

  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      let result;
      try {
        result = await DeviceOrientationEvent.requestPermission(true);
      } catch (_) {
        result = await DeviceOrientationEvent.requestPermission();
      }
      if (result !== 'granted') {
        if (showErrors) setStatus('Brak zgody na kompas telefonu.');
        return false;
      }
    }

    window.addEventListener('deviceorientationabsolute', handleDeviceOrientation, true);
    window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    state.compassActive = true;
    updateNavigationIndicator();
    if (showErrors) setStatus('Kompas telefonu włączony. Obróć telefon, aby zobaczyć kierunek do BTS.');
    return true;
  } catch (err) {
    if (showErrors) setStatus(`Nie udało się włączyć kompasu: ${err.message}`);
    return false;
  }
}

function handleDeviceOrientation(event) {
  const reading = readCompassHeading(event);
  if (!reading || !Number.isFinite(reading.heading)) return;

  const now = performanceNow();
  if (reading.absolute) {
    state.lastAbsoluteCompassAt = now;
  } else if (now - state.lastAbsoluteCompassAt < COMPASS_ABSOLUTE_LOCK_MS) {
    return;
  }

  const smoothed = smoothCompassHeading(reading.heading);
  const previous = Number.isFinite(state.compassHeading) ? state.compassHeading : null;
  const delta = previous === null ? 360 : Math.abs(signedTurnDegrees(smoothed, previous));
  const forceRefresh = now - state.lastCompassUiUpdate > 520;

  if (delta < COMPASS_MIN_DELTA_DEG && !forceRefresh) return;

  state.compassHeading = smoothed;
  state.compassAbsolute = !!reading.absolute;

  if (now - state.lastCompassUiUpdate < COMPASS_UI_INTERVAL_MS && !forceRefresh) return;
  state.lastCompassUiUpdate = now;

  updateUserMarkerHeading();
  updateNavigationIndicator();
}

function readCompassHeading(event) {
  const screenAngle = getScreenOrientationAngle();
  if (Number.isFinite(event.webkitCompassHeading)) {
    return { heading: normalizeDegrees(event.webkitCompassHeading), absolute: true };
  }
  if (Number.isFinite(event.alpha)) {
    const isAbsolute = !!event.absolute || event.type === 'deviceorientationabsolute';
    return { heading: normalizeDegrees(360 - event.alpha - screenAngle), absolute: isAbsolute };
  }
  return null;
}

function smoothCompassHeading(heading) {
  const normalized = normalizeDegrees(heading);
  if (!Number.isFinite(state.compassSmoothedHeading)) {
    state.compassSmoothedHeading = normalized;
    return normalized;
  }

  const diff = signedTurnDegrees(normalized, state.compassSmoothedHeading);
  const abs = Math.abs(diff);
  if (abs < 0.8) return state.compassSmoothedHeading;

  const factor = abs > 45 ? 0.42 : COMPASS_SMOOTHING;
  state.compassSmoothedHeading = normalizeDegrees(state.compassSmoothedHeading + diff * factor);
  return state.compassSmoothedHeading;
}

function getScreenOrientationAngle() {
  const angle = screen?.orientation && Number.isFinite(screen.orientation.angle) ? screen.orientation.angle : window.orientation;
  return Number.isFinite(angle) ? angle : 0;
}

function performanceNow() {
  return window.performance && typeof window.performance.now === 'function' ? window.performance.now() : Date.now();
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function signedTurnDegrees(targetBearing, heading) {
  return ((targetBearing - heading + 540) % 360) - 180;
}

function formatTurnHint(targetBearing, heading) {
  if (!Number.isFinite(targetBearing) || !Number.isFinite(heading)) return '';
  const turn = signedTurnDegrees(targetBearing, heading);
  const abs = Math.round(Math.abs(turn));
  if (abs <= 8) return ' • na wprost';
  return ` • ${turn > 0 ? 'prawo' : 'lewo'} ${abs}°`;
}

function getNavigationOrigin() {
  if (state.userLocation) return { lat: state.userLocation.lat, lng: state.userLocation.lng, source: 'gps' };
  if (state.measure) return { lat: state.measure.lat, lng: state.measure.lng, source: state.measureSource || 'manual' };
  return null;
}

function updateNavigationIndicator() {
  if (!el.compassWidget) return;

  const heading = Number.isFinite(state.compassHeading) ? state.compassHeading : null;
  const origin = getNavigationOrigin();
  const hasTarget = !!(state.selected && origin);
  let targetBearing = null;
  let targetDistance = null;

  if (hasTarget) {
    targetBearing = azimuthDeg(origin.lat, origin.lng, state.selected.latitude, state.selected.longitude);
    targetDistance = haversineKm(origin.lat, origin.lng, state.selected.latitude, state.selected.longitude);
  }

  if (el.compassPhoneArrow) {
    el.compassPhoneArrow.style.setProperty('--heading', `${heading ?? 0}deg`);
    el.compassPhoneArrow.classList.toggle('inactive', heading === null);
  }

  if (el.compassTargetArrow) {
    el.compassTargetArrow.classList.toggle('hidden', !hasTarget);
    if (hasTarget) {
      el.compassTargetArrow.style.setProperty('--target-bearing', `${targetBearing}deg`);
    }
  }

  if (el.compassHeadingLabel) {
    if (heading === null) el.compassHeadingLabel.textContent = state.compassActive ? 'Obróć telefon' : 'Kompas';
    else el.compassHeadingLabel.textContent = `${Math.round(heading)}°`;
  }

  if (el.compassTargetLabel) {
    if (!hasTarget) {
      el.compassTargetLabel.textContent = state.compassActive ? 'Wybierz BTS' : 'Dotknij, aby włączyć';
    } else {
      const turnText = heading === null ? '' : formatTurnHint(targetBearing, heading);
      el.compassTargetLabel.textContent = `BTS ${Math.round(targetBearing)}° • ${formatDistance(targetDistance)}${turnText}`;
    }
  }
}

async function updateFromUkeOnline(options = {}) {
  if (!UKE_ONLINE_IMPORT_ENABLED) {
    setUkeStatus(UKE_ONLINE_DISABLED_MESSAGE, null, 'info', false);
    return;
  }

  if (state.ukeUpdateRunning) {
    setUkeStatus('Aktualizacja UKE już trwa. Poczekaj na zakończenie.', null, 'busy', true);
    return;
  }
  if (!window.XLSX) {
    setUkeStatus(XLSX_CDN_NOTE, null, 'error', false);
    return;
  }

  state.ukeUpdateRunning = true;
  const previousSelected = options.preserveSelected && state.selected ? { ...state.selected } : null;
  const originalButtonText = el.ukeUpdateBtn ? el.ukeUpdateBtn.textContent : '';
  if (el.ukeUpdateBtn) {
    el.ukeUpdateBtn.disabled = true;
    el.ukeUpdateBtn.textContent = 'Aktualizuję…';
  }

  try {
    setUkeStatus('Łączę z UKE / dane.gov i szukam aktualnych arkuszy…', 3, 'busy', true);
    const links = await collectUkeDownloadLinks();
    if (!links.length) throw new Error('Nie znaleziono linków do arkuszy UKE. Spróbuj później albo użyj importu z pliku.');

    const selectedLinks = links.slice(0, UKE_LINK_LIMIT);
    setUkeStatus(`Znaleziono ${links.length} arkuszy. Pobieram ${selectedLinks.length} plików…`, 8, 'busy', true);

    const allStations = [];
    for (let index = 0; index < selectedLinks.length; index++) {
      const link = selectedLinks[index];
      const progress = Math.round(((index + 1) / selectedLinks.length) * 88) + 8;
      setUkeStatus(`Pobieram ${index + 1}/${selectedLinks.length}: ${link.name || sourceNameFromUrlSafe(link.url)}`, progress, 'busy', true);
      const stations = await parseUkeRemoteFile(link);
      allStations.push(...stations);
      setUkeStatus(`Odczytano ${compactNumber(allStations.length)} rekordów. Przetworzono ${index + 1}/${selectedLinks.length}.`, progress, 'busy', true);
    }

    if (!allStations.length) throw new Error('Pobrano pliki UKE, ale nie udało się odczytać stacji z poprawnymi współrzędnymi.');
    setUkeStatus('Scalam rekordy i zapisuję bazę lokalnie…', 98, 'busy', true);
    const stamp = new Date().toLocaleString('pl-PL');
    setStations(allStations, `UKE online • ${stamp}`, { save: true, fit: !previousSelected });
    if (previousSelected) {
      const matched = findBestStationMatch(previousSelected, state.stations);
      if (matched) {
        selectStation(matched, true, true);
        setTab('details');
        setPanelMode(isMobileLayout() ? 'collapsed' : state.panelMode, false);
      }
    }
    const finalMessage = `Gotowe. Zaktualizowano bazę UKE: ${compactNumber(state.stations.length)} stacji. Data zapisu: ${stamp}.`;
    setUkeStatus(finalMessage, 100, 'success', false);
    setPanelMode(isMobileLayout() ? 'collapsed' : state.panelMode, false);
  } catch (err) {
    console.error(err);
    setUkeStatus(`Aktualizacja z UKE nieudana: ${describeUkeDownloadError(err)} Użyj importu ręcznie pobranego ZIP/XLSX z UKE.`, null, 'error', false);
  } finally {
    state.ukeUpdateRunning = false;
    if (el.ukeUpdateBtn) {
      el.ukeUpdateBtn.disabled = false;
      el.ukeUpdateBtn.textContent = originalButtonText || 'Aktualizuj z UKE online';
    }
  }
}

async function updateSelectedFromUkeOnline() {
  if (!UKE_ONLINE_IMPORT_ENABLED) {
    setUkeStatus(UKE_ONLINE_DISABLED_MESSAGE, null, 'info', false);
    return;
  }

  if (!state.selected) {
    setUkeStatus('Najpierw wybierz nadajnik na mapie.', null, 'error', false);
    return;
  }
  setUkeStatus(`Uzupełniam dane UKE dla: ${state.selected.operator} ${state.selected.station_id}…`, 2, 'busy', true);
  await updateFromUkeOnline({ preserveSelected: true });
}

function findBestStationMatch(reference, stations) {
  if (!reference || !Array.isArray(stations) || !stations.length) return null;
  const refOperator = normalizeText(reference.operator);
  const refId = normalizeText(reference.station_id);
  const refCity = normalizeText(reference.city);
  const refBands = new Set((reference.bands || []).map(normalizeText));
  let best = null;
  let bestScore = -Infinity;

  for (const station of stations) {
    const distance = haversineKm(reference.latitude, reference.longitude, station.latitude, station.longitude);
    if (!Number.isFinite(distance) || distance > 1.2) continue;

    let score = Math.max(0, 140 - distance * 140);
    const operator = normalizeText(station.operator);
    const id = normalizeText(station.station_id);
    const city = normalizeText(station.city);
    if (operator && refOperator && (operator === refOperator || operator.includes(refOperator) || refOperator.includes(operator))) score += 80;
    if (id && refId && id === refId) score += 120;
    else if (id && refId && (id.includes(refId) || refId.includes(id))) score += 45;
    if (city && refCity && city === refCity) score += 35;
    for (const band of (station.bands || []).map(normalizeText)) {
      if (refBands.has(band)) score += 12;
    }
    if (station.azimuths && station.azimuths.length) score += 12;
    if (getBestPowerInfo(station)) score += 12;

    if (score > bestScore) {
      bestScore = score;
      best = station;
    }
  }
  return bestScore >= 45 ? best : null;
}


function describeUkeDownloadError(err) {
  const message = String(err?.message || err || 'nieznany błąd');
  if (/403|failed to fetch|cors|load failed|networkerror/i.test(message)) {
    return `${message}. To zwykle oznacza blokadę pobierania plików UKE/Box bezpośrednio z przeglądarki. Publiczne CORS-proxy są wyłączone.`;
  }
  return message;
}

async function collectUkeDownloadLinks() {
  const sources = [];
  const errors = [];

  try {
    const text = await fetchTextWithFallback(UKE_DATA_GOV_RESOURCES, 'application/json');
    const json = JSON.parse(text);
    sources.push(...extractUkeLinksFromObject(json));
  } catch (err) {
    errors.push(`dane.gov JSON: ${err.message}`);
    console.warn('dane.gov.pl resources failed', err);
  }

  if (!sources.length) {
    try {
      const text = await fetchTextWithFallback(UKE_DATA_GOV_METADATA, 'text/csv,text/plain,*/*');
      sources.push(...extractUkeLinksFromText(text));
    } catch (err) {
      errors.push(`dane.gov metadata: ${err.message}`);
      console.warn('dane.gov.pl metadata failed', err);
    }
  }

  if (!sources.length) {
    try {
      const html = await fetchTextWithFallback(UKE_BIP_PAGE, 'text/html,*/*');
      sources.push(...extractUkeLinksFromHtml(html, UKE_BIP_PAGE));
    } catch (err) {
      errors.push(`BIP UKE: ${err.message}`);
      console.warn('UKE BIP page failed', err);
    }
  }

  const links = uniqueUkeLinks(sources)
    .filter(link => isUkeStationBandName(link.name || link.url))
    .sort((a, b) => bandSort(inferBandFromName(a.name || a.url), inferBandFromName(b.name || b.url)) || String(a.name).localeCompare(String(b.name), 'pl'));

  if (!links.length && errors.length) {
    throw new Error(`Nie udało się pobrać listy arkuszy UKE. ${errors.slice(0, 3).join(' | ')}`);
  }

  return links;
}

function extractUkeLinksFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('a[href]'))
    .map(a => ({
      url: new URL(a.getAttribute('href'), baseUrl).href,
      name: (a.textContent || a.getAttribute('href') || '').trim()
    }))
    .filter(link => /\.(xlsx|xls|csv)(?:$|[?#])/i.test(link.url));
}

function extractUkeLinksFromText(text) {
  const out = [];
  const pattern = /https?:\/\/[^\s"'<>;]+?\.(?:xlsx|xls|csv)(?:\?[^\s"'<>;]*)?/gi;
  for (const match of String(text || '').matchAll(pattern)) {
    const url = match[0];
    const lineStart = Math.max(0, String(text).lastIndexOf('\n', match.index));
    const lineEnd = String(text).indexOf('\n', match.index);
    const line = String(text).slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    out.push({ url, name: line || sourceNameFromUrlSafe(url) });
  }
  return out;
}

function extractUkeLinksFromObject(value, inheritedName = '') {
  const found = [];
  const walk = (item, contextName = inheritedName) => {
    if (item === null || item === undefined) return;
    if (typeof item === 'string') {
      if (/^https?:\/\//i.test(item) && /\.(xlsx|xls|csv)(?:$|[?#])/i.test(item)) {
        found.push({ url: item, name: contextName || item.split('/').pop() || item });
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach(child => walk(child, contextName));
      return;
    }
    if (typeof item === 'object') {
      const localName = String(item.title || item.name || item.filename || item.file_name || item.description || contextName || '').trim();
      for (const [key, child] of Object.entries(item)) {
        const keyName = /title|name|filename|description/i.test(key) && typeof child === 'string' ? child : localName;
        walk(child, keyName || localName);
      }
    }
  };
  walk(value, inheritedName);
  return found;
}

function uniqueUkeLinks(links) {
  const out = [];
  const seen = new Set();
  for (const link of links) {
    if (!link.url) continue;
    const normalizedUrl = link.url.replace(/&amp;/g, '&');
    const key = normalizedUrl.split('#')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: normalizedUrl, name: link.name || sourceNameFromUrlSafe(normalizedUrl) });
  }
  return out;
}

function isUkeStationBandName(value) {
  const text = normalizeText(value);
  return /(5g|nr|lte|umts|gsm|cdma)/.test(text) && !text.includes('archiw');
}

function inferBandFromName(value) {
  const text = normalizeText(value).replace(/[_-]+/g, ' ');
  const match = text.match(/\b(5g|nr|lte|umts|gsm|cdma)\s*\/?\s*-?\s*(\d{3,4})\b/);
  if (!match) return '';
  const family = match[1].toUpperCase();
  const number = match[2];
  if (family === '5G' || family === 'NR') return `NR${number}`;
  return `${family}${number}`;
}

async function parseUkeRemoteFile(link) {
  const url = link.url;
  const lower = url.toLowerCase();
  const band = inferBandFromName(`${link.name} ${url}`);
  if (lower.includes('.csv') || lower.includes('.txt')) {
    const text = await fetchTextNoStore(url);
    const result = await workerRequest({ type: 'parseText', text, name: `UKE ${link.name}`, contentType: 'text/csv' });
    return result.stations.map(station => enrichUkeStation(station, band, link.name));
  }
  const buffer = await fetchArrayBufferNoStore(url);
  const result = await parseSpreadsheetBuffer(buffer, link.name || sourceNameFromUrlSafe(url), 'UKE ');
  return result.stations.map(station => enrichUkeStation(station, band, link.name));
}

function enrichUkeRow(row, band, sourceName) {
  return {
    ...row,
    ukeband: band || row.ukeband || row.pasmo || row.technologia || row.system || '',
    source: `UKE ${sourceName || ''}`.trim()
  };
}

function enrichUkeStation(station, band, sourceName) {
  if (band && (!Array.isArray(station.bands) || !station.bands.some(item => normalizeText(item) === normalizeText(band)))) {
    station.bands = cleanBands([...(station.bands || []), band]);
  }
  station.source = station.source || `UKE ${sourceName || ''}`.trim();
  return station;
}

async function fetchTextNoStore(url) {
  return fetchTextWithFallback(url, 'text/csv,text/plain,text/html,*/*');
}

async function fetchArrayBufferNoStore(url) {
  return fetchArrayBufferWithFallback(url);
}

async function fetchTextWithFallback(url, accept = '*/*') {
  const response = await fetchWithCorsFallback(url, accept);
  return response.text();
}

async function fetchArrayBufferWithFallback(url) {
  const response = await fetchWithCorsFallback(url, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,*/*');
  return response.arrayBuffer();
}

async function fetchWithCorsFallback(url, accept = '*/*') {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: accept }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (err) {
    throw new Error(`${sourceNameFromUrlSafe(url)}: ${err.message}. Publiczne CORS-proxy są wyłączone; użyj bezpośredniego linku z prawidłowym CORS albo importu ręcznego.`);
  }
}

function sourceNameFromUrlSafe(url) {
  try {
    return decodeURIComponent(new URL(url, location.href).pathname.split('/').filter(Boolean).pop() || url);
  } catch (_) {
    return String(url || 'źródło');
  }
}


function openUkePage() {
  window.open(UKE_BIP_PAGE, '_blank', 'noopener,noreferrer');
  setUkeStatus('Otworzyłem stronę UKE. Pobierz „wszystkie załączniki w formacie .zip” albo wybrane XLSX, potem użyj importu JSON/CSV/XLSX/ZIP.', null, 'info', false);
}

function openSi2pemPage() {
  window.open(SI2PEM_MAP_URL, '_blank', 'noopener,noreferrer');
  showStatusToast('SI2PEM / raporty PEM', 'Na mapie SI2PEM wyszukaj konkretną stację, pomiar albo zgłoszenie. Jeżeli znajdziesz raport PDF/TXT z EIRP, azymutem, wysokością lub pochyleniem anteny, wgraj go przez „Uzupełnij parametry”.', 'info', { sticky: true });
}

function openTechnicalSources() {
  const text = 'Najpewniejsze źródła parametrów: 1) raporty/zgłoszenia PEM z SI2PEM, 2) BIP gmin i powiatów z PDF zgłoszeń instalacji, 3) własny backend pobierający API SI2PEM i zapisujący JSON/CSV, 4) CellMapper tylko pomocniczo do orientacyjnego kierunku, nie do mocy. Otwieram dokumentację SI2PEM API.';
  window.open(SI2PEM_API_DOCS_URL, '_blank', 'noopener,noreferrer');
  showStatusToast('Źródła azymutu i mocy', text, 'info', { sticky: true });
}

function downloadParameterTemplate() {
  const rows = [
    ['station_id', 'operator', 'city', 'address', 'latitude', 'longitude', 'bands', 'azimuths', 'power', 'eirp_dbm', 'range_km', 'antenna_height_m', 'tilt_deg', 'source'],
    ['BT12345', 'Orange', 'Mielec', 'ul. Przykładowa 1', '50.287200', '21.423100', 'LTE800;LTE1800;NR78', '0;120;240', '120 W', '', '4.5', '32', '3', 'SI2PEM / BIP / raport PEM']
  ];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'myBTS_szablon_parametrow.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showStatusToast('Szablon CSV', 'Pobrano szablon do ręcznego dopisywania azymutów, mocy/EIRP, wysokości i pochylenia anten.', 'success', { sticky: false });
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
    showStatusToast('Import bazy', `Wczytuję ${file.name}…`, 'busy', { sticky: true, progress: 8 });
    const name = file.name.toLowerCase();
    let result;
    if (name.endsWith('.pdf')) {
      await importParameterFile(file);
      return;
    }
    if (name.endsWith('.zip')) {
      result = await importZipStationFile(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      result = await parseSpreadsheetStationFile(file);
    } else if (name.endsWith('.xml') || name.endsWith('.html') || name.endsWith('.htm')) {
      result = await parseXmlOrHtmlStationFile(file);
    } else {
      result = await workerRequest({ type: 'parseText', text: await file.text(), name: file.name, contentType: file.type });
    }
    if (!result || !Array.isArray(result.stations) || !result.stations.length) {
      throw new Error('Plik został odczytany, ale nie znaleziono stacji z poprawnymi współrzędnymi.');
    }
    setStations(result.stations, result.sourceName || file.name, { save: true, fit: true });
    const msg = `Zaimportowano ${compactNumber(result.stations.length)} stacji z ${file.name}. Baza jest aktywna od razu.`;
    setStatus(msg);
    showStatusToast('Import bazy', msg, 'success', { sticky: false, progress: 100, timeout: 7000 });
  } catch (err) {
    const message = `Błąd importu pliku: ${err.message}`;
    setStatus(message);
    showStatusToast('Import bazy', message, 'error', { sticky: true });
  } finally {
    el.dataFileInput.value = '';
  }
}

async function parseSpreadsheetStationFile(file, sourcePrefix = '') {
  const buffer = await file.arrayBuffer();
  return parseSpreadsheetBuffer(buffer, file.name, sourcePrefix);
}

async function parseSpreadsheetBuffer(buffer, name, sourcePrefix = '') {
  const band = inferBandFromName(name);
  let rows = [];
  const errors = [];

  if (window.XLSX) {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
        for (const row of matrixToObjects(matrix)) rows.push(enrichUkeRow(row, band, `${name} / ${sheetName}`));
      }
    } catch (err) {
      errors.push(`SheetJS: ${err.message}`);
      rows = [];
    }
  }

  if (!rows.length) {
    try {
      const sheets = await parseXlsxBufferMinimal(buffer, name);
      for (const sheet of sheets) {
        for (const row of matrixToObjects(sheet.matrix)) rows.push(enrichUkeRow(row, band, `${name} / ${sheet.name}`));
      }
    } catch (err) {
      errors.push(`parser wbudowany: ${err.message}`);
    }
  }

  if (!rows.length) {
    throw new Error(`Plik ${name} nie ma czytelnych arkuszy z danymi. ${errors.join(' / ')}`.trim());
  }

  try {
    const result = await workerRequest({ type: 'parseRows', rows, name: `${sourcePrefix}${name}` });
    return { stations: result.stations.map(station => enrichUkeStation(station, band, name)), sourceName: result.sourceName || name };
  } catch (err) {
    throw new Error(`${err.message} Plik: ${name}. Odczytano ${rows.length} wierszy, ale nie udało się rozpoznać współrzędnych/kolumn.`);
  }
}

async function importZipStationFile(file) {
  showStatusToast('Import ZIP', `Rozpakowuję ${file.name}…`, 'busy', { sticky: true, progress: 12 });
  const entries = await readZipEntriesFromBuffer(await file.arrayBuffer());
  const importable = entries
    .filter(entry => !entry.dir && /\.(xlsx|xls|csv|json|xml|html|htm)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if (!importable.length) throw new Error('ZIP nie zawiera plików JSON/CSV/XLSX/XML/HTML.');

  const allStations = [];
  const errors = [];
  for (let index = 0; index < importable.length; index++) {
    const entry = importable[index];
    const progress = Math.round(12 + ((index + 1) / importable.length) * 78);
    showStatusToast('Import ZIP', `Czytam ${index + 1}/${importable.length}: ${entry.name}`, 'busy', { sticky: true, progress });
    const lower = entry.name.toLowerCase();
    try {
      let parsed;
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        parsed = await parseSpreadsheetBuffer(await entry.arrayBuffer(), entry.name, 'ZIP ');
      } else if (lower.endsWith('.xml') || lower.endsWith('.html') || lower.endsWith('.htm')) {
        parsed = await parseXmlOrHtmlText(await entry.text(), entry.name);
      } else {
        const text = await entry.text();
        parsed = await workerRequest({ type: 'parseText', text, name: entry.name, contentType: lower.endsWith('.json') ? 'application/json' : 'text/csv' });
      }
      if (parsed && Array.isArray(parsed.stations)) allStations.push(...parsed.stations);
    } catch (err) {
      errors.push(`${entry.name}: ${err.message}`);
    }
  }
  const stations = dedupeStationsForImport(allStations);
  if (!stations.length) {
    throw new Error(`ZIP został odczytany, ale nie znaleziono stacji z poprawnymi współrzędnymi. ${errors.slice(0, 5).join(' / ')}`.trim());
  }
  if (errors.length) console.warn('Część plików ZIP pominięto:', errors);
  return { stations, sourceName: `${file.name} • ZIP` };
}


function dedupeStationsForImport(stations) {
  const out = [];
  const seen = new Set();
  for (const station of stations || []) {
    if (!station) continue;
    const key = `${normalizeText(station.operator)}|${normalizeText(station.station_id)}|${Number(station.latitude).toFixed(6)}|${Number(station.longitude).toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(station);
  }
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
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }
  if (bestScore < 2) headerIndex = 0;
  const headers = nonEmpty[headerIndex].map((header, index) => header || `kolumna_${index + 1}`);
  const objects = [];
  for (const values of nonEmpty.slice(headerIndex + 1)) {
    if (!values.some(Boolean)) continue;
    const object = {};
    headers.forEach((header, index) => {
      if (!header) return;
      object[header] = values[index] ?? '';
    });
    if (Object.values(object).some(value => String(value || '').trim())) objects.push(object);
  }
  return objects;
}

function scoreHeaderRow(row) {
  const joined = normalizeText((row || []).join(' '));
  let score = 0;
  const tokens = ['szerokosc', 'dlugosc', 'wspolrzed', 'miejscowosc', 'operator', 'uzytkownik', 'adres', 'stacja', 'pozwolen', 'azymut', 'moc', 'eirp', 'technologia', 'pasmo', 'system', 'standard', 'wojewodztwo', 'powiat', 'gmina'];
  for (const token of tokens) if (joined.includes(token)) score++;
  return score;
}

async function parseXmlOrHtmlStationFile(file) {
  return parseXmlOrHtmlText(await file.text(), file.name);
}

async function parseXmlOrHtmlText(text, name) {
  const rows = parseXmlOrHtmlRows(text);
  if (!rows.length) throw new Error(`Plik ${name} nie zawiera czytelnej tabeli.`);
  const result = await workerRequest({ type: 'parseRows', rows, name });
  return { stations: result.stations, sourceName: result.sourceName || name };
}

function parseXmlOrHtmlRows(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const parser = new DOMParser();
  let doc = parser.parseFromString(raw, raw.slice(0, 200).toLowerCase().includes('<html') ? 'text/html' : 'application/xml');
  if (doc.querySelector('parsererror')) doc = parser.parseFromString(raw, 'text/html');

  const table = doc.querySelector('table');
  if (table) {
    const matrix = Array.from(table.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(cell => cell.textContent.trim()));
    return matrixToObjects(matrix);
  }

  const excelRows = Array.from(doc.getElementsByTagName('Row'));
  if (excelRows.length) {
    const matrix = excelRows.map(row => {
      const values = [];
      for (const cell of Array.from(row.getElementsByTagName('Cell'))) {
        const indexAttr = cell.getAttribute('ss:Index') || cell.getAttribute('Index');
        if (indexAttr) {
          const wanted = Number(indexAttr) - 1;
          while (values.length < wanted) values.push('');
        }
        const data = cell.getElementsByTagName('Data')[0];
        values.push((data ? data.textContent : cell.textContent).trim());
      }
      return values;
    });
    return matrixToObjects(matrix);
  }

  const candidates = Array.from(doc.querySelectorAll('row, record, item, pozwolenie, stacja, station'));
  if (candidates.length) {
    const objects = [];
    for (const node of candidates) {
      const object = {};
      for (const child of Array.from(node.children)) object[child.tagName] = child.textContent.trim();
      if (Object.keys(object).length) objects.push(object);
    }
    return objects;
  }

  return [];
}

async function readZipEntriesFromBuffer(buffer) {
  if (window.JSZip) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      return Object.values(zip.files).map(entry => ({
        name: entry.name,
        dir: entry.dir,
        arrayBuffer: () => entry.async('arraybuffer'),
        text: () => entry.async('text')
      }));
    } catch (err) {
      console.warn('JSZip nie odczytał pliku, próbuję parserem wbudowanym:', err);
    }
  }
  return readZipEntriesMinimal(buffer);
}

async function readZipEntriesMinimal(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  const eocdOffset = findEndOfCentralDirectory(view);
  if (eocdOffset < 0) throw new Error('Nieprawidłowy plik ZIP albo brak biblioteki JSZip.');
  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const entries = [];

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLen));
    const dir = name.endsWith('/');
    entries.push({ name, dir, method, compressedSize, uncompressedSize, localOffset, _buffer: buffer });
    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries.map(entry => ({
    name: entry.name,
    dir: entry.dir,
    arrayBuffer: async () => extractZipEntryBuffer(entry),
    text: async () => new TextDecoder('utf-8').decode(await extractZipEntryBuffer(entry))
  }));
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 66000); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function extractZipEntryBuffer(entry) {
  const view = new DataView(entry._buffer);
  const bytes = new Uint8Array(entry._buffer);
  const local = entry.localOffset;
  if (view.getUint32(local, true) !== 0x04034b50) throw new Error(`Uszkodzony wpis ZIP: ${entry.name}`);
  const nameLen = view.getUint16(local + 26, true);
  const extraLen = view.getUint16(local + 28, true);
  const dataStart = local + 30 + nameLen + extraLen;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
  if (entry.method === 8) {
    if (!window.DecompressionStream) throw new Error(`ZIP wymaga rozpakowania Deflate, a przeglądarka go nie obsługuje: ${entry.name}`);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).arrayBuffer();
  }
  throw new Error(`Nieobsługiwana kompresja ZIP (${entry.method}) w pliku ${entry.name}`);
}

async function parseXlsxBufferMinimal(buffer, name) {
  const entries = await readZipEntriesFromBuffer(buffer);
  const map = new Map(entries.map(entry => [entry.name.replace(/^\//, ''), entry]));
  const getText = async path => {
    const entry = map.get(path) || map.get(path.replace(/^xl\//, ''));
    return entry ? entry.text() : '';
  };
  const workbookText = await getText('xl/workbook.xml');
  if (!workbookText) throw new Error('Brak xl/workbook.xml. To nie wygląda na XLSX.');
  const parser = new DOMParser();
  const workbook = parser.parseFromString(workbookText, 'application/xml');
  const relsText = await getText('xl/_rels/workbook.xml.rels');
  const relsDoc = parser.parseFromString(relsText || '<Relationships/>', 'application/xml');
  const rels = new Map(Array.from(relsDoc.getElementsByTagName('Relationship')).map(rel => [rel.getAttribute('Id'), rel.getAttribute('Target')]));
  const sharedStrings = await readXlsxSharedStrings(map, parser);
  const sheets = [];
  for (const sheet of Array.from(workbook.getElementsByTagName('sheet'))) {
    const sheetName = sheet.getAttribute('name') || 'Arkusz';
    const relId = sheet.getAttribute('r:id') || sheet.getAttribute('id');
    let target = rels.get(relId) || `worksheets/sheet${sheets.length + 1}.xml`;
    if (!target.startsWith('xl/')) target = `xl/${target.replace(/^\//, '')}`;
    const sheetEntry = map.get(target);
    if (!sheetEntry) continue;
    const matrix = parseXlsxSheet(await sheetEntry.text(), sharedStrings, parser);
    if (matrix.length) sheets.push({ name: sheetName, matrix });
  }
  if (!sheets.length) throw new Error(`Nie znalazłem arkuszy w ${name}.`);
  return sheets;
}

async function readXlsxSharedStrings(map, parser) {
  const entry = map.get('xl/sharedStrings.xml');
  if (!entry) return [];
  const doc = parser.parseFromString(await entry.text(), 'application/xml');
  return Array.from(doc.getElementsByTagName('si')).map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
}

function parseXlsxSheet(text, sharedStrings, parser) {
  const doc = parser.parseFromString(text, 'application/xml');
  const rows = [];
  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const values = [];
    for (const cell of Array.from(row.getElementsByTagName('c'))) {
      const ref = cell.getAttribute('r') || '';
      const col = xlsxColumnIndex(ref.replace(/\d+/g, ''));
      while (values.length < col) values.push('');
      values[col] = readXlsxCell(cell, sharedStrings);
    }
    rows.push(values);
  }
  return rows;
}

function readXlsxCell(cell, sharedStrings) {
  const type = cell.getAttribute('t') || '';
  if (type === 'inlineStr') return Array.from(cell.getElementsByTagName('t')).map(t => t.textContent).join('');
  const valueNode = cell.getElementsByTagName('v')[0];
  const raw = valueNode ? valueNode.textContent : '';
  if (type === 's') return sharedStrings[Number(raw)] || '';
  return raw;
}

function xlsxColumnIndex(col) {
  let index = 0;
  for (const ch of String(col || 'A').toUpperCase()) index = index * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

function normalizeColumnNameMain(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function numberFromCellMain(value) {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim().replace(',', '.');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function coordinateFromCellMain(value) {
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

function getAliasedMain(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeColumnNameMain(alias);
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '') return row[key];
  }
  return '';
}

function getFuzzyCoordinateMain(row, kind) {
  for (const [key, value] of Object.entries(row || {})) {
    const k = normalizeColumnNameMain(key);
    const isLat = kind === 'lat' && (k.includes('szerokosc') || k.includes('latitude') || k === 'lat' || k.endsWith('lat') || k === 'y');
    const isLon = kind === 'lon' && ((k.includes('dlugosc') && !k.includes('wysokosc')) || k.includes('longitude') || k === 'lon' || k === 'lng' || k.endsWith('lon') || k.endsWith('lng') || k === 'x');
    if (!isLat && !isLon) continue;
    const coord = coordinateFromCellMain(value);
    if (Number.isFinite(coord)) return coord;
  }
  return NaN;
}

function coordinatePairFromTextMain(value) {
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

function coordinatePairFromRowMain(row) {
  for (const value of Object.values(row || {})) {
    const pair = coordinatePairFromTextMain(value);
    if (pair) return pair;
  }
  return null;
}

function splitListCellMain(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text.split(/[;,|/]+|\s{2,}/).map(s => s.trim()).filter(Boolean);
}

function buildAddressMain(row) {
  const direct = getAliasedMain(row, ['address', 'adres', 'adresstacji', 'lokalizacja', 'lokalizacjastacji', 'location']);
  if (direct) return direct;
  const parts = [
    getAliasedMain(row, ['ulica', 'ul']),
    getAliasedMain(row, ['nr', 'numer', 'nrdomu', 'numernieruchomosci']),
    getAliasedMain(row, ['miejscowosc', 'miejscowość', 'miejscowoscstacji', 'miasto']),
    getAliasedMain(row, ['gmina']),
    getAliasedMain(row, ['powiat']),
    getAliasedMain(row, ['wojewodztwo'])
  ].map(v => String(v || '').trim()).filter(Boolean);
  return [...new Set(parts)].join(', ');
}

function normalizeImportedRowMain(rawRow) {
  const row = {};
  for (const [key, value] of Object.entries(rawRow || {})) row[normalizeColumnNameMain(key)] = value;
  const pair = coordinatePairFromRowMain(row);
  let lat = coordinateFromCellMain(getAliasedMain(row, ['latitude', 'lat', 'szerokosc', 'szerokoscgeograficzna', 'szerokoscgeograficznastacji', 'wgs84lat', 'latwgs84', 'y']));
  let lon = coordinateFromCellMain(getAliasedMain(row, ['longitude', 'lon', 'lng', 'dlugosc', 'dlugoscgeograficzna', 'dlugoscgeograficznastacji', 'wgs84lon', 'lonwgs84', 'lngwgs84', 'x']));
  if (!Number.isFinite(lat)) lat = getFuzzyCoordinateMain(row, 'lat');
  if (!Number.isFinite(lon)) lon = getFuzzyCoordinateMain(row, 'lon');
  if (!Number.isFinite(lat) && pair) lat = pair.lat;
  if (!Number.isFinite(lon) && pair) lon = pair.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = buildAddressMain(row);
  const bandsRaw = getAliasedMain(row, ['bands', 'pasma', 'pasmo', 'band', 'technologia', 'technology', 'system', 'standard', 'zakres', 'ukeband']);
  const azRaw = getAliasedMain(row, ['azimuths', 'azymuty', 'azymut', 'azimuth', 'azymutanteny', 'kierunek']);
  const powerRaw = getAliasedMain(row, ['power', 'power_w', 'moc', 'mocw', 'mocpromieniowana', 'eirp', 'eirp_dbm', 'eirpdbm', 'erp', 'max_eirp_dbm', 'maksymalnamoc']);
  return normalizeStationForMain({
    station_id: getAliasedMain(row, ['station_id', 'stationid', 'id', 'nrstacji', 'idstacji', 'identyfikatorstacji', 'nazwaobiektu', 'nazwastacji', 'pozwolenie', 'nrpozwolenia', 'numerpozwolenia', 'numerdecyzji', 'nrdecyzji', 'znaksprawy', 'btssid', 'siteid']) || '—',
    operator: getAliasedMain(row, ['operator', 'siec', 'sieć', 'network', 'mno', 'uzytkownik', 'uzytkownikpozwolenia', 'nazwauzytkownika', 'nazwaoperatora', 'nazwauzytkownika', 'podmiot', 'przedsiebiorca']) || 'Nieznany',
    latitude: lat,
    longitude: lon,
    address,
    city: getAliasedMain(row, ['city', 'miasto', 'miejscowosc', 'miejscowość', 'miejscowoscstacji', 'gmina']) || address.split(',')[0] || '',
    bands: cleanBands(mergeUnique(splitListCellMain(bandsRaw), extractBandsFromText([bandsRaw, address, Object.values(row).join(' ')].join(' ')))),
    azimuths: splitListCellMain(azRaw).map(numberFromCellMain).filter(Number.isFinite),
    sector_ids: splitListCellMain(getAliasedMain(row, ['sector_ids', 'sektory', 'sector', 'sektor', 'cellid', 'clid'])),
    cell_names: splitListCellMain(getAliasedMain(row, ['cell_names', 'komorki', 'komórki', 'cells', 'cellname'])),
    records_count: 1,
    range_km: numberFromCellMain(getAliasedMain(row, ['range_km', 'zasieg', 'zasiegkm', 'promien', 'promienkm'])),
    antenna_height_m: numberOrNull(getAliasedMain(row, ['antenna_height_m', 'height_m', 'wysokoscanteny', 'wysokosczawieszeniaanteny', 'wysokosc'])),
    tilt_deg: numberOrNull(getAliasedMain(row, ['tilt_deg', 'antenna_tilt_deg', 'pochylenieanteny', 'downtilt', 'tilt', 'pochylenie'])),
    power: powerRaw,
    source: getAliasedMain(row, ['source', 'zrodlo', 'źródło'])
  });
}

function parseImportedRowsMain(rows) {
  const stations = [];
  const seen = new Set();
  for (const rawRow of rows || []) {
    const station = normalizeImportedRowMain(rawRow);
    if (!station) continue;
    const key = `${station.operator}|${station.station_id}|${station.latitude}|${station.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    stations.push(station);
  }
  if (!stations.length) throw new Error('Nie znaleziono stacji z poprawnymi współrzędnymi. Sprawdź, czy plik ma kolumny szerokości/długości geograficznej albo współrzędne WGS84.');
  return stations;
}

function parseStationsPayloadMain(payload) {
  const source = Array.isArray(payload) ? payload : (payload.stations || payload.data || payload.items || []);
  if (!Array.isArray(source)) throw new Error('Plik JSON nie zawiera listy stacji.');
  const stations = dedupeStationsForImport(source.map(normalizeStationForMain).filter(Boolean));
  if (!stations.length) throw new Error('Nie znaleziono stacji z poprawnymi współrzędnymi.');
  return stations;
}

function parseTextPayloadMain(text, kind) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Pusty plik.');
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || kind === 'json') return parseStationsPayloadMain(JSON.parse(trimmed));
  if (trimmed.startsWith('<') || kind === 'xml' || kind === 'html') return parseImportedRowsMain(parseXmlOrHtmlRows(trimmed));
  return parseImportedRowsMain(parseCsvMain(text));
}

function parseCsvMain(text) {
  const sample = String(text || '').slice(0, 5000);
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
  const input = String(text || '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
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
  return matrixToObjects(rows);
}

function normalizeRemoteUrlMain(url) {
  let out = String(url || '').trim();
  if (!out) throw new Error('Podaj link do bazy.');
  if (out.includes('dropbox.com/') && out.includes('dl=0')) out = out.replace('dl=0', 'dl=1');
  if (out.includes('drive.google.com/file/d/')) {
    const match = out.match(/\/d\/([^/]+)/);
    if (match) out = `https://drive.google.com/uc?export=download&id=${match[1]}`;
  }
  return out;
}

function detectRemoteTypeMain(url, contentType) {
  const lower = String(url || '').toLowerCase();
  const ct = String(contentType || '').toLowerCase();
  if (lower.endsWith('.csv') || ct.includes('csv')) return 'csv';
  if (lower.endsWith('.xml') || ct.includes('xml')) return 'xml';
  if (lower.endsWith('.html') || lower.endsWith('.htm') || ct.includes('html')) return 'html';
  return 'json';
}


async function importParameterDataFile() {
  const file = el.paramFileInput?.files && el.paramFileInput.files[0];
  if (!file) return;
  try {
    await importParameterFile(file);
  } catch (err) {
    setStatus(`Błąd uzupełniania parametrów: ${err.message}`);
    showStatusToast('Import parametrów', `Błąd: ${err.message}`, 'error', { sticky: true });
  } finally {
    if (el.paramFileInput) el.paramFileInput.value = '';
  }
}

async function importParameterFile(file) {
  if (!file) return;
  setStatus(`Czytam parametry z ${file.name}…`);
  showStatusToast('Import parametrów', `Czytam ${file.name}…`, 'busy', { sticky: true, progress: 12 });
  const supplements = await parseParameterSupplementsFile(file);
  const changed = applyStationSupplementsBatch(supplements, file.name);
  if (!changed.count) {
    throw new Error('Nie znalazłem pasma, azymutu, mocy, EIRP, wysokości, pochylenia ani zasięgu możliwych do dopasowania do stacji.');
  }
  finalizeParameterImport();
  const message = `Uzupełniono ${changed.count} dopasowań z ${file.name}: ${changed.fields.join(', ')}. Odczytano rekordów parametrów: ${changed.records}.`;
  setStatus(message);
  showStatusToast('Import parametrów', message, 'success', { sticky: false, progress: 100 });
}

async function parseParameterSupplementsFile(file) {
  const lower = String(file.name || '').toLowerCase();
  if (lower.endsWith('.zip')) return importZipParameterFile(file);
  if (lower.endsWith('.pdf')) return [extractStationSupplementFromText(await readPdfText(file), file.name)];
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const rows = await parseSpreadsheetRowsFromBuffer(await file.arrayBuffer(), file.name);
    return rowsToSupplements(rows, file.name);
  }
  if (lower.endsWith('.xml') || lower.endsWith('.html') || lower.endsWith('.htm')) {
    const text = await file.text();
    const rows = parseXmlOrHtmlRows(text);
    return rows.length ? rowsToSupplements(rows, file.name) : [extractStationSupplementFromText(text, file.name)];
  }
  const text = await file.text();
  return parseParameterSupplementsFromText(text, file.name, lower);
}

async function parseParameterSupplementsFromUrl(url) {
  const normalized = normalizeRemoteUrlMain(url);
  const lower = normalized.toLowerCase();
  const response = await fetch(normalized, { cache: 'no-store', headers: { Accept: 'application/json,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (lower.endsWith('.pdf') || contentType.includes('pdf')) {
    const file = new File([await response.blob()], sourceNameFromUrlSafe(normalized), { type: 'application/pdf' });
    return parseParameterSupplementsFile(file);
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || contentType.includes('spreadsheet')) {
    const rows = await parseSpreadsheetRowsFromBuffer(await response.arrayBuffer(), sourceNameFromUrlSafe(normalized));
    return rowsToSupplements(rows, sourceNameFromUrlSafe(normalized));
  }
  if (lower.endsWith('.zip') || contentType.includes('zip')) {
    const file = new File([await response.blob()], sourceNameFromUrlSafe(normalized), { type: 'application/zip' });
    return parseParameterSupplementsFile(file);
  }
  return parseParameterSupplementsFromText(await response.text(), sourceNameFromUrlSafe(normalized), lower);
}

function parseParameterSupplementsFromText(text, sourceName, lowerName = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Pusty plik parametrów.');
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || lowerName.endsWith('.json')) {
    return jsonPayloadToSupplements(JSON.parse(trimmed), sourceName);
  }
  const rows = parseCsvMain(trimmed);
  const supplements = rowsToSupplements(rows, sourceName);
  if (supplements.length) return supplements;
  return [extractStationSupplementFromText(trimmed, sourceName)];
}

async function parseSpreadsheetRowsFromBuffer(buffer, name) {
  const rows = [];
  const errors = [];
  if (window.XLSX) {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
        rows.push(...matrixToObjects(matrix));
      }
    } catch (err) {
      errors.push(`SheetJS: ${err.message}`);
    }
  }
  if (!rows.length) {
    try {
      const sheets = await parseXlsxBufferMinimal(buffer, name);
      for (const sheet of sheets) rows.push(...matrixToObjects(sheet.matrix));
    } catch (err) {
      errors.push(`parser wbudowany: ${err.message}`);
    }
  }
  if (!rows.length) throw new Error(`Nie znalazłem czytelnej tabeli w ${name}. ${errors.join(' / ')}`.trim());
  return rows;
}

async function importZipParameterFile(file) {
  const entries = await readZipEntriesFromBuffer(await file.arrayBuffer());
  const importable = entries
    .filter(entry => !entry.dir && /\.(pdf|txt|csv|json|xlsx|xls|xml|html|htm)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  if (!importable.length) throw new Error('ZIP nie zawiera plików PDF/TXT/CSV/JSON/XLSX/XML/HTML z parametrami.');
  const supplements = [];
  const errors = [];
  for (let index = 0; index < importable.length; index++) {
    const entry = importable[index];
    const progress = Math.round(15 + ((index + 1) / importable.length) * 70);
    showStatusToast('Import parametrów ZIP', `Czytam ${index + 1}/${importable.length}: ${entry.name}`, 'busy', { sticky: true, progress });
    try {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        supplements.push(...rowsToSupplements(await parseSpreadsheetRowsFromBuffer(await entry.arrayBuffer(), entry.name), entry.name));
      } else if (lower.endsWith('.pdf')) {
        const fileLike = new File([await entry.arrayBuffer()], entry.name, { type: 'application/pdf' });
        supplements.push(extractStationSupplementFromText(await readPdfText(fileLike), entry.name));
      } else if (lower.endsWith('.xml') || lower.endsWith('.html') || lower.endsWith('.htm')) {
        const text = await entry.text();
        const rows = parseXmlOrHtmlRows(text);
        supplements.push(...(rows.length ? rowsToSupplements(rows, entry.name) : [extractStationSupplementFromText(text, entry.name)]));
      } else {
        supplements.push(...parseParameterSupplementsFromText(await entry.text(), entry.name, lower));
      }
    } catch (err) {
      errors.push(`${entry.name}: ${err.message}`);
    }
  }
  if (!supplements.length) throw new Error(`Nie odczytano żadnych parametrów z ZIP. ${errors.slice(0, 4).join(' / ')}`.trim());
  if (errors.length) console.warn('Część plików parametrów pominięto:', errors);
  return supplements;
}

function jsonPayloadToSupplements(payload, sourceName) {
  const source = Array.isArray(payload) ? payload : (payload.supplements || payload.parameters || payload.stations || payload.data || payload.items || []);
  if (!Array.isArray(source)) throw new Error('JSON z parametrami musi zawierać tablicę albo pole supplements/parameters/stations/data/items.');
  return rowsToSupplements(source, sourceName);
}

function rowsToSupplements(rows, sourceName) {
  return (rows || [])
    .map(row => normalizeParameterRowToSupplement(row, sourceName))
    .filter(isUsefulSupplement);
}

function normalizeParameterRowToSupplement(rawRow, sourceName) {
  const row = {};
  for (const [key, value] of Object.entries(rawRow || {})) row[normalizeColumnNameMain(key)] = value;
  const allText = Object.values(rawRow || {}).join(' ');
  const pair = coordinatePairFromRowMain(row);
  let lat = coordinateFromCellMain(getAliasedMain(row, ['latitude', 'lat', 'szerokosc', 'szerokoscgeograficzna', 'wgs84lat', 'y']));
  let lon = coordinateFromCellMain(getAliasedMain(row, ['longitude', 'lon', 'lng', 'dlugosc', 'dlugoscgeograficzna', 'wgs84lon', 'x']));
  if (!Number.isFinite(lat) && pair) lat = pair.lat;
  if (!Number.isFinite(lon) && pair) lon = pair.lon;
  const address = buildAddressMain(row);
  const bandsRaw = getAliasedMain(row, ['bands', 'pasma', 'pasmo', 'band', 'technologia', 'technology', 'system', 'standard', 'zakres', 'czestotliwosc', 'częstotliwość']);
  const azRaw = getAliasedMain(row, ['azimuths', 'azymuty', 'azymut', 'azimuth', 'azymutanteny', 'kierunek', 'kierunekanteny', 'azymutstopnie', 'azymutdeg']);
  const powerRaw = getAliasedMain(row, ['power', 'powerw', 'power_w', 'moc', 'mocw', 'mocpromieniowana', 'eirp', 'eirpw', 'eirp_dbm', 'eirpdbm', 'erp', 'maxeirp', 'max_eirp_dbm', 'maksymalnamoc', 'rownowaznamocpromieniowanaizotropowo']);
  const heightRaw = getAliasedMain(row, ['antenna_height_m', 'height_m', 'wysokoscanteny', 'wysokoscantenym', 'wysokosczawieszenia', 'wysokosczawieszeniaanteny', 'wysokosc', 'wysokoscm']);
  const tiltRaw = getAliasedMain(row, ['tilt_deg', 'antenna_tilt_deg', 'pochylenieanteny', 'tilt', 'downtilt', 'katpochylenia', 'pochylenie']);
  const rangeRaw = getAliasedMain(row, ['range_km', 'zasieg', 'zasiegkm', 'promien', 'promienkm']);
  const source = getAliasedMain(row, ['source', 'zrodlo', 'źródło']) || sourceName || 'parametry';
  const power = normalizePowerFromAny(powerRaw, allText);
  const azimuths = mergeNumericLists(splitListCellMain(azRaw).map(numberFromCellMain), extractAzimuthsFromText(allText));
  const stationId = getAliasedMain(row, ['station_id', 'stationid', 'id', 'nrstacji', 'idstacji', 'identyfikatorstacji', 'nazwaobiektu', 'nazwastacji', 'pozwolenie', 'nrpozwolenia', 'numerpozwolenia', 'numerdecyzji', 'nrdecyzji', 'znaksprawy', 'btssid', 'siteid']) || extractStationIdFromText(allText);
  const operator = getAliasedMain(row, ['operator', 'siec', 'sieć', 'network', 'mno', 'uzytkownik', 'uzytkownikpozwolenia', 'nazwauzytkownika', 'nazwaoperatora', 'podmiot', 'przedsiebiorca']) || extractOperatorFromText(allText);
  return {
    station_id: stationId,
    operator,
    city: getAliasedMain(row, ['city', 'miasto', 'miejscowosc', 'miejscowość', 'gmina']) || extractLikelyCityFromText(allText),
    address,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lon) ? lon : null,
    bands: cleanBands(mergeUnique(splitListCellMain(bandsRaw), extractBandsFromText(allText))),
    azimuths,
    range_km: numberOrNull(rangeRaw),
    power: power?.text || '',
    eirp_dbm: power?.unit === 'dBm' ? power.text : '',
    antenna_height_m: numberOrNull(heightRaw) ?? extractHeightFromText(allText),
    tilt_deg: numberOrNull(tiltRaw) ?? extractTiltFromText(allText),
    source: `Parametry ${source}`.trim(),
    param_sources: [source]
  };
}

function mergeNumericLists(a, b) {
  return [...new Set([...(a || []), ...(b || [])]
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0 && value < 360)
    .map(value => Math.round(value)))]
    .sort((x, y) => x - y);
}

function normalizePowerFromAny(value, fallbackText = '') {
  const direct = extractPowerFromText(String(value || ''));
  if (direct) return direct;
  const parsed = normalizePowerValue(value);
  if (parsed && Number.isFinite(parsed.value)) return { ...parsed, text: formatPowerInfo(parsed) };
  return extractPowerFromText(fallbackText);
}

function isUsefulSupplement(supplement) {
  if (!supplement) return false;
  return !!(
    supplement.bands?.length ||
    supplement.azimuths?.length ||
    supplement.power ||
    supplement.eirp_dbm ||
    Number.isFinite(supplement.range_km) ||
    Number.isFinite(supplement.antenna_height_m) ||
    Number.isFinite(supplement.tilt_deg)
  );
}

function applyStationSupplementsBatch(supplements, sourceName, options = {}) {
  const fields = new Set();
  let count = 0;
  const records = Array.isArray(supplements) ? supplements.length : 0;
  for (const supplement of supplements || []) {
    if (!isUsefulSupplement(supplement)) continue;
    const changed = applyStationSupplement(supplement, sourceName, options);
    if (!changed.count) continue;
    count += changed.count;
    for (const field of changed.fields) fields.add(field);
  }
  return { count, records, fields: fields.size ? Array.from(fields) : ['dopasowanie tekstowe'] };
}

function finalizeParameterImport() {
  annotateSharedOperatorInfo(state.stations);
  buildSpatialIndex(state.stations);
  buildFilterOptions();
  fillSelect(el.operatorSelect, state.operators, state.operator);
  fillSelect(el.bandSelect, state.bands, state.band);
  saveActiveDataset(state.stations, state.dataSourceName || 'baza lokalna');
  if (state.selected) {
    renderSelectedStationExtras(state.selected);
    showStationDetails(state.selected);
    refreshStationPopupContent(state.selected);
  }
  scheduleRender();
}

async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  try {
    const loadedPdfJs = await import(PDFJS_MODULE_URL);
    if (loadedPdfJs.GlobalWorkerOptions) loadedPdfJs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    window.pdfjsLib = loadedPdfJs;
    return loadedPdfJs;
  } catch (err) {
    throw new Error(`${PDF_CDN_NOTE} ${err.message || err}`);
  }
}

async function readPdfText(file) {
  const pdfjs = await ensurePdfJs();
  if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const buffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data: typedArray,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const chunks = [];
  const pageLimit = Math.min(pdf.numPages, 80);
  for (let pageNo = 1; pageNo <= pageLimit; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    chunks.push(content.items.map(item => item.str || '').join(' '));
  }
  return chunks.join('\n');
}

function extractStationSupplementFromText(text, sourceName) {
  const raw = String(text || '');
  const bands = cleanBands(extractBandsFromText(raw));
  const azimuths = extractAzimuthsFromText(raw);
  const power = extractPowerFromText(raw);
  const rangeKm = extractRangeFromText(raw);
  const coords = extractCoordinatesFromText(raw);
  const stationId = extractStationIdFromText(raw);
  const operator = extractOperatorFromText(raw);
  const city = extractLikelyCityFromText(raw);
  const address = extractLikelyAddressFromText(raw);
  return {
    station_id: stationId,
    operator,
    city,
    address,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    bands,
    azimuths,
    range_km: rangeKm,
    antenna_height_m: extractHeightFromText(raw),
    tilt_deg: extractTiltFromText(raw),
    power: power?.text || '',
    eirp_dbm: power?.unit === 'dBm' ? power.text : '',
    source: `PDF/TXT ${sourceName || ''}`.trim(),
    param_sources: [sourceName || 'PDF/TXT']
  };
}

function applyStationSupplement(supplement, sourceName, options = {}) {
  const targets = findSupplementTargets(supplement);
  const fields = [];
  if (supplement.bands?.length) fields.push('pasma');
  if (supplement.azimuths?.length) fields.push('azymuty');
  if (supplement.power) fields.push('moc/EIRP');
  if (Number.isFinite(supplement.range_km) && supplement.range_km > 0) fields.push('zasięg');
  if (Number.isFinite(supplement.antenna_height_m)) fields.push('wysokość anteny');
  if (Number.isFinite(supplement.tilt_deg)) fields.push('pochylenie anteny');
  if (Number.isFinite(supplement.latitude) && Number.isFinite(supplement.longitude)) fields.push('współrzędne');

  if (!targets.length) {
    if (!options.strict && state.selected) targets.push(state.selected);
    else if (Number.isFinite(supplement.latitude) && Number.isFinite(supplement.longitude)) {
      const newStation = normalizeStationForMain({
        station_id: supplement.station_id || 'PDF/TXT',
        operator: supplement.operator || 'Nieznany',
        latitude: supplement.latitude,
        longitude: supplement.longitude,
        city: supplement.city || '',
        address: supplement.address || supplement.city || '',
        bands: supplement.bands,
        azimuths: supplement.azimuths,
        power: supplement.power,
        eirp_dbm: supplement.eirp_dbm,
        range_km: supplement.range_km,
        antenna_height_m: supplement.antenna_height_m,
        tilt_deg: supplement.tilt_deg,
        source: supplement.source,
        param_sources: supplement.param_sources,
        records_count: 1
      });
      if (newStation) {
        state.stations.push(newStation);
        targets.push(newStation);
      }
    }
  }

  for (const station of targets) mergeSupplementIntoStation(station, supplement, sourceName);
  return { count: targets.length, fields: fields.length ? fields : ['dopasowanie tekstowe'] };
}

function findSupplementTargets(supplement) {
  if (!state.stations.length) return [];
  const scored = state.stations.map(station => ({ station, score: scoreSupplementMatch(station, supplement) }))
    .filter(item => item.score >= 70)
    .sort((a, b) => b.score - a.score);
  if (scored.length) return [scored[0].station];
  if (state.selected) {
    const selectedScore = scoreSupplementMatch(state.selected, supplement);
    if (selectedScore >= 25 || (!supplement.station_id && !Number.isFinite(supplement.latitude))) return [state.selected];
  }
  return [];
}

function scoreSupplementMatch(station, supplement) {
  let score = 0;
  const stId = normalizeText(station.station_id);
  const supId = normalizeText(supplement.station_id);
  const stOp = normalizeText(station.operator);
  const supOp = normalizeText(supplement.operator);
  const stCity = normalizeText(station.city || station.address);
  const supCity = normalizeText(supplement.city);
  const stAddress = normalizeText(station.address || station.city);
  const supAddress = normalizeText(supplement.address || supplement.city);
  if (stId && supId && stId === supId) score += 130;
  else if (stId && supId && (stId.includes(supId) || supId.includes(stId))) score += 70;
  if (stOp && supOp && (stOp.includes(supOp) || supOp.includes(stOp))) score += 30;
  if (stCity && supCity && (stCity.includes(supCity) || supCity.includes(stCity))) score += 25;
  if (stAddress && supAddress && (stAddress.includes(supAddress) || supAddress.includes(stAddress))) score += 45;
  else if (stAddress && supAddress) {
    const overlap = searchTokens(stAddress).filter(token => token.length > 2 && supAddress.includes(token)).length;
    if (overlap >= 2) score += 25;
  }
  if (Number.isFinite(supplement.latitude) && Number.isFinite(supplement.longitude)) {
    const distance = haversineKm(station.latitude, station.longitude, supplement.latitude, supplement.longitude);
    if (distance < 0.08) score += 120;
    else if (distance < 0.3) score += 80;
    else if (distance < 1.2) score += 40;
  }
  return score;
}

function mergeSupplementIntoStation(station, supplement, sourceName) {
  station.bands = cleanBands(mergeUnique(station.bands, supplement.bands));
  station.azimuths = mergeUnique(station.azimuths, supplement.azimuths).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!station.power && supplement.power) station.power = supplement.power;
  if (!station.eirp_dbm && supplement.eirp_dbm) station.eirp_dbm = supplement.eirp_dbm;
  if (!station.range_km && Number.isFinite(supplement.range_km) && supplement.range_km > 0) station.range_km = supplement.range_km;
  if (!Number.isFinite(station.antenna_height_m) && Number.isFinite(supplement.antenna_height_m)) station.antenna_height_m = supplement.antenna_height_m;
  if (!Number.isFinite(station.tilt_deg) && Number.isFinite(supplement.tilt_deg)) station.tilt_deg = supplement.tilt_deg;
  station.param_sources = mergeUnique(station.param_sources, [sourceName || 'PDF/TXT']);
  station.source = mergeSourceNames(station.source, supplement.source);
  station._search = normalizeText([
    station.station_id,
    station.operator,
    station.city,
    station.address,
    station.bands.join(' '),
    station.source
  ].join(' • '));
}

function nrBandToLabel(n) {
  const key = String(n || '').replace(/^n/i, '');
  return VALID_NR_BANDS.has(`NR${key}`) ? `NR${key}` : '';
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

function extractAzimuthsFromText(text) {
  const raw = String(text || '');
  const values = [];
  const addNumbers = chunk => {
    const nums = String(chunk || '').match(/\b\d{1,3}(?:[,.]\d+)?\b/g) || [];
    for (const num of nums) {
      const value = Number(num.replace(',', '.'));
      const rounded = Math.round(value);
      if (Number.isFinite(value) && value >= 0 && value < 360 && !values.includes(rounded)) values.push(rounded);
    }
  };
  let match;
  const labelled = /(?:azymut(?:y)?|azimuth|kierunek\s+(?:anteny|sektora)|bearing|k[aą]t\s+azymutu)[^\d]{0,55}((?:\d{1,3}(?:[,.]\d+)?\s*(?:°|deg|stopni)?\s*[,;\/ ]*){1,12})/gi;
  while ((match = labelled.exec(raw))) addNumbers(match[1]);
  const lines = raw.split(/\r?\n/).filter(line => /azymut|azimuth|kierunek/i.test(line));
  for (const line of lines) addNumbers(line);
  return values.slice(0, 18).sort((a, b) => a - b);
}

function extractPowerFromText(text) {
  const raw = String(text || '');
  const patterns = [
    /(?:EIRP|ERP|moc\s+promieniowana|moc\s+nadawania|maksymalna\s+moc|moc|r[oó]wnowa[zż]na\s+moc\s+promieniowana\s+izotropowo)[^\d-]{0,70}(-?\d+(?:[,.]\d+)?)\s*(dBm|dBW|kW|W)\b/i,
    /(-?\d+(?:[,.]\d+)?)\s*(dBm|dBW|kW|W)\b[^\n]{0,45}(?:EIRP|ERP|moc)/i,
    /(?:EIRP|ERP|moc\s+EIRP|moc\s+promieniowana)[^\n]{0,35}\[(dBm|dBW|kW|W)\][^\d-]{0,40}(-?\d+(?:[,.]\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const unitFirst = /\[(dBm|dBW|kW|W)\]/i.test(match[0]);
    const value = Number((unitFirst ? match[2] : match[1]).replace(',', '.'));
    const unit = unitFirst ? match[1] : match[2];
    if (Number.isFinite(value)) return { value, unit, text: `${String(value).replace('.', ',')} ${unit}` };
  }
  const implicitW = raw.match(/(?:EIRP|ERP|moc\s+EIRP|moc\s+promieniowana|r[oó]wnowa[zż]na\s+moc\s+promieniowana\s+izotropowo)[^\n]{0,80}(-?\d+(?:[,.]\d+)?)/i);
  if (implicitW) {
    const value = Number(implicitW[1].replace(',', '.'));
    if (Number.isFinite(value) && value > 0) return { value, unit: 'W', text: `${String(value).replace('.', ',')} W` };
  }
  return null;
}

function extractHeightFromText(text) {
  const raw = String(text || '');
  const patterns = [
    /(?:wysoko[sś][cć]\s+(?:zawieszenia\s+)?anteny|wysoko[sś][cć]\s+anteny|anteny\s+na\s+wysoko[sś]ci|height)[^\d]{0,50}(\d+(?:[,.]\d+)?)\s*m\b/i,
    /(?:anteny|sektor)[^\n]{0,50}\[(?:m|metr)\][^\d]{0,30}(\d+(?:[,.]\d+)?)/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const value = match ? Number(match[1].replace(',', '.')) : NaN;
    if (Number.isFinite(value) && value > 0 && value < 400) return value;
  }
  return null;
}

function extractTiltFromText(text) {
  const raw = String(text || '');
  const patterns = [
    /(?:pochylenie\s+anteny|k[aą]t\s+pochylenia|downtilt|tilt)[^\d-]{0,45}(-?\d+(?:[,.]\d+)?)\s*(?:°|deg|stopni)?/i,
    /(?:mechaniczne|elektryczne)[^\n]{0,30}(-?\d+(?:[,.]\d+)?)\s*(?:°|deg|stopni)/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const value = match ? Number(match[1].replace(',', '.')) : NaN;
    if (Number.isFinite(value) && value >= -20 && value <= 30) return value;
  }
  return null;
}

function extractRangeFromText(text) {
  const raw = String(text || '');
  const match = raw.match(/(?:zasi[eę]g|promie[nń]|range)[^\d]{0,35}(\d+(?:[,.]\d+)?)\s*km/i);
  if (!match) return null;
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value < 200 ? value : null;
}

function extractCoordinatesFromText(text) {
  const raw = String(text || '').replace(/,/g, '.');
  const labelled = raw.match(/(?:GPS|WGS\s*84|wsp[oó][lł]rz[eę]dne|szeroko[sś][cć]|lat)[^\d-]{0,40}(5[0-4]\.\d{3,})[^\d-]{1,20}((?:1[4-9]|2[0-4])\.\d{3,})/i);
  if (labelled) return { lat: Number(labelled[1]), lng: Number(labelled[2]) };
  const plain = raw.match(/\b(5[0-4]\.\d{4,})\s*[,; ]\s*((?:1[4-9]|2[0-4])\.\d{4,})\b/);
  if (plain) return { lat: Number(plain[1]), lng: Number(plain[2]) };
  return null;
}

function extractLikelyAddressFromText(text) {
  const raw = String(text || '');
  const match = raw.match(/(?:adres|lokalizacja|miejsce\s+instalacji)\s*[:,-]?\s*([^\n]{5,120})/i);
  return match ? match[1].trim().replace(/\s{2,}/g, ' ') : '';
}

function extractStationIdFromText(text) {
  const raw = String(text || '');
  const patterns = [
    /\b(?:ID\s*stacji|station\s*id|site\s*id|CLID|eNB|NodeB|BTS\s*ID)\s*[:#-]?\s*([A-Z0-9][A-Z0-9_\/-]{2,20})\b/i,
    /\b([A-Z]{2,5}\d{3,5})\b/
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return match[1];
  }
  return '';
}

function extractOperatorFromText(text) {
  const normalized = normalizeText(text);
  const candidates = ['Orange', 'T-Mobile', 'Play', 'Plus', 'Aero2', 'Netia', 'Cyfrowy Polsat'];
  return candidates.find(op => normalized.includes(normalizeText(op))) || '';
}

function extractLikelyCityFromText(text) {
  const match = String(text || '').match(/(?:miejscowo[sś][cć]|miasto|lokalizacja)\s*[:,-]?\s*([A-ZĄĆĘŁŃÓŚŹŻ][\p{L} .-]{2,40})/u);
  return match ? match[1].trim() : '';
}


function normalizeSi2pemBackendUrl(url) {
  const text = String(url || '').trim().replace(/\/+$/, '');
  if (!text) return '';
  try {
    const parsed = new URL(text, location.href);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Nieprawidłowy protokół.');
    return parsed.href.replace(/\/+$/, '');
  } catch (_) {
    return '';
  }
}

function getSi2pemBackendBaseUrl() {
  const input = normalizeSi2pemBackendUrl(el.si2pemBackendUrlInput?.value || state.si2pemBackendUrl);
  if (input) return input;
  throw new Error('Najpierw wpisz adres własnego backendu SI2PEM, np. https://twoj-serwer.pl');
}

function saveSi2pemBackendUrl() {
  const url = normalizeSi2pemBackendUrl(el.si2pemBackendUrlInput?.value || '');
  if (!url) {
    showStatusToast('Backend SI2PEM', 'Podaj poprawny adres backendu HTTP/HTTPS. Token SI2PEM ma być zapisany na backendzie, nie w aplikacji PWA.', 'error', { sticky: true });
    return;
  }
  state.si2pemBackendUrl = url;
  if (el.si2pemBackendUrlInput) el.si2pemBackendUrlInput.value = url;
  saveSettings();
  showStatusToast('Backend SI2PEM', `Zapisano backend: ${url}`, 'success', { sticky: false });
}

function stationToSi2pemLookup(station) {
  return {
    station_id: station.station_id || '',
    operator: station.operator || '',
    city: station.city || '',
    address: station.address || '',
    latitude: Number.isFinite(station.latitude) ? station.latitude : null,
    longitude: Number.isFinite(station.longitude) ? station.longitude : null,
    bands: Array.isArray(station.bands) ? station.bands : [],
    azimuths: Array.isArray(station.azimuths) ? station.azimuths : [],
    power: station.power || station.eirp_dbm || '',
    antenna_height_m: station.antenna_height_m ?? null,
    tilt_deg: station.tilt_deg ?? null
  };
}

function getVisibleStationsForBackend() {
  const visible = Array.isArray(state.currentList) && state.currentList.length ? state.currentList : state.stations;
  return visible
    .filter(station => Number.isFinite(station.latitude) && Number.isFinite(station.longitude))
    .slice(0, SI2PEM_BACKEND_BATCH_LIMIT);
}

async function requestSi2pemBackendSupplements(stations, mode) {
  if (!Array.isArray(stations) || !stations.length) throw new Error('Brak stacji do uzupełnienia.');
  const baseUrl = getSi2pemBackendBaseUrl();
  const endpoint = `${baseUrl}${SI2PEM_BACKEND_ENDPOINT}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      app: 'myBTS Web Pro',
      version: APP_VERSION,
      mode,
      requested_at: new Date().toISOString(),
      stations: stations.map(stationToSi2pemLookup)
    })
  });
  if (!response.ok) {
    let detail = '';
    try { detail = (await response.json()).detail || ''; } catch (_) {}
    throw new Error(`Backend SI2PEM zwrócił HTTP ${response.status}${detail ? ': ' + detail : ''}`);
  }
  const payload = await response.json();
  const raw = Array.isArray(payload) ? payload : (payload.supplements || payload.parameters || payload.stations || payload.data || payload.items || []);
  if (!Array.isArray(raw) || !raw.length) throw new Error('Backend nie zwrócił żadnych parametrów do dopisania.');
  return rowsToSupplements(raw, `SI2PEM backend ${baseUrl}`);
}

async function autoEnrichStationsFromSi2pem(stations, modeLabel) {
  if (state.si2pemBackendRunning) {
    showStatusToast('Backend SI2PEM', 'Uzupełnianie już trwa. Poczekaj na zakończenie.', 'busy', { sticky: true });
    return;
  }
  state.si2pemBackendRunning = true;
  try {
    showStatusToast('Backend SI2PEM', `Szukam parametrów dla ${stations.length} stacji…`, 'busy', { sticky: true, progress: 15 });
    const supplements = await requestSi2pemBackendSupplements(stations, modeLabel);
    const changed = applyStationSupplementsBatch(supplements, 'SI2PEM backend', { strict: true });
    if (!changed.count) throw new Error('Backend zwrócił dane, ale nie udało się ich jednoznacznie dopasować do stacji.');
    finalizeParameterImport();
    const message = `Uzupełniono ${changed.count} dopasowań: ${changed.fields.join(', ')}.`;
    setStatus(message);
    showStatusToast('Backend SI2PEM', message, 'success', { sticky: false, progress: 100 });
  } catch (err) {
    const message = `Nie udało się uzupełnić z backendu SI2PEM: ${err.message}`;
    setStatus(message);
    showStatusToast('Backend SI2PEM', message, 'error', { sticky: true });
  } finally {
    state.si2pemBackendRunning = false;
  }
}

async function autoEnrichSelectedFromSi2pem() {
  if (!state.selected) {
    showStatusToast('Backend SI2PEM', 'Najpierw wybierz stację BTS na mapie albo na liście.', 'error', { sticky: true });
    return;
  }
  await autoEnrichStationsFromSi2pem([state.selected], 'selected');
}

async function autoEnrichVisibleFromSi2pem() {
  const stations = getVisibleStationsForBackend();
  if (!stations.length) {
    showStatusToast('Backend SI2PEM', 'Brak widocznych stacji do uzupełnienia.', 'error', { sticky: true });
    return;
  }
  await autoEnrichStationsFromSi2pem(stations, 'visible');
}

async function loadRemoteInput() {
  try {
    const url = el.remoteUrlInput.value.trim();
    await loadStationsFromUrl(url, { forceNetwork: true, save: true, fit: true });
  } catch (err) {
    setStatus(`Błąd pobierania z linku: ${err.message}`);
  }
}

async function loadParameterRemoteInput() {
  try {
    const url = el.remoteUrlInput.value.trim();
    if (!url) throw new Error('Podaj link do JSON/CSV/XLSX/PDF z parametrami.');
    setStatus('Pobieram parametry z linku…');
    showStatusToast('Parametry z linku', 'Pobieram dane techniczne z podanego linku…', 'busy', { sticky: true, progress: 10 });
    const supplements = await parseParameterSupplementsFromUrl(url);
    const changed = applyStationSupplementsBatch(supplements, sourceNameFromUrlSafe(url));
    if (!changed.count) throw new Error('Pobrano dane, ale nie udało się dopasować parametrów do stacji.');
    finalizeParameterImport();
    const message = `Uzupełniono ${changed.count} dopasowań z linku: ${changed.fields.join(', ')}.`;
    setStatus(message);
    showStatusToast('Parametry z linku', message, 'success', { sticky: false, progress: 100 });
  } catch (err) {
    const message = `Błąd pobierania parametrów z linku: ${err.message}`;
    setStatus(message);
    showStatusToast('Parametry z linku', message, 'error', { sticky: true });
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
    void runSearch({ center: true, showPanel: false });
    el.searchInput.blur();
  });
  el.searchInput.addEventListener('input', () => {
    updateSearchControls();
    state.search = normalizeText(el.searchInput.value);
    clearTimeout(state.searchTimer);
    if (state.search.length < SEARCH_MIN_CHARS) {
      scheduleRender();
      return;
    }
    state.searchTimer = setTimeout(() => { void runSearch({ center: false, showPanel: false }); }, 280);
  });
  el.searchInput.addEventListener('focus', () => {
    if (isMobileLayout()) setPanelMode('collapsed', false);
  });
  el.clearSearchBtn.addEventListener('click', () => {
    clearTimeout(state.searchTimer);
    el.searchInput.value = '';
    updateSearchControls();
    state.search = '';
    setStatus(state.stations.length ? `Wczytano ${compactNumber(state.stations.length)} stacji.` : 'Wyszukiwanie wyczyszczone.');
    scheduleRender();
  });
  el.operatorSelect.addEventListener('change', () => { state.operator = el.operatorSelect.value; scheduleRender(); });
  el.bandSelect.addEventListener('change', () => { state.band = el.bandSelect.value; scheduleRender(); });
  el.radiusSelect.addEventListener('change', () => { state.radiusKm = el.radiusSelect.value ? Number(el.radiusSelect.value) : null; scheduleRender(); });
  el.themeBtn.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveSettings(); });
  el.closeDetailBtn.addEventListener('click', hideDetails);
  if (el.si2pemBackendUrlInput) el.si2pemBackendUrlInput.value = state.si2pemBackendUrl || '';
  el.refreshBtn.addEventListener('click', () => loadStationsFromUrl('stations.json', { forceNetwork: true, save: true }).catch(showLoadError));
  if (el.ukeUpdateBtn) {
    el.ukeUpdateBtn.addEventListener('click', updateFromUkeOnline);
    if (!UKE_ONLINE_IMPORT_ENABLED) {
      el.ukeUpdateBtn.textContent = 'UKE online wyłączone';
      el.ukeUpdateBtn.title = 'Użyj importu ręcznego ZIP/XLSX/CSV z UKE.';
    }
  }
  if (el.openUkePageBtn) el.openUkePageBtn.addEventListener('click', openUkePage);
  if (el.openSi2pemBtn) el.openSi2pemBtn.addEventListener('click', openSi2pemPage);
  if (el.saveSi2pemBackendBtn) el.saveSi2pemBackendBtn.addEventListener('click', saveSi2pemBackendUrl);
  if (el.autoEnrichSelectedBtn) el.autoEnrichSelectedBtn.addEventListener('click', autoEnrichSelectedFromSi2pem);
  if (el.autoEnrichVisibleBtn) el.autoEnrichVisibleBtn.addEventListener('click', autoEnrichVisibleFromSi2pem);
  if (el.openTechSourcesBtn) el.openTechSourcesBtn.addEventListener('click', openTechnicalSources);
  if (el.downloadParamTemplateBtn) el.downloadParamTemplateBtn.addEventListener('click', downloadParameterTemplate);
  if (el.statusToastClose) el.statusToastClose.addEventListener('click', hideStatusToast);
  if (el.map) {
    el.map.addEventListener('click', event => {
      const action = event.target?.closest?.('[data-action]')?.dataset?.action;
      if (action === 'enrich-selected-si2pem') {
        event.preventDefault();
        event.stopPropagation();
        void autoEnrichSelectedFromSi2pem();
      }
      if (action === 'enrich-selected-uke') {
        event.preventDefault();
        event.stopPropagation();
        void updateSelectedFromUkeOnline();
      }
      if (action === 'import-selected-pdf') {
        event.preventDefault();
        event.stopPropagation();
        if (el.paramFileInput) el.paramFileInput.click();
      }
    });
  }
  el.importFileBtn.addEventListener('click', () => el.dataFileInput.click());
  el.dataFileInput.addEventListener('change', importDataFile);
  if (el.importParamFileBtn) el.importParamFileBtn.addEventListener('click', () => el.paramFileInput.click());
  if (el.paramFileInput) el.paramFileInput.addEventListener('change', importParameterDataFile);
  el.loadUrlBtn.addEventListener('click', loadRemoteInput);
  if (el.loadParamUrlBtn) el.loadParamUrlBtn.addEventListener('click', loadParameterRemoteInput);
  el.clearCacheBtn.addEventListener('click', clearActiveDataset);
  el.locateBtn.addEventListener('click', locateUser);
  el.compassWidget.addEventListener('click', () => startCompassTracking(true));
  el.clearPointBtn.addEventListener('click', clearMeasurePoint);
  el.setPointBtn.addEventListener('click', toggleSetPointMode);
  el.mapPlanBtn.addEventListener('click', () => setMapType('plan'));
  el.mapSatBtn.addEventListener('click', () => setMapType('sat'));
  el.nearestBtn.addEventListener('click', showNearest);
  el.installBtn.addEventListener('click', installPwa);
  if (el.menuBtn) el.menuBtn.addEventListener('click', () => { setTab('settings'); setPanelMode(isMobileLayout() ? 'full' : 'half'); });
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


function warnIfFileProtocol() {
  if (location.protocol !== 'file:') return;
  const message = 'Aplikacja jest otwarta jako plik file://. Na komputerze import, Worker, IndexedDB, UKE i PDF mogą wtedy nie działać poprawnie. Uruchom run_local.bat albo: python -m http.server 8000.';
  setStatus(message);
  showStatusToast('Uruchom przez serwer lokalny', message, 'error', { sticky: true });
}

function showLoadError(err) {
  console.error(err);
  setStatus(`Nie udało się wczytać bazy: ${err.message}. Uruchom przez serwer lokalny albo zaimportuj JSON/CSV/XLSX/ZIP.`);
  el.stationList.innerHTML = '<div class="empty-state">Nie udało się wczytać bazy. Kliknij „Import JSON / CSV / XLSX / XML / ZIP” albo uruchom przez serwer HTTP.</div>';
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
  warnIfFileProtocol();
  loadSettings();
  applyTheme();
  bindEvents();
  updateSearchControls();
  setTab(state.activeTab || 'filters');
  setPanelMode(isMobileLayout() ? 'collapsed' : (state.panelMode || 'half'), false);
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
