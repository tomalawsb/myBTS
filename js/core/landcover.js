// Pokrycie terenu CORINE Land Cover 2018 (Copernicus/EEA, raster 100 m) → wysokość klutteru R i typ dla ITU-R P.1812 / P.2108.
// Wysokości reprezentatywne wg ITU-R P.1812-7 Tab. 2 / P.2108 (miejska gęsta 20 m, podmiejska 10 m, las 15 m), uproszczone do klas CLC.
const C = (code, rgb, R, type, label) => ({ code, rgb, R, type, label });
export const CLC = [
  C(111, [230, 0, 77], 20, 'urban', 'zabudowa zwarta'), C(112, [255, 0, 0], 10, 'suburban', 'zabudowa luźna'),
  C(121, [204, 77, 242], 15, 'urban', 'przemysł/usługi'), C(122, [204, 0, 0], 0, 'open', 'drogi/kolej'),
  C(123, [230, 204, 204], 10, 'suburban', 'porty'), C(124, [230, 204, 230], 0, 'open', 'lotniska'),
  C(131, [166, 0, 204], 0, 'open', 'wyrobiska'), C(132, [166, 77, 0], 0, 'open', 'składowiska'), C(133, [255, 77, 255], 5, 'suburban', 'budowy'),
  C(141, [255, 166, 255], 10, 'trees', 'zieleń miejska'), C(142, [255, 230, 255], 0, 'open', 'tereny sportowe'),
  C(211, [255, 255, 168], 0, 'open', 'grunty orne'), C(212, [255, 255, 0], 0, 'open', 'grunty nawadniane'), C(213, [230, 230, 0], 0, 'open', 'ryżowiska'),
  C(221, [230, 128, 0], 2, 'open', 'winnice'), C(222, [242, 166, 77], 4, 'trees', 'sady'), C(223, [230, 166, 0], 4, 'trees', 'gaje oliwne'),
  C(231, [230, 230, 77], 0, 'open', 'łąki/pastwiska'), C(241, [255, 230, 166], 0, 'open', 'uprawy mieszane'), C(242, [255, 230, 77], 2, 'open', 'mozaika upraw'),
  C(243, [230, 204, 77], 4, 'open', 'rolnictwo z roślinnością'), C(244, [242, 204, 166], 10, 'trees', 'rolno-leśne'),
  C(311, [128, 255, 0], 15, 'trees', 'las liściasty'), C(312, [0, 166, 0], 15, 'trees', 'las iglasty'), C(313, [77, 255, 0], 15, 'trees', 'las mieszany'),
  C(321, [204, 242, 77], 0, 'open', 'murawy'), C(322, [166, 255, 128], 1, 'open', 'wrzosowiska'), C(323, [166, 230, 77], 2, 'open', 'roślinność twardolistna'),
  C(324, [166, 242, 0], 8, 'trees', 'lasy w stadium zmian'), C(331, [230, 230, 230], 0, 'open', 'plaże/wydmy'), C(332, [204, 204, 204], 0, 'open', 'skały'),
  C(333, [204, 255, 204], 0, 'open', 'roślinność rozproszona'), C(334, [0, 0, 0], 0, 'open', 'pogorzeliska'), C(335, [166, 230, 204], 0, 'open', 'lodowce'),
  C(411, [166, 166, 255], 0, 'open', 'bagna'), C(412, [77, 77, 255], 0, 'open', 'torfowiska'), C(421, [204, 204, 255], 0, 'open', 'słone bagna'),
  C(422, [230, 230, 255], 0, 'open', 'saliny'), C(423, [166, 166, 230], 0, 'sea', 'pływy'),
  C(511, [0, 204, 242], 0, 'water', 'cieki'), C(512, [128, 242, 230], 0, 'water', 'zbiorniki wodne'),
  C(521, [0, 255, 166], 0, 'sea', 'laguny'), C(522, [166, 255, 230], 0, 'sea', 'estuaria'), C(523, [230, 242, 255], 0, 'sea', 'morze')
];
const byRgb = new Map(CLC.map(c => [(c.rgb[0] << 16) | (c.rgb[1] << 8) | c.rgb[2], c]));
const byCode = new Map(CLC.map(c => [c.code, c]));
/** Kod CLC z koloru piksela (eksport rastra EEA ma dokładne kolory legendy); 0 = brak danych/nieznany. */
export const clcFromRgb = (r, g, b) => byRgb.get((r << 16) | (g << 8) | b)?.code || 0;
export const clcInfo = code => byCode.get(code) || null;
export const clutterHeight = code => byCode.get(code)?.R ?? 0;
/** Strefa radioklimatyczna P.1812: 1 = morze, 4 = ląd (strefa 3 — przybrzeżna — nie jest wyznaczana; uproszczenie). */
export const radioZone = code => byCode.get(code)?.type === 'sea' ? 1 : 4;
