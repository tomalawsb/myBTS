// Rodzaje błędów — wspólny klasyfikator dla komunikatów w interfejsie.
export const ERROR_TEXT = {
  offline: 'Brak połączenia z internetem.',
  timeout: 'Usługa nie odpowiedziała w czasie.',
  ratelimit: 'Usługa ograniczyła liczbę zapytań — spróbuj za chwilę.',
  service: 'Usługa zewnętrzna jest niedostępna lub zwróciła błąd.',
  nodata: 'Brak danych dla tego miejsca.',
  badresponse: 'Usługa zwróciła nieprawidłowe dane.',
  aborted: 'Przerwano.',
  input: 'Brak wymaganych danych wejściowych.',
  unknown: 'Nieoczekiwany błąd.'
};
export class AppError extends Error {
  constructor(kind, message, extra = {}){ super(message || ERROR_TEXT[kind] || ERROR_TEXT.unknown); this.kind = kind; Object.assign(this, extra); }
}
export function classifyError(err, online = true){
  if (!err) return 'unknown';
  if (err.kind) return err.kind;
  if (err.name === 'AbortError') return err.reason === 'timeout' || err.timeout ? 'timeout' : 'aborted';
  if (err.name === 'TimeoutError') return 'timeout';
  if (err.status === 429) return 'ratelimit';
  if (err.status >= 500) return 'service';
  if (err.status === 404) return 'nodata';
  if (err instanceof TypeError) return online ? 'service' : 'offline';
  return 'unknown';
}
export function errorText(err, online){ const k = classifyError(err, online); return { kind: k, text: (err && err.kind && err.message) ? err.message : ERROR_TEXT[k] }; }
/** fetch z limitem czasu i wspólnym sygnałem przerwania. */
export async function fetchWithTimeout(url, { signal, timeoutMs = 15000, ...opts } = {}){
  const ctl = new AbortController();
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    if (signal?.aborted) throw new AppError('aborted');
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok){ const e = new Error(`HTTP ${r.status}`); e.status = r.status; e.kind = classifyError(e); e.message = ERROR_TEXT[e.kind] + ` (HTTP ${r.status})`; throw e; }
    return r;
  } catch (e){
    if (timedOut) throw new AppError('timeout');
    if (signal?.aborted) throw new AppError('aborted');
    throw e;
  } finally { clearTimeout(t); signal?.removeEventListener('abort', onAbort); }
}
