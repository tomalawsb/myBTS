// Charakterystyki anten nadawczych (pliki .ant RadioPolska).
// Rozpoznany format: 360 wierszy, po jednej wartości w dB względem maksimum (≤ 0),
// wiersz i = azymut i° (0 = północ, zgodnie z ruchem wskazówek zegara) — założenie opisane w README.
// Obsługiwany też format par "azymut wartość". Pliki niepewne są odrzucane, a nie zgadywane.
export const ANT_PARSER_VERSION = 'ant-2';
export const ANT_MAX_BYTES = 64 * 1024;

export function parseAnt(text){
  if (typeof text !== 'string') return { ok: false, error: 'Brak treści pliku.' };
  if (text.length > ANT_MAX_BYTES) return { ok: false, error: 'Plik za duży jak na charakterystykę anteny.' };
  const t = text.trim();
  if (!t) return { ok: false, error: 'Pusty plik.' };
  if (/^</.test(t) || /<html|<body|<!doctype/i.test(t)) return { ok: false, error: 'Odpowiedź to strona HTML, nie plik .ant.' };
  const lines = t.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^[#;]/.test(l));
  const rows = [];
  for (const l of lines){
    const nums = l.replace(/,/g, '.').split(/[\s;\t]+/).filter(Boolean).map(Number);
    if (!nums.length || nums.some(x => !Number.isFinite(x))) return { ok: false, error: `Nieczytelny wiersz: "${l.slice(0, 40)}"` };
    rows.push(nums);
  }
  let values; let format;
  if (rows.every(r => r.length === 1)){
    if (![36, 72, 360].includes(rows.length)) return { ok: false, error: `Nieoczekiwana liczba wartości (${rows.length}); oczekiwano 360.` };
    values = rows.map(r => r[0]); format = `1 kolumna × ${rows.length}`;
    values = resample(values.map((v, i) => [i * 360 / values.length, v]));
  } else if (rows.every(r => r.length === 2)){
    const pairs = rows.map(r => [r[0], r[1]]);
    if (pairs.some(([a]) => a < 0 || a > 360)) return { ok: false, error: 'Azymut poza zakresem 0–360°.' };
    if (pairs.length < 8) return { ok: false, error: 'Za mało punktów charakterystyki.' };
    values = resample(pairs); format = `pary azymut/wartość × ${pairs.length}`;
  } else return { ok: false, error: 'Nierozpoznany układ kolumn.' };
  const max = Math.max(...values), min = Math.min(...values);
  if (values.every(v => v === 0)) return { ok: true, placeholder: true, gains: null, format, note: 'Plik zawiera same zera (brak charakterystyki lub antena dookólna bez danych).' };
  if (max > 0.5 && min >= 0){
    // Wartości dodatnie: najpewniej względne napięcie 0..1 lub dB tłumienia — format niejednoznaczny.
    if (max <= 1.0001) values = values.map(v => v > 0 ? 20 * Math.log10(v) : -40), format += ' (napięcie względne)';
    else return { ok: false, error: 'Wartości dodatnie — nie wiadomo, czy to zysk, czy tłumienie.' };
  } else if (max > 0.5) return { ok: false, error: 'Mieszane znaki wartości — format niejednoznaczny.' };
  const top = Math.max(...values);
  const gains = Float32Array.from(values.map(v => Math.max(-40, v - top)));
  return { ok: true, placeholder: false, gains, format };
}

function resample(pairs){
  const p = pairs.map(([a, v]) => [((a % 360) + 360) % 360, v]).sort((x, y) => x[0] - y[0]);
  const out = new Array(360);
  for (let az = 0; az < 360; az++){
    let i = p.findIndex(x => x[0] >= az);
    let a, b;
    if (i === -1){ a = p[p.length - 1]; b = [p[0][0] + 360, p[0][1]]; }
    else if (i === 0){ a = [p[p.length - 1][0] - 360, p[p.length - 1][1]]; b = p[0]; }
    else { a = p[i - 1]; b = p[i]; }
    const span = b[0] - a[0];
    out[az] = span <= 0 ? a[1] : a[1] + (b[1] - a[1]) * ((az - a[0]) / span);
  }
  return out;
}

/** Zysk względny [dB] dla azymutu (od nadajnika do odbiornika), interpolacja liniowa z zawinięciem 359→0. */
export function antGainAt(gains, azDeg){
  if (!gains) return 0;
  const n = gains.length; const x = (((azDeg % 360) + 360) % 360) * n / 360;
  const i = Math.floor(x) % n, j = (i + 1) % n, f = x - Math.floor(x);
  return gains[i] * (1 - f) + gains[j] * f;
}

/** Link /0/ RadioPolska oznacza brak pliku charakterystyki. */
export function isPlaceholderAntUrl(url){ return !url || /\/ant_file\/0\//.test(url); }

/** Krótki odcisk charakterystyki (do klucza wyniku). */
export function antFingerprint(gains){
  if (!gains) return 'none';
  let h = 2166136261;
  for (let i = 0; i < gains.length; i++){ h ^= Math.round(gains[i] * 10) & 0xffff; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
