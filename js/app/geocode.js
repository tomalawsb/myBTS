// Wyszukiwanie adresów: Nominatim (OSM). Zasady usługi: maks. 1 zapytanie/s, bez autouzupełniania, z atrybucją.
import { fetchWithTimeout, AppError } from '../core/errors.js';
let last = 0, seq = 0, ctl = null;
export async function searchPlaces(q, { online = true } = {}){
  q = String(q || '').trim();
  if (q.length < 3) throw new AppError('input', 'Wpisz co najmniej 3 znaki.');
  if (!online) throw new AppError('offline', 'Wyszukiwanie adresu wymaga internetu. Możesz wskazać punkt na mapie.');
  const my = ++seq; ctl?.abort(); ctl = new AbortController();
  const wait = Math.max(0, 1100 - (Date.now() - last)); if (wait) await new Promise(r => setTimeout(r, wait));
  if (my !== seq) throw new AppError('aborted');
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=pl&accept-language=pl&addressdetails=0&q=${encodeURIComponent(q)}`;
  const r = await fetchWithTimeout(url, { signal: ctl.signal, timeoutMs: 12000, headers: { Accept: 'application/json' } });
  let data; try { data = await r.json(); } catch { throw new AppError('badresponse'); }
  if (my !== seq) throw new AppError('aborted'); // odpowiedź nieaktualna — nowsze zapytanie w toku
  if (!Array.isArray(data)) throw new AppError('badresponse');
  return data.map(x => ({ label: String(x.display_name || ''), lat: Number(x.lat), lon: Number(x.lon), type: String(x.type || '') })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}
