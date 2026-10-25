// Logika kompasu (bez DOM): jedno źródło kursu, stany czujnika, wygładzanie z zawinięciem 359→0.
import { normDeg, angleDiff } from './geo.js';
export const COMPASS_STALE_MS = 2500;
export const STATES = {
  unsupported: 'Brak czujnika kierunku w tym urządzeniu/przeglądarce',
  idle: 'Kompas wyłączony',
  'needs-permission': 'Wymagana zgoda na czujnik ruchu',
  denied: 'Odmówiono dostępu do czujnika',
  waiting: 'Czekam na pierwszy odczyt czujnika…',
  ok: 'Czujnik działa',
  stale: 'Brak świeżych odczytów czujnika',
  manual: 'Tryb awaryjny — kierunek ustawiony ręcznie'
};
/** Kurs z DeviceOrientationEvent (stopnie geograficzne/magnetyczne, 0 = północ) lub null. */
export function headingFromEvent(ev, screenAngle = 0){
  if (ev == null) return null;
  if (Number.isFinite(ev.webkitCompassHeading)) return { heading: normDeg(ev.webkitCompassHeading), accuracy: Number.isFinite(ev.webkitCompassAccuracy) && ev.webkitCompassAccuracy >= 0 ? ev.webkitCompassAccuracy : null, absolute: true };
  if (Number.isFinite(ev.alpha) && (ev.absolute === true || ev.type === 'deviceorientationabsolute')){
    // alpha rośnie przeciwnie do ruchu wskazówek; korekta o orientację ekranu.
    return { heading: normDeg(360 - ev.alpha + screenAngle), accuracy: null, absolute: true };
  }
  return null; // alpha względna nie jest kierunkiem geograficznym
}
/** Przetworzenie surowego odczytu: odwrócenie (diagnostyka), korekta kalibracji, wygładzenie. */
export function processHeading(prevSmoothed, raw, { invert = false, offset = 0, alpha = 0.25 } = {}){
  let h = invert ? normDeg(360 - raw) : raw;
  h = normDeg(h + offset);
  if (prevSmoothed == null) return h;
  return normDeg(prevSmoothed + angleDiff(prevSmoothed, h) * alpha);
}
export function compassState({ supported, permission, lastTs, now, manual }){
  if (manual) return 'manual';
  if (!supported) return 'unsupported';
  if (permission === 'denied') return 'denied';
  if (permission === 'prompt') return 'needs-permission';
  if (permission === 'off') return 'idle';
  if (!lastTs) return 'waiting';
  return now - lastTs > COMPASS_STALE_MS ? 'stale' : 'ok';
}
/** Polecenie obrotu i ocena trafienia. Precyzja ogłaszana tylko przy znanej, dobrej dokładności. */
export function turnInstruction(heading, target, accuracy, state){
  if (heading == null || !(state === 'ok' || state === 'manual')) return { text: `Ustaw antenę na azymut ${Math.round(normDeg(target))}°`, diff: null, aligned: false, precise: false };
  const diff = angleDiff(heading, target);
  const a = Math.abs(Math.round(diff));
  const tol = 5;
  if (a <= tol){
    const precise = state === 'ok' && accuracy != null && accuracy <= 10;
    return { text: precise ? 'Kierunek prawidłowy' : 'Kierunek zgodny w granicach dokładności czujnika — potwierdź wizualnie', diff, aligned: true, precise };
  }
  return { text: `Obróć ${a}° w ${diff > 0 ? 'prawo' : 'lewo'}`, diff, aligned: false, precise: false };
}
