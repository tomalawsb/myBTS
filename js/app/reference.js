// Książka referencyjna. Treści statyczne; każda tabela ma źródło i warunki. DVB-T i DVB-T2 rozdzielone.
import { h, icon, setChildren } from './dom.js';

const table = (headers, rows, caption) => h('div', { class: 'table-wrap' }, h('table', { class: 'ref-table' },
  caption ? h('caption', {}, caption) : null,
  h('thead', {}, h('tr', {}, headers.map(x => h('th', { scope: 'col' }, x)))),
  h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));
const note = (title, text, kind = '') => h('div', { class: `note ${kind}` }, h('strong', {}, title), h('p', {}, text));
const source = text => h('p', { class: 'source' }, 'Źródło i warunki: ', text);
const historical = () => h('span', { class: 'badge badge-muted' }, 'historyczne');
const c = v => String(v).replace('.', ',');

const CN_DVBT = [ // ETSI EN 300 744 V1.6.1, tab. A.1: C/N [dB] dla BER 2·10⁻⁴ po dekoderze Viterbiego, bez strat implementacji
  ['QPSK', '1/2', 3.1, 3.6, 5.4], ['', '2/3', 4.9, 5.7, 8.4], ['', '3/4', 5.9, 6.8, 10.7], ['', '5/6', 6.9, 8.0, 13.1], ['', '7/8', 7.7, 8.7, 16.3],
  ['16-QAM', '1/2', 8.8, 9.6, 11.2], ['', '2/3', 11.1, 11.6, 14.2], ['', '3/4', 12.5, 13.0, 16.7], ['', '5/6', 13.5, 14.4, 19.3], ['', '7/8', 13.9, 15.0, 22.8],
  ['64-QAM', '1/2', 14.4, 14.7, 16.0], ['', '2/3', 16.5, 17.1, 19.3], ['', '3/4', 18.0, 18.6, 21.7], ['', '5/6', 19.3, 20.0, 25.3], ['', '7/8', 20.1, 21.0, 27.9]
];
const CN_DVBT2 = [ // orientacyjne, kanał Rice — zob. ETSI TR 102 831
  ['QPSK', '1/2', '≈ 1–2'], ['16-QAM', '1/2', '≈ 6–7'], ['64-QAM', '2/3', '≈ 13–15'], ['256-QAM', '2/3', '≈ 17–19'], ['256-QAM', '3/4', '≈ 19–21']
];

