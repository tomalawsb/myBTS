# myBTS Web Pro 3.1 - 1205261410

Wersja przebudowana od początku pod układ mobilny i bibliotekę Leaflet.

## Najważniejsze zmiany

- Usunięto własny silnik mapy oparty o ręczne kafelki i `canvas`.
- Dodano Leaflet 1.9.4 jako normalną bibliotekę mapową.
- Dodano układ mobilny: mapa jako główny ekran + dolny wysuwany panel.
- Uproszczono górny pasek: GPS + menu, reszta funkcji jest w panelu.
- Dodano zakładki: Filtry, Lista, Szczegóły, Ustawienia.
- Dodano Web Worker do pobierania i parsowania JSON/CSV oraz przetwarzania arkuszy XLSX po odczycie przez SheetJS.
- Service worker nie cache'uje już dużego `stations.json`, żeby nie dublować ciężkiej bazy w cache i IndexedDB.
- Zachowano lokalną bazę w IndexedDB.
- Dodano widoczną atrybucję map przez kontrolkę Leaflet.

## Uruchamianie lokalne

Najpewniej uruchomić przez lokalny serwer HTTP, np.:

```bat
python -m http.server 8000
```

Następnie wejść w przeglądarce:

```text
http://localhost:8000
```

Bez serwera część przeglądarek może blokować `fetch`, Web Workera albo service workera.

## Uwaga

Leaflet i SheetJS są pobierane z CDN. Po pierwszym uruchomieniu service worker może je zachować w cache, ale pierwsze uruchomienie wymaga internetu.
