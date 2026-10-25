// Styl kropek nadajników na mapie wg wyniku skanu w wybranym punkcie — te same progi i kolory co legenda zasięgu (MARGIN_BANDS).
// Kolor nie jest jedyną informacją: każda klasa ma też symbol i styl obwódki.
import { MARGIN_BANDS, marginBand } from './rf.js';

const SYMBOL = { strong: '++', good: '+', marginal: '!', none: '×', unknown: '?', pending: '…', nodata: '∅' };
const STROKE = { strong: 'solid', good: 'solid', marginal: 'dashed', none: 'dashed', unknown: 'dotted', pending: 'dotted', nodata: 'dotted' };
export const TX_UNKNOWN = { id: 'unknown', label: 'Jeszcze niesprawdzony', color: '#8A93A6' };
export const TX_NODATA = { id: 'nodata', label: 'Brak danych (nie oznacza braku zasięgu)', color: '#5E6678' };
export const TX_PENDING = { id: 'pending', label: 'Sprawdzany…', color: '#8A93A6' };

/** Klasa kropki: wynik skanu (lub null), czy skan jeszcze trwa i czy nadajnik jest kandydatem skanu. */
export function txMarkerClass(result, { scanning = false, candidate = false } = {}){
  let b;
  if (result?.state === 'nodata') b = TX_NODATA; // brak danych ≠ brak zasięgu
  else if (result && Number.isFinite(result.marginDb)) b = marginBand(result.marginDb);
  else if (result) b = MARGIN_BANDS[0]; // policzony, ale brak sygnału (np. -∞) → poniżej minimum
  else b = scanning && candidate ? TX_PENDING : TX_UNKNOWN;
  return { id: b.id, label: b.label, color: b.color, symbol: SYMBOL[b.id], stroke: STROKE[b.id] };
}

/** Legenda kropek (od najlepszej klasy). */
export function txLegend(){
  return [...MARGIN_BANDS.slice().reverse(), TX_UNKNOWN, TX_NODATA].map(b => ({ id: b.id, label: b.label, color: b.color, symbol: SYMBOL[b.id], stroke: STROKE[b.id] }));
}

/** Czy pokazać nadajnik w trybie „Tylko w zasięgu”. Bez punktu — wszystkie. W trakcie skanu — tylko kandydaci (nadajniki
 *  poza promieniem/wolną przestrzenią już wiadomo, że odpadają), po skanie — tylko z zapasem ≥ 0 dB. Wybrany zawsze widoczny. */
export function txVisibleInRange({ txId, selectedId, hasPoint, scan, candidate, result }){
  if (!hasPoint || !scan) return true;
  if (txId === selectedId) return true;
  if (result) return !!result.inRange;
  return !scan.done && candidate;
}

/** Widoczność kropki dla filtra: 'checked' (sprawdzone + kandydaci, także słabe), 'inRange' (zapas ≥ 0), 'all' (wszystkie nadające wybrany MUX).
 *  Nadajniki nienadające wybranego MUX-a są ukryte (poza wybranym). */
export function txVisible({ filter = 'checked', txId, selectedId, hasPoint, scan, candidate, result, emits = true }){
  if (txId === selectedId) return true;
  if (!emits) return false;
  if (filter === 'all' || !hasPoint || !scan) return true;
  if (filter === 'inRange') return result ? !!result.inRange : (!scan.done && !!candidate);
  return !!result || !!candidate;
}
