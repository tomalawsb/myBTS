// Odwzorowanie WGS84/ETRS89 → PUWG 1992 (EPSG:2180): Gauss-Krüger na GRS80, λ0=19°, m0=0.9993, x(N) −5 300 000, y(E) +500 000.
// Szereg Krügera do n^4 (dokładność ≪ 1 mm na obszarze Polski).
const A = 6378137, F = 1 / 298.257222101, N = F / (2 - F);
const A1 = A / (1 + N) * (1 + N * N / 4 + N ** 4 / 64);
const al = [N / 2 - 2 * N * N / 3 + 5 * N ** 3 / 16 + 41 * N ** 4 / 180, 13 * N * N / 48 - 3 * N ** 3 / 5 + 557 * N ** 4 / 1440, 61 * N ** 3 / 240 - 103 * N ** 4 / 140, 49561 * N ** 4 / 161280];
const E2 = F * (2 - F), E = Math.sqrt(E2);
export function toPuwg92(lat, lon){
  const r = Math.PI / 180, phi = lat * r, dl = (lon - 19) * r;
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - E * Math.atanh(E * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let X = xi, Y = eta;
  for (let j = 1; j <= 4; j++){ X += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); Y += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); }
  return { x: 0.9993 * A1 * X - 5300000, y: 0.9993 * A1 * Y + 500000 }; // x = northing, y = easting (konwencja geodezyjna PL)
}
export const inPolandBBox = (lat, lon) => lat >= 49.0 && lat <= 54.9 && lon >= 14.1 && lon <= 24.2;
