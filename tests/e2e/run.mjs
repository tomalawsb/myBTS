// Testy E2E (Playwright, Chromium). Sieć zewnętrzna jest PODMIENIONA: syntetyczne kafle terenu (płasko 100 m n.p.m.),
// puste kafle mapy i sztuczna odpowiedź Nominatim — testy są powtarzalne i nie obciążają usług.
// Uruchom: npm i -D playwright && npx playwright install chromium && node tests/e2e/run.mjs
// (opcjonalnie PW_CHROMIUM=/ścieżka/do/chrome)
import { spawn } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_MODULE || 'playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 8000 + Math.floor(Math.random() * 900);
const BASE = `http://127.0.0.1:${PORT}/`;

function crc32(buf){ let c, crc = ~0; for (const b of buf){ c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data){ const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, hgt, px){ // px(x,y)->[r,g,b]
  const raw = Buffer.alloc((w * 3 + 1) * hgt);
  for (let y = 0; y < hgt; y++){ raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++){ const [r, g, b] = px(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(hgt, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const DEM = png(256, 256, () => [128, 100, 0]); // 128*256+100-32768 = 100 m
const CLC = png(256, 256, () => [255, 255, 168]); // CORINE 211 grunty orne
const MAPTILE = png(256, 256, (x, y) => ((x >> 5) + (y >> 5)) % 2 ? [236, 238, 242] : [226, 230, 236]);

let pass = 0, fail = 0; const errors = [];
async function test(name, fn){
  try { await fn(); pass++; console.log('ok   -', name); }
  catch (e){ fail++; console.log('FAIL -', name, '\n      ', e.message.split('\n').filter(l => /intercepts|Timeout|waiting for/.test(l)).slice(-3).join(' / ') || e.message.split('\n')[0]); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };
async function reachable(page, selector){
  const r = await page.locator(selector).evaluate(el => {
    const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    return { visible: b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1,
      hit: el.contains(document.elementFromPoint(x, y)), rect: b.toJSON() };
  });
  assert(r.visible && r.hit, `${selector} niewidoczny lub zasłonięty: ${JSON.stringify(r)}`);
}

async function newPage(browser, viewport){
  const ctx = await browser.newContext({ viewport, locale: 'pl-PL', geolocation: { latitude: 52.1, longitude: 21.2 }, permissions: ['geolocation'] });
  await ctx.route(/s3\.amazonaws\.com\/elevation-tiles-prod/, r => r.fulfill({ status: 200, contentType: 'image/png', body: DEM, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.route(/tile\.openstreetmap\.org|opentopomap|arcgisonline/, r => r.fulfill({ status: 200, contentType: 'image/png', body: MAPTILE }));
  await ctx.route(/image\.discomap\.eea\.europa\.eu/, r => r.fulfill({ status: 200, contentType: 'image/png', body: CLC, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await ctx.route(/services\.gugik\.gov\.pl\/nmt/, r => { const list = decodeURIComponent(new URL(r.request().url()).searchParams.get('list') || ''); const pts = list.split(',').filter(Boolean);
    r.fulfill({ status: 200, contentType: 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: pts.map(q => q.trim() + ' 100.5').join(',') }); });
  await ctx.route(/nominatim\.openstreetmap\.org/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify([{ display_name: 'Testowo, gmina Próbna', lat: '52.15', lon: '21.0', type: 'village' }]) }));
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`${viewport.width}: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`${viewport.width} console: ${m.text()}`); });
  return { ctx, page };
}

const server = spawn(process.env.PYTHON || 'python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
const PT = { lat: 50.33624, lon: 21.32573 };
const SK = 'kielce-swiety-krzyz', TB = 'tarnobrzeg-komin-zch-siarkopol';
const ptOf = p => p.evaluate(() => window.__dvbt.point && { lat: window.__dvbt.point.lat, lon: window.__dvbt.point.lon });
const settle = p => p.waitForFunction(() => { const a = window.__dvbt.analysis; return a && a.sel === window.__dvbt.selKey() && !window.__dvbt.jobs.list().some(j => j.kind === 'point' && j.state === 'running'); }, null, { timeout: 60000 });
async function noHScroll(p, what){ const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert(o <= 1, `${what}: przewijanie w poziomie ${o}px`); }
try {
  const { ctx, page } = await newPage(browser, { width: 360, height: 640 });
  await test('360×640: start, przycisk MUX, podpowiedź „Przytrzymaj mapę”', async () => {
    await page.goto(BASE + 'index.html');
    await page.waitForSelector('.leaflet-container');
    await page.getByRole('heading', { name: 'Gdzie montujesz antenę?' }).waitFor({ timeout: 8000 });
    const mb = await page.locator('#btn-mux').boundingBox();
    assert(mb && mb.height >= 47, 'przycisk MUX ' + JSON.stringify(mb));
    assert(/MUX-/.test(await page.locator('#btn-mux .mux-val').textContent()), 'brak nazwy MUX');
    assert(await page.getByText('Przytrzymaj mapę, aby ustawić punkt').count() >= 1, 'brak podpowiedzi');
    await noHScroll(page, 'start');
  });
  await test('dotknięcie, przesunięcie i zoom mapy NIE ustawiają punktu', async () => {
    const mb = await page.locator('#map').boundingBox(); const cx = mb.x + mb.width / 2, cy = mb.y + 200;
    await page.mouse.click(cx, cy); await page.waitForTimeout(700);
    assert(await ptOf(page) === null, 'kliknięcie ustawiło punkt');
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let i = 1; i <= 8; i++){ await page.mouse.move(cx + i * 10, cy + i * 4); await page.waitForTimeout(60); }
    await page.waitForTimeout(400); await page.mouse.up();
    assert(await ptOf(page) === null, 'przesunięcie ustawiło punkt');
    await page.mouse.move(cx, cy); await page.mouse.wheel(0, -300); await page.waitForTimeout(600);
    assert(await ptOf(page) === null, 'zoom ustawił punkt');
  });
  await test('przytrzymanie 600 ms ustawia punkt; „Cofnij” przywraca poprzedni', async () => {
    const mb = await page.locator('#map').boundingBox(); const cx = mb.x + mb.width / 2, cy = mb.y + 200;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.waitForTimeout(250); assert(await page.locator('#press-ring').isVisible(), 'brak postępu przytrzymania');
    await page.waitForTimeout(500); await page.mouse.up();
    const p1 = await ptOf(page); assert(p1, 'przytrzymanie nie ustawiło punktu');
    await page.locator('#btn-undo').waitFor();
    await page.locator('#btn-undo').click();
    assert(await ptOf(page) === null, 'Cofnij nie przywrócił stanu');
  });
  await test('punkt testowy, MUX-3: wynik z azymutem i panel w podsumowaniu', async () => {
    await page.evaluate(([p]) => { window.__dvbt.setMuxType('MUX-3'); window.__dvbt.setPoint({ lat: p.lat, lon: p.lon, label: 'Test' }); }, [PT]);
    await page.locator('#sheet-head .big-az strong').first().waitFor({ timeout: 30000 });
    const az = await page.locator('#sheet-head .big-az strong').first().textContent();
    assert(/^\d+°$/.test(az.trim()), 'azymut: ' + az);
    assert(await page.locator('#btn-coverage').isVisible() && await page.locator('#btn-aim').isVisible(), 'Zasięg / Ustaw antenę poza widokiem');
    await settle(page);
  });
  await test('kliknięcie mapy z punktem nie przesuwa punktu', async () => {
    const p0 = await ptOf(page); const mb = await page.locator('#map').boundingBox();
    await page.mouse.click(mb.x + 60, mb.y + 160); await page.waitForTimeout(700);
    const p1 = await ptOf(page); assert(p1.lat === p0.lat && p1.lon === p0.lon, 'punkt przesunięty kliknięciem');
  });
  await test('zmiana nadajnika Święty Krzyż → Tarnobrzeg zachowuje MUX-3', async () => {
    await page.evaluate(id => window.__dvbt.chooseTx(id), SK); await settle(page);
    let a = await page.evaluate(() => ({ t: window.__dvbt.analysis.tx.id, m: window.__dvbt.analysis.mux.name, s: window.__dvbt.settings.muxType }));
    assert(a.t === SK && a.m === 'MUX-3' && a.s === 'MUX-3', 'ŚK: ' + JSON.stringify(a));
    await page.evaluate(id => window.__dvbt.chooseTx(id), TB); await settle(page);
    a = await page.evaluate(() => ({ t: window.__dvbt.analysis.tx.id, m: window.__dvbt.analysis.mux.name, ch: window.__dvbt.analysis.mux.channel, s: window.__dvbt.settings.muxType }));
    assert(a.t === TB && a.m === 'MUX-3' && a.s === 'MUX-3', 'Tarnobrzeg: ' + JSON.stringify(a));
    assert(/MUX-3/.test(await page.locator('#btn-mux').textContent()), 'przycisk MUX zmieniony');
  });
  await test('szybkie przełączanie: brak nieaktualnego wyniku', async () => {
    await page.evaluate(([a, b]) => { for (let i = 0; i < 6; i++) window.__dvbt.chooseTx(i % 2 ? a : b); window.__dvbt.chooseTx(a); }, [TB, SK]);
    await settle(page);
    const r = await page.evaluate(() => ({ t: window.__dvbt.analysis.tx.id, s: window.__dvbt.settings.txId, ok: window.__dvbt.analysis.sel === window.__dvbt.selKey() }));
    assert(r.t === r.s && r.t === TB && r.ok, JSON.stringify(r));
  });
  await test('ranking per MUX; ręczny wybór nie jest nadpisany', async () => {
    await page.evaluate(() => window.__dvbt.runScan());
    await page.waitForFunction(() => window.__dvbt.scan?.done && window.__dvbt.scan.muxType === 'MUX-3', null, { timeout: 90000 });
    const s3 = await page.evaluate(() => ({ k: window.__dvbt.scan.key, n: window.__dvbt.scan.checked, tot: window.__dvbt.scan.total, tx: window.__dvbt.settings.txId, lim: window.__dvbt.scan.limit }));
    assert(s3.tx === TB, 'polecany nadpisał ręczny wybór: ' + s3.tx);
    assert(s3.n > 0 && s3.n <= 14 && s3.lim === 14, 'kandydaci: ' + JSON.stringify(s3));
    await page.evaluate(() => window.__dvbt.setMuxType('MUX-1'));
    await page.evaluate(() => window.__dvbt.runScan());
    await page.waitForFunction(() => window.__dvbt.scan?.done && window.__dvbt.scan.muxType === 'MUX-1', null, { timeout: 90000 });
    const k1 = await page.evaluate(() => window.__dvbt.scan.key);
    assert(k1 !== s3.k, 'ten sam klucz rankingu dla różnych MUX');
    await page.evaluate(() => window.__dvbt.setMuxType('MUX-3')); await settle(page);
  });
  await test('wybór MUX: siatka wszystkich MUX-ów, zaznaczenie kolorem i symbolem', async () => {
    await page.locator('#btn-mux').click();
    const cells = page.locator('.mux-grid .mux-cell'); await cells.first().waitFor();
    assert(await cells.count() >= 6, 'za mało MUX-ów');
    const sel = page.locator('.mux-cell[aria-checked="true"]');
    assert(await sel.count() === 1 && /MUX-3/.test(await sel.textContent()) && /✓/.test(await sel.textContent()), 'zaznaczenie');
    await noHScroll(page, 'siatka MUX');
    await page.keyboard.press('Escape'); await page.locator('.modal').waitFor({ state: 'detached' });
  });
  await test('panel: „Rozwiń szczegóły”/„Zwiń” z aria-expanded, sekcje', async () => {
    const b = page.locator('#btn-sheet-expand');
    assert(await b.getAttribute('aria-expanded') === 'false', 'stan początkowy');
    // Podsumowanie: mapa widoczna w ponad połowie obszaru między górnym paskiem a dolną nawigacją.
    const mapBox = await page.locator('#map').boundingBox(), sheetBox = await page.locator('#sheet').boundingBox();
    const visible = (sheetBox.y - mapBox.y) / mapBox.height; assert(visible > 0.5, `mapa widoczna tylko w ${Math.round(visible * 100)}%`);
    await b.click();
    for (const selector of ['#btn-mux', '#btn-menu', '#btn-coverage', '#btn-aim']) await reachable(page, selector);
    assert(await page.locator('#sheet').getAttribute('data-pos') === 'expanded', 'nie rozwinięto');
    assert(await b.getAttribute('aria-expanded') === 'true' && /Zwiń/.test(await b.textContent()), 'aria / etykieta');
    for (const t of ['Wynik', 'Instalacja', 'Profil terenu', 'Dane obliczeń']) assert(await page.locator('#sheet-body h3', { hasText: t }).count() >= 1, 'brak sekcji ' + t);
    const sh = (await page.locator('#sheet').boundingBox()).height; assert(sh > 640 * 0.6, 'wysokość rozwinięta ' + sh);
    // Treść szczegółów ma co najmniej połowę panelu i daje się przewinąć do końca (jedno przewijanie, bez zagnieżdżonych).
    for (const tab of ['Wynik', 'Instalacja', 'Teren', 'Dane']){
      await page.locator('.sheet-tabs [role=tab]', { hasText: tab }).click();
      const body = await page.locator('#sheet-body').boundingBox(); assert(body.height > sh * 0.5, `zakładka ${tab}: treść ${body.height}px z ${sh}px`);
      await page.locator('#sheet-body').evaluate(e => { const d = e.querySelector('details'); if (d) d.open = true; });
      const res = await page.locator('#sheet-body').evaluate(async e => { e.scrollTop = 1e6; await new Promise(r => setTimeout(r, 100)); const sec = e.querySelector('.sheet-sec:not([hidden])'); const last = [...sec.querySelectorAll('*')].filter(x => x.offsetParent).pop();
        const nested = [...e.querySelectorAll('*')].filter(x => x.offsetParent && x.scrollHeight > x.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(x).overflowY)).length;
        return { end: Math.abs(e.scrollHeight - e.clientHeight - e.scrollTop) < 2, lastVisible: last ? last.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom + 1 : true, nested }; });
      assert(res.end && res.lastVisible && res.nested === 0, `zakładka ${tab}: przewijanie ${JSON.stringify(res)}`);
    }
    await page.locator('.sheet-tabs [role=tab]', { hasText: 'Wynik' }).click();
    assert(await page.evaluate(() => window.__dvbt.handleBack()) === true && await page.locator('#sheet').getAttribute('data-pos') === 'summary', 'Wstecz → podsumowanie');
    await page.locator('#sheet-toggle').click();
    assert(await page.locator('#sheet').getAttribute('data-pos') === 'collapsed', 'uchwyt nie zwinął');
    await page.locator('#sheet-toggle').click();
    assert(await page.locator('#sheet').getAttribute('data-pos') === 'summary', 'uchwyt nie przywrócił');
  });
  await test('Zasięg: okno, okolica 1 km, legenda pola, odczyt bez przesuwania punktu', async () => {
    await page.locator('#btn-coverage').click();
    await page.getByRole('dialog').waitFor();
    assert(await page.locator('#btn-cov-run').isVisible() && await page.locator('#btn-cov-cancel').count() === 1, 'brak Oblicz/Anuluj');
    await page.getByRole('radio', { name: /Okolica punktu/ }).click();
    await page.locator('#btn-cov-run').click();
    assert(await page.getByText(/Promień wokół nadajnika/).count() === 0, 'promień pokazany przy „Okolica punktu”');
    await page.waitForFunction(() => window.__dvbt.area?.mode === 'local', null, { timeout: 90000 });
    await page.locator('.modal').waitFor({ state: 'detached', timeout: 3000 }); // okno zamyka się samo po obliczeniu
    await page.locator('#legend:not([hidden])').waitFor();
    assert(await page.locator('#legend').getAttribute('data-open') === 'false', 'legenda domyślnie rozwinięta');
    await page.locator('.legend-toggle').click({ timeout: 3000 }); // zwinięta legenda nie jest zasłonięta
    assert(await page.locator('#legend').getAttribute('data-open') === 'true', 'legenda nie rozwija się');
    await page.locator('.legend-toggle').click({ timeout: 3000 });
    assert(await page.locator('img.coverage-overlay').count() === 1, 'brak nakładki');
    const p0 = await ptOf(page);
    const r = await page.evaluate(([p]) => window.__dvbt.readCoverage({ lat: p.lat + 0.002, lng: p.lon }, { popup: false }), [p0]);
    assert(r && (Number.isFinite(r.fieldDbuv) || Number.isFinite(r.field) || r.state), 'odczyt: ' + JSON.stringify(r));
    const far = await page.evaluate(([p]) => window.__dvbt.readCoverage({ lat: p.lat + 0.5, lng: p.lon }, { popup: false }), [p0]);
    assert(far && far.state === 'outside', 'poza obszarem: ' + JSON.stringify(far));
    const p1 = await ptOf(page); assert(p1.lat === p0.lat, 'odczyt przesunął punkt');
    const opened = await page.locator('#legend[data-open="true"]').waitFor({ timeout: 4000 }).then(() => true, () => false);
    if (!opened) await page.locator('.legend-toggle').click();
    await page.locator('#legend-body').waitFor({ timeout: 5000 }).catch(async () => { throw new Error('legenda nie rozwinięta: open=' + await page.locator('#legend').getAttribute('data-open') ); });
    const lt = await page.locator('#legend').textContent();
    assert(/dBµV\/m/.test(lt) && /MUX-3/.test(lt) && /K\d+/.test(lt) && /P\.1812/.test(lt), 'legenda: ' + lt.slice(0, 200));
    assert(/Dodatni zapas modelowy na \d+% obliczonego obszaru/.test(lt), 'brak tekstu udziału');
    const op = await page.locator('#legend input[type=range]').inputValue(); assert(op === '45', 'krycie ' + op);
    await page.evaluate(() => window.__dvbt.setAreaView('margin'));
    assert(/dB/.test(await page.locator('#legend').textContent()), 'widok zapasu');
    await page.evaluate(() => window.__dvbt.setAreaView('field'));
    if (await page.locator('#legend').getAttribute('data-open') === 'true') await page.locator('.legend-toggle').click();
  });
  await test('legenda mieści się nad panelem i nie blokuje przycisków', async () => {
    await page.locator('.legend-toggle').click();
    const leg = await page.locator('#legend').boundingBox(), sh = await page.locator('#sheet').boundingBox();
    assert(leg.y + leg.height <= sh.y, `legenda nachodzi na wynik: ${JSON.stringify({ leg, sh })}`);
    for (const selector of ['#btn-mux', '#btn-coverage', '#btn-aim']) await reachable(page, selector);
    await page.getByRole('radio', { name: 'Zapas odbioru', exact: true }).click();
    assert(!await page.evaluate(() => !!window.__dvbt.jobs.get('area')), 'zmiana skali uruchomiła obliczenia');
    await page.locator('.legend-toggle').click();
  });
  await test('anulowanie 60 km zachowuje 30 km z jednoznacznym opisem', async () => {
    await page.evaluate(() => window.__dvbt.runArea('area', 30));
    await page.waitForFunction(() => window.__dvbt.area?.radiusKm === 30, null, { timeout: 90000 });
    await page.locator('#btn-coverage').click();
    await page.getByRole('radio', { name: 'Wokół nadajnika', exact: true }).click();
    await page.getByRole('radio', { name: /60 km/ }).click();
    await page.locator('#btn-cov-run').click();
    await page.locator('#btn-cov-cancel').click();
    await page.waitForFunction(() => !window.__dvbt.jobs.get('area'));
    assert(await page.evaluate(() => window.__dvbt.area?.radiusKm) === 30, 'utracono poprzedni wynik');
    assert(/Anulowano obliczenie: 60 km/.test(await page.locator('#cov-attempt-status').innerText()), 'brak opisu anulowania');
    assert(/Na mapie: 30 km/.test(await page.locator('#cov-result-status').innerText()), 'stary wynik opisany jako 60 km');
    assert(!/Gotowe:/.test(await page.getByRole('dialog').innerText()), 'mylący komunikat Gotowe');
    await page.keyboard.press('Escape');
  });
  await test('MUX-8: podstawowe ustawienia VHF, grupy i opis braków w wyborze MUX', async () => {
    await page.locator('#btn-mux').click();
    assert(await page.getByRole('heading', { name: 'Multipleksy lokalne' }).count() === 1, 'brak grup lokalnych');
    assert(await page.getByRole('radio', { name: /^Bez numeru MUX/ }).count() === 1, 'nieopisany MUX bez numeru');
    await page.getByRole('radio', { name: /^MUX-8\s/ }).click(); await settle(page);
    await page.locator('#btn-menu').click();
    await page.getByRole('button', { name: 'Ustawienia odbioru', exact: true }).click();
    assert(await page.getByLabel('Zysk anteny VHF [dBi]', { exact: true }).isVisible(), 'zysk VHF ukryty');
    assert(!await page.getByLabel('Zysk anteny UHF [dBi]', { exact: true }).isVisible(), 'podstawowy formularz pokazuje inne pasmo');
    await page.getByLabel('Zysk anteny VHF [dBi]', { exact: true }).fill('8');
    await page.getByLabel('Straty kabla i złączy [dB]', { exact: true }).focus();
    assert(await page.evaluate(() => window.__dvbt.settings.rx.gainVhfDbi) === 8, 'nie zapisano zysku VHF');
    await page.keyboard.press('Escape');
    await page.locator('#btn-mux').click();
    await page.getByRole('radio', { name: /^MUX-3\s/ }).click(); await settle(page);
  });
  await test('model i dane obliczeń: P.1812, źródło terenu i krok osobno', async () => {
    await page.evaluate(() => window.__dvbt.setSheetPos('expanded'));
    const t = await page.locator('#sheet-body').textContent();
    assert(/P\.1812/.test(t), 'brak P.1812');
    assert(/krok próbkowania/.test(t) && /rozdzielczość źródła/.test(t), 'brak rozdzielczości / kroku');
    await page.evaluate(() => window.__dvbt.setSheetPos('summary'));
  });
  await test('ustawienia: model uproszczony w zaawansowanych, opis „Uproszczony — …”', async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByText('Ustawienia odbioru').click();
    await page.locator('#adv-settings summary').click();
    const opts = await page.locator('#sel-model option').allTextContents();
    assert(opts.some(o => /Uproszczony — bez pełnego uwzględnienia warunków propagacji/.test(o)), 'opis: ' + opts);
    await page.keyboard.press('Escape');
  });
  await test('zapis instalacji i lista Zapisane', async () => {
    await page.evaluate(() => window.__dvbt.setSheetPos('expanded'));
    await page.locator('.sheet-tabs [role=tab]', { hasText: 'Instalacja' }).click();
    await page.getByRole('button', { name: 'Zapisz instalację' }).click();
    await page.getByLabel('Nazwa instalacji').fill('Test E2E');
    await page.locator('.modal-actions').getByRole('button', { name: 'Zapisz' }).click();
    await page.locator('.bottom-nav').getByRole('button', { name: 'Zapisane' }).click();
    await page.getByText('Test E2E').waitFor();
    await page.locator('.bottom-nav').getByRole('button', { name: 'Mapa' }).click();
    await page.evaluate(() => window.__dvbt.setSheetPos('summary'));
  });
  await test('lista nadajników: filtr MUX, wyszukiwanie dowolnego nadajnika', async () => {
    await page.locator('.bottom-nav').getByRole('button', { name: 'Nadajnik' }).click();
    await page.locator('#tab-tx .list-item').first().waitFor();
    await page.locator('#tab-tx input[type=search]').fill('Tarnobrzeg');
    await page.locator('#tab-tx .list-item', { hasText: 'Tarnobrzeg' }).first().waitFor();
    await noHScroll(page, 'lista');
    await page.locator('.bottom-nav').getByRole('button', { name: 'Mapa' }).click();
  });
  await test('tekst powiększony 130%: brak przewijania w poziomie', async () => {
    await page.evaluate(() => { document.documentElement.style.fontSize = '130%'; document.body.style.fontSize = '130%'; });
    await page.waitForTimeout(200); await noHScroll(page, 'tekst 130%');
    const b = await page.locator('#btn-aim').boundingBox(); assert(b && b.x + b.width <= 361, 'Ustaw antenę poza ekranem');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; document.body.style.fontSize = ''; });
  });
  await test('offline: ponowne uruchomienie z service workera, zapisane zostają', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); await page.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    // Chromium po nawigacji może zgłaszać onLine=true mimo blokady sieci CDP.
    // Osobno symulujemy sygnał systemu. Sieć naprawdę blokuje setOffline.
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    await page.reload();
    await page.waitForSelector('.leaflet-container');
    await page.locator('#offline:not([hidden])').waitFor();
    await page.locator('.bottom-nav').getByRole('button', { name: 'Zapisane' }).click();
    await page.getByText('Test E2E').waitFor();
    await ctx.setOffline(false);
  });
  if (process.env.SHOTS) await page.screenshot({ path: process.env.SHOTS + '/m360.png' });
  await ctx.close();
  const l = await newPage(browser, { width: 640, height: 360 });
  await test('poziomo 640×360: panel i przyciski dostępne', async () => {
    await l.page.goto(BASE + 'index.html');
    await l.page.waitForSelector('.leaflet-container');
    await l.page.evaluate(([p]) => window.__dvbt.setPoint({ lat: p.lat, lon: p.lon }), [PT]);
    await l.page.locator('#btn-aim').waitFor({ timeout: 30000 });
    const b = await l.page.locator('#btn-aim').boundingBox(); assert(b && b.y + b.height <= 360, 'Ustaw antenę poza ekranem ' + JSON.stringify(b));
    await settle(l.page);
    for (const selector of ['#btn-mux', '#btn-menu', '#search-input', '#btn-coverage', '#btn-aim']) await reachable(l.page, selector);
    const mapBox = await l.page.locator('#map').boundingBox(), sheetBox = await l.page.locator('#sheet').boundingBox();
    assert(mapBox.x >= sheetBox.width - 1 && mapBox.height > 300, 'panel poziomy zasłania mapę');
    await l.page.locator('.sheet-tabs [role=tab]', { hasText: 'Instalacja' }).click();
    await l.page.getByRole('button', { name: 'Zmień lokalizację', exact: true }).click();
    await l.page.getByRole('dialog').waitFor();
    await l.page.keyboard.press('Escape');
    await noHScroll(l.page, 'poziomo');
  });
  await l.ctx.close();
  const d = await newPage(browser, { width: 1280, height: 800 });
  await test('desktop 1280×800: panel boczny 380 px, menu „Ustaw punkt tutaj”', async () => {
    await d.page.goto(BASE + 'index.html');
    await d.page.getByRole('heading', { name: 'Gdzie montujesz antenę?' }).waitFor();
    const box = await d.page.locator('#sheet').boundingBox();
    const topbar = await d.page.locator('.topbar').boundingBox();
    assert(Math.abs(box.width - 380) <= 1 && box.height > 550 && box.y >= topbar.y + topbar.height - 1, 'panel ' + JSON.stringify(box));
    for (const selector of ['#btn-mux', '#btn-menu', '#search-input']) await reachable(d.page, selector);
    await d.page.locator('#btn-mux').click();
    await d.page.getByRole('radio', { name: /^MUX-8\s/ }).click();
    await d.page.locator('#btn-menu').click();
    await d.page.getByRole('button', { name: 'Ustawienia odbioru', exact: true }).click();
    await d.page.getByRole('dialog').waitFor();
    await d.page.keyboard.press('Escape');
    const mb = await d.page.locator('#map').boundingBox();
    await d.page.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2, { button: 'right' });
    await d.page.getByRole('menuitem', { name: 'Ustaw punkt tutaj' }).click();
    assert(await ptOf(d.page), 'menu nie ustawiło punktu');
    await d.page.locator('#btn-undo').waitFor();
  });
  await d.ctx.close();
  await test('brak błędów JavaScript w konsoli', async () => { assert(!errors.length, errors.join(' | ')); });
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} ok, ${fail} błędów`);
process.exit(fail ? 1 : 0);
