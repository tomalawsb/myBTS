// Geometria na kuli ziemskiej (WGS84 przybliżony kulą R=6371 km).
export const R_EARTH_KM = 6371;
export const rad = d => d * Math.PI / 180;
export const deg = r => r * 180 / Math.PI;
export function normDeg(v){ return ((v % 360) + 360) % 360; }
/** Różnica kątowa from→to w zakresie (-180, 180]. Dodatnia = w prawo (zgodnie z ruchem wskazówek). */
export function angleDiff(from, to){ const d = ((to - from + 540) % 360) - 180; return d === -180 ? 180 : d; }
export function distanceKm(a, b){
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
  return 2 * R_EARTH_KM * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
/** Azymut początkowy a→b w stopniach geograficznych (0 = północ). */
export function azimuthDeg(a, b){
  const y = Math.sin(rad(b.lon-a.lon))*Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat))*Math.sin(rad(b.lat)) - Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lon-a.lon));
  return normDeg(deg(Math.atan2(y, x)));
}
export function destinationPoint(lat, lon, bearingDeg, distKm){
  const d = distKm / R_EARTH_KM, b = rad(bearingDeg), p1 = rad(lat), l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1)*Math.cos(d) + Math.cos(p1)*Math.sin(d)*Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(p1), Math.cos(d) - Math.sin(p1)*Math.sin(p2));
  return { lat: deg(p2), lon: ((deg(l2) + 540) % 360) - 180 };
}
/** Punkty pośrednie po łuku wielkiego koła (f = 0..1). */
export function intermediatePoint(a, b, f){
  const p1 = rad(a.lat), l1 = rad(a.lon), p2 = rad(b.lat), l2 = rad(b.lon);
  const d = distanceKm(a, b) / R_EARTH_KM;
  if (d < 1e-12) return { lat: a.lat, lon: a.lon };
  const A = Math.sin((1-f)*d)/Math.sin(d), B = Math.sin(f*d)/Math.sin(d);
  const x = A*Math.cos(p1)*Math.cos(l1) + B*Math.cos(p2)*Math.cos(l2);
  const y = A*Math.cos(p1)*Math.sin(l1) + B*Math.cos(p2)*Math.sin(l2);
  const z = A*Math.sin(p1) + B*Math.sin(p2);
  return { lat: deg(Math.atan2(z, Math.hypot(x, y))), lon: deg(Math.atan2(y, x)) };
}
export function compassPoint(az){
  const names = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return names[Math.round(normDeg(az) / 22.5) % 16];
}
