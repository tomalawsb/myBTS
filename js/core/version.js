// Jedno źródło wersji. Wersję aplikacji ustawia tools/set_version.py (BUILD/pakowanie).
export const APP_VERSION = '3 v25.10.26.1235';
// Wersja algorytmu geometrii/RF — zmienia się TYLKO przy zmianie obliczeń (unieważnia zapisane wyniki).
export const ALGO_VERSION = 'geo-rf-5.0-p1812';
// Wersja formatu plików eksportu wyniku.
export const RESULT_FORMAT_VERSION = 3;
// Oczekiwana wersja schematu bazy nadajników.
export const TX_SCHEMA_VERSION = 3;
// Przypięta implementacja P.1812 i dane referencyjne (sprawdzane testem tests/unit/version.test.mjs).
export const P1812_IMPL = { id: 'ITU-R P.1812-7 (port Py1812, OFCOM BSD-3)', file: 'js/core/p1812.js', sha256_16: '7a1937d153a3a15d' };
export const P1812_REFERENCE = { id: 'ITU-R SG3 validation profiles / Py1812.bt_loss', file: 'tests/fixtures/p1812-reference.json', sha256_16: 'b9a74064d61304f2' };
