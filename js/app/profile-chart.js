// Wykres profilu — rysowany WYŁĄCZNIE z wyniku analyzePath (ten sam co ocena odbioru).
export function drawProfile(canvas, a){
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth || 600, H = canvas.clientHeight || 240;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const col = n => css.getPropertyValue(n).trim() || '#333';
  const n = a.n, D = a.distanceKm;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++){ lo = Math.min(lo, a.eff[i] - a.bulge[i], a.eff[i]); hi = Math.max(hi, a.eff[i], a.los[i] + 0.2 * a.f1[i]); }
  lo = Math.floor((lo - 10) / 10) * 10; hi = Math.ceil((hi + 10) / 10) * 10;
  const L = 48, R = 12, T = 12, B = 28;
  const X = km => L + (W - L - R) * (km / D), Y = m => T + (H - T - B) * (1 - (m - lo) / (hi - lo));
  const dArr = i => D * i / (n - 1);
  ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = col('--text-2'); ctx.strokeStyle = col('--line');
  ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++){ const m = lo + (hi - lo) * k / 4; ctx.beginPath(); ctx.moveTo(L, Y(m)); ctx.lineTo(W - R, Y(m)); ctx.stroke(); ctx.fillText(Math.round(m) + ' m', 2, Y(m) + 4); }
  for (let k = 0; k <= 4; k++){ const km = D * k / 4; ctx.fillText(km.toFixed(km < 10 ? 1 : 0).replace('.', ',') + ' km', Math.min(W - 44, X(km) - (k ? 16 : 0)), H - 8); }
  // Teren z krzywizną Ziemi (k=4/3).
  ctx.beginPath(); ctx.moveTo(X(0), Y(lo));
  for (let i = 0; i < n; i++) ctx.lineTo(X(dArr(i)), Y(a.eff[i]));
  ctx.lineTo(X(D), Y(lo)); ctx.closePath(); ctx.fillStyle = col('--terrain'); ctx.fill();
  // 60% pierwszej strefy Fresnela pod linią widoczności.
  ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.strokeStyle = col('--warn');
  for (let i = 0; i < n; i++){ const y = Y(a.los[i] - 0.6 * a.f1[i]); i ? ctx.lineTo(X(dArr(i)), y) : ctx.moveTo(X(0), y); }
  ctx.stroke(); ctx.setLineDash([]);
  // Linia widoczności.
  ctx.beginPath(); ctx.strokeStyle = a.losBlocked ? col('--bad') : col('--accent'); ctx.lineWidth = 2;
  ctx.moveTo(X(0), Y(a.rxAlt)); ctx.lineTo(X(D), Y(a.txAlt)); ctx.stroke();
  // Anteny.
  ctx.lineWidth = 3; ctx.strokeStyle = col('--text');
  ctx.beginPath(); ctx.moveTo(X(0), Y(a.rxGround + a.bulge[0])); ctx.lineTo(X(0), Y(a.rxAlt)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(D), Y(a.txGround)); ctx.lineTo(X(D), Y(a.txAlt)); ctx.stroke();
  // Główna przeszkoda.
  if (a.obstacle && a.obstacle.v > -0.78){
    const ox = X(a.obstacle.distFromRxKm), oy = Y(a.eff[a.obstacle.idx]);
    ctx.fillStyle = col('--bad'); ctx.beginPath(); ctx.moveTo(ox, oy - 12); ctx.lineTo(ox - 7, oy - 24); ctx.lineTo(ox + 7, oy - 24); ctx.closePath(); ctx.fill();
  }
}
