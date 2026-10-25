// Dane kontrolne: płaski teren, pojedyncze wzgórze, długa trasa.
export function flat(distKm, n = 601, elev = 100){
  const d = Float64Array.from({ length: n }, (_, i) => distKm * i / (n - 1));
  return { d, e: new Float64Array(n).fill(elev) };
}
export function hill(distKm, n, base, peakAt, peakH, widthKm){
  const p = flat(distKm, n, base);
  for (let i = 0; i < n; i++){ const x = (p.d[i] - peakAt) / widthKm; p.e[i] = base + peakH * Math.exp(-x * x); }
  return p;
}