export const SECTIONS = [
  { id: 'channels', title: 'Kanały telewizyjne', desc: 'Częstotliwości środkowe VHF i UHF', kw: 'kanał raster mhz vhf uhf', render: () => [
    note('Raster kanałów', 'Częstotliwości środkowe kanałów. Używane kanały zależą od aktualnego planu i decyzji UKE.'),
    h('h3', {}, 'VHF pasmo III — raster 7 MHz'),
    table(['Kanał', 'f [MHz]'], Array.from({ length: 8 }, (_, i) => [String(i + 5), c((177.5 + 7 * i).toFixed(1))])),
    h('h3', {}, 'UHF — raster 8 MHz (pasmo IV: 21–37, pasmo V: 38–69)'),
    note('Uwaga', 'Kanały 49–69 nie są już używane przez telewizję naziemną w Polsce (przekazane usługom mobilnym) — tabela zawiera je dla starszych urządzeń i dokumentacji.', 'warn'),
    table(['Kanał', 'f [MHz]'], Array.from({ length: 49 }, (_, i) => [String(i + 21), String(474 + 8 * i)])),
    source('ITU/CEPT, plan GE06 — raster kanałów 7 MHz (VHF) i 8 MHz (UHF).')
  ] },
  { id: 'dab', title: 'Bloki DAB+', desc: 'Częstotliwości bloków w paśmie III', kw: 'dab radio blok', render: () => [
    table(['Blok', 'f [MHz]'], [['5A', '174,928'], ['5B', '176,640'], ['5C', '178,352'], ['5D', '180,064'], ['6A', '181,936'], ['6B', '183,648'], ['6C', '185,360'], ['6D', '187,072'], ['7A', '188,928'], ['7B', '190,640'], ['7C', '192,352'], ['7D', '194,064'], ['8A', '195,936'], ['8B', '197,648'], ['8C', '199,360'], ['8D', '201,072'], ['9A', '202,928'], ['9B', '204,640'], ['9C', '206,352'], ['9D', '208,064'], ['10A', '209,936'], ['10B', '211,648'], ['10C', '213,360'], ['10D', '215,072'], ['11A', '216,928'], ['11B', '218,640'], ['11C', '220,352'], ['11D', '222,064'], ['12A', '223,936'], ['12B', '225,648'], ['12C', '227,360'], ['12D', '229,072'], ['13A', '230,784'], ['13B', '232,496'], ['13C', '234,208'], ['13D', '235,776'], ['13E', '237,488'], ['13F', '239,200']]),
    source('ETSI EN 300 401, tabela częstotliwości bloków pasma III.')
  ] },
  { id: 'dvbt', title: 'DVB-T — wymagany C/N', desc: 'Tryb 8k, wartości teoretyczne', kw: 'dvb-t snr cnr c/n fec qam', render: () => [
    note('Warunki', 'C/N dla BER = 2·10⁻⁴ po dekoderze Viterbiego (QEF po Reed-Solomonie), bez strat implementacji odbiornika. W praktyce dodaj 2–4 dB. Nie ma jednego progu dla wszystkich: zależy od modulacji, FEC i rodzaju kanału.'),
    table(['Modulacja', 'FEC', 'Gauss [dB]', 'Rice [dB]', 'Rayleigh [dB]'], CN_DVBT.map(r => [r[0], r[1], c(r[2]), c(r[3]), c(r[4])])),
    note('Który kanał?', 'Gauss — idealna antena kierunkowa bez odbić; Rice — typowy odbiór stacjonarny z anteną na dachu; Rayleigh — odbiór pokojowy/przenośny bez bezpośredniej widoczności.'),
    source('ETSI EN 300 744, załącznik A, tab. A.1 (DVB-T, wartości symulacyjne).')
  ] },
  { id: 'dvbt2', title: 'DVB-T2 — wymagany C/N', desc: 'Wartości orientacyjne LDPC/BCH', kw: 'dvb-t2 t2 ldpc 256qam c/n', render: () => [
    note('Warunki', 'DVB-T2 korzysta z kodowania LDPC+BCH — nie ma tu BER „przed Viterbim”. Wymagany C/N zależy od modulacji, FEC, wzoru pilotów, rotacji konstelacji i odbiornika. Poniższe wartości są orientacyjne (kanał Rice, bez strat implementacji); dla konkretnej konfiguracji sprawdź dokument nadawcy i normę.', 'warn'),
    table(['Modulacja', 'FEC', 'C/N ≈ [dB]'], CN_DVBT2),
    source('ETSI TR 102 831 (DVB-T2 Implementation Guidelines) — wartości zaokrąglone, orientacyjne ±1–2 dB.')
  ] },
  { id: 'levels', title: 'Poziomy na gnieździe', desc: 'Zakresy w instalacjach zbiorczych', kw: 'poziom gniazdo dbuv', render: () => [
    note('Warunki', 'Orientacyjne zakresy poziomu sygnału na gnieździe abonenckim (75 Ω) dla DVB-T z dawnych wytycznych instalacyjnych. Dla DVB-T2 minimum zależy od konfiguracji — oceniaj przede wszystkim MER/C/N i błędy pakietów, a poziom trzymaj w zakresie pracy tunera (typowo ok. 45–70 dBµV).'),
    table(['Modulacja DVB-T', 'FEC', 'Min. [dBµV]', 'Maks. [dBµV]'], [['QPSK', '1/2–7/8', '26–35', '74'], ['16-QAM', '1/2–7/8', '32–45', '74'], ['64-QAM', '1/2–7/8', '42–54', '74']]),
    h('p', {}, historical(), ' Reguła „DVB-T co najmniej 9 dB poniżej nośnej PAL” dotyczy instalacji z analogową telewizją — w Polsce TV analogowa została wyłączona w 2013 r.'),
    source('PN-EN 60728-1 (instalacje kablowe) i wytyczne instalacyjne z okresu DVB-T/PAL; wartości przybliżone.')
  ] },
  { id: 'isolation', title: 'Odstępy i separacja', desc: 'Różnice poziomów i tłumienność gniazd', kw: 'separacja różnice tłumienność', render: () => [
    table(['Sytuacja', 'Wartość'], [['Różnica poziomów sąsiednich kanałów cyfrowych', '≤ 3 dB'], ['Tłumienność wzajemna gniazd TV/TV (174–790 MHz)', '≥ 30–42 dB'], ['Tłumienność wzajemna TV/Radio', '≥ 50 dB']]),
    h('p', {}, historical(), ' Wymagania dotyczące kanałów PAL (AM-VSB) pominięto — nieaktualne.'),
    source('PN-EN 60728-1; wartości minimalne, zależą od klasy instalacji.')
  ] },
  { id: 'mer', title: 'MER', desc: 'Jak oceniać jakość modulacji', kw: 'mer jakość modulacji', render: () => [
    note('Zasada', 'MER powinien przewyższać wymagany C/N danej konfiguracji z zapasem. Przykład: DVB-T 64-QAM 2/3 (Rice ≈ 17 dB) — dobry odbiór przy MER ≥ 23–26 dB; DVB-T2 256-QAM 2/3 (≈ 18–19 dB) — dobry przy MER ≥ 24–27 dB. Jedna wartość dla wszystkich systemów nie istnieje.'),
    source('ETSI TR 101 290 (definicja MER); progi praktyczne — orientacyjne.')
  ] },
  { id: 'ber', title: 'BER i błędy', desc: 'DVB-T (Viterbi/RS) i DVB-T2 (LDPC/BCH)', kw: 'ber qef viterbi ldpc', render: () => [
    h('h3', {}, 'DVB-T'),
    table(['Miejsce pomiaru', 'Typowy próg'], [['BER przed Viterbim', '< 10⁻² (im mniej, tym lepiej)'], ['BER po Viterbim (przed RS)', '< 2·10⁻⁴ — granica QEF'], ['Po Reed-Solomonie', 'QEF ≈ 10⁻¹¹']]),
    h('h3', {}, 'DVB-T2'),
    note('Inaczej niż DVB-T', 'Mierniki pokazują BER przed LDPC/po LDPC, iteracje LDPC lub liczbę błędnych ramek BB/pakietów. Właściwym kryterium jest brak błędów po BCH (QEF) i zapas MER.'),
    source('ETSI EN 300 744 (DVB-T), ETSI EN 302 755 (DVB-T2).')
  ] },
  { id: 'constellations', title: 'Konstelacje', desc: 'Jak czytać obraz konstelacji', kw: 'konstelacja qam szum faza', render: () => [
    note('Jak czytać', 'Punkty powinny tworzyć zwarte, regularne skupiska. Rozmycie = szum, obrót/łuki = błędy fazy, rozciągnięcie promieniowe = błędy amplitudy/kompresja.'),
    h('div', { class: 'const-grid' }, ['normal', 'phase', 'amplitude', 'noise'].map(t => constellation(t)))
  ] }
];
const CONST_TEXT = { normal: ['Prawidłowa', 'Zwarte, równe skupiska'], phase: ['Błędy fazy', 'Skupiska obrócone po łukach'], amplitude: ['Błędy amplitudy', 'Rozciągnięcie od środka'], noise: ['Szum', 'Szerokie, rozmyte skupiska'] };
function constellation(type){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 236 236'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Konstelacja: ' + CONST_TEXT[type][0]);
  const grid = [34, 58, 82, 106, 130, 154, 178, 202];
  const dot = (x, y, r, cls) => { const e = document.createElementNS(ns, 'circle'); e.setAttribute('cx', x.toFixed(1)); e.setAttribute('cy', y.toFixed(1)); e.setAttribute('r', r); if (cls) e.setAttribute('class', cls); svg.append(e); };
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++){
    const x = grid[col], y = grid[row];
    if (type === 'normal') dot(x, y, 3.6);
    else if (type === 'phase'){ const a = ((row * 5 + col * 3) % 7 - 3) * 0.02; const cx = 118, cy = 118; dot(cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a), 3.2); }
    else if (type === 'amplitude'){ const s = 1 + (((row + col) % 5) - 2) * 0.04; dot(118 + (x - 118) * s, 118 + (y - 118) * s, 3.1); }
    else for (let n = 0; n < 3; n++) dot(x + ((row * 11 + col * 7 + n * 13) % 11 - 5) * 1.25, y + ((row * 7 + col * 13 + n * 5) % 11 - 5) * 1.25, 2.1);
  }
  return h('figure', { class: 'const-card' }, svg, h('figcaption', {}, h('strong', {}, CONST_TEXT[type][0]), ' — ', CONST_TEXT[type][1]));
}
export function renderBook(container, back){
  const list = h('div', { class: 'list' });
  const input = h('input', { type: 'search', class: 'input', placeholder: 'Szukaj zagadnienia', 'aria-label': 'Szukaj w książce' });
  const showList = q => {
    const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const items = SECTIONS.filter(s => !q || norm(`${s.title} ${s.desc} ${s.kw}`).includes(norm(q)));
    setChildren(list, items.length ? items.map(s => h('button', { type: 'button', class: 'list-item', onclick: () => showSection(s) }, h('span', { class: 'li-main' }, h('strong', {}, s.title), h('small', {}, s.desc)), icon('chevronRight'))) : h('p', {}, 'Brak wyników.'));
  };
  const showSection = s => {
    setChildren(container, h('button', { type: 'button', class: 'btn btn-tertiary', onclick: () => render() }, h('span', {}, '← Spis treści')), h('h3', { class: 'section-title' }, s.title), ...s.render());
    container.querySelector('button')?.focus();
  };
  const render = () => { setChildren(container, note('Podręczna wiedza', 'Dane referencyjne — końcową ocenę instalacji potwierdź pomiarem miernikiem.'), input, list); showList(input.value); };
  input.addEventListener('input', () => showList(input.value));
  render();
}
