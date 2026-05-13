# Etap 6-8 — notatki techniczne

## Etap 6 — CORS-proxy

Publiczne proxy zostały usunięte z aplikacji:

- `https://api.allorigins.win/raw?url=`
- `https://corsproxy.io/?`

Automatyczna aktualizacja UKE online jest teraz wyłączona stałą `UKE_ONLINE_IMPORT_ENABLED = false` w `app.js`.

Produkcja powinna działać w jednym z dwóch wariantów:

1. ręczny import ZIP/XLSX/CSV pobrany z UKE,
2. własny backend/proxy/cache, który pobierze pliki z UKE i udostępni je frontendowi z prawidłowym CORS.

Pobieranie z pola „Baza z linku” działa tylko bezpośrednio. Link musi mieć prawidłowe nagłówki CORS albo musi pochodzić z tego samego hostingu.

## Etap 7 — PWA

Dodano obowiązkowe ikony PNG:

- `icon-192.png`
- `icon-512.png`

`manifest.json` wskazuje teraz PNG oraz zachowuje `icon.svg` jako dodatkową ikonę.

## Etap 8 — duplikacja parsera

Parser pasm nadal jest zdublowany w:

- `app.js`
- `data-worker.js`

Dodano komentarze ostrzegawcze przy `VALID_NR_BANDS`. Przy każdej zmianie reguł parsera trzeba poprawiać oba pliki.

Docelowo warto wydzielić wspólny plik, np. `parser.js`, i ładować go w kodzie głównym oraz w workerze.


## Etap 9 — parametry techniczne BTS

Dodano ręczne i półautomatyczne uzupełnianie parametrów technicznych z PDF/TXT/CSV/XLSX/JSON/XML/HTML/ZIP oraz z linku. Obsługiwane pola: `azimuths`, `power`, `eirp_dbm`, `antenna_height_m`, `tilt_deg`, `range_km`, `bands`, `source`.

Bezpośrednie wywołanie SI2PEM API z frontendu nie zostało dodane, ponieważ token/API nie powinien być umieszczany w kodzie publicznej aplikacji PWA. Docelowy model: SI2PEM/BIP → własny backend/skrypt → JSON/CSV → myBTS.
