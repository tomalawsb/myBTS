// Pamięć lokalna: ustawienia i instalacje (localStorage), wyniki (IndexedDB), teren (Cache Storage, dem.js).
const K_SETTINGS = 'dvbt3.settings', K_INST = 'dvbt3.installations', K_OLD = 'dvbt-point-v19-state';
const DB_NAME = 'dvbt-point-v3', STORE = 'results';
const readJSON = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function loadSettings(){
  let s = readJSON(K_SETTINGS, null);
  if (!s){
    s = {};
    const old = readJSON(K_OLD, null); // migracja z v19 — zachowujemy punkt odbioru i wybór nadajnika
    if (old && old.rx && Number.isFinite(old.rx.lat)){
      s.point = { lat: old.rx.lat, lon: old.rx.lon, label: old.rx.label || 'Punkt z poprzedniej wersji', source: 'migracja', accuracyM: null };
      if (Number.isFinite(Number(old.rxHeight))) s.rxHeightM = Number(old.rxHeight);
      if (old.selectedId) s.txId = old.selectedId;
      s.migratedFrom = 'v19';
    }
  }
  return s;
}
export const saveSettings = s => writeJSON(K_SETTINGS, s);
export const loadInstallations = () => readJSON(K_INST, []);
export const saveInstallations = list => writeJSON(K_INST, list);

function db(){
  return new Promise((res, rej) => {
    if (!('indexedDB' in self)) return rej(new Error('Brak IndexedDB'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn){
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const st = t.objectStore(STORE); const out = fn(st); t.oncomplete = () => res(out.result ?? out); t.onerror = () => rej(t.error); });
}
export const putResult = rec => tx('readwrite', st => st.put({ ...rec, savedAt: Date.now() })).catch(() => null);
export const getResult = key => tx('readonly', st => st.get(key)).catch(() => null);
export const deleteResult = key => tx('readwrite', st => st.delete(key)).catch(() => null);
export const listResults = () => tx('readonly', st => st.getAll()).catch(() => []);
export const clearResults = () => tx('readwrite', st => st.clear()).catch(() => null);
export async function resultsSize(){ const all = await listResults(); return { count: all.length, bytes: all.reduce((a, r) => a + JSON.stringify(r).length, 0) }; }
export function installationsSize(){ return (localStorage.getItem(K_INST) || '').length; }
export async function storageEstimate(){ try { return await navigator.storage.estimate(); } catch { return null; } }
export async function requestPersist(){ try { return await navigator.storage?.persist?.(); } catch { return false; } }
