# myBTS Web Pro v2

Pierwsza poprawiona wersja web/PWA po przepisaniu z kierunku Kivy na HTML/CSS/JavaScript.

## Uruchomienie lokalne

Kliknij `run_local.bat`, potem otwórz:

`http://localhost:8000`

Nie uruchamiaj przez dwuklik na `index.html`, bo przeglądarka może blokować wczytanie `stations.json`.

## Zrobione w v2

- PWA bez Kivy.
- Mapa OSM i satelitarna.
- GPS, punkt pomiarowy, odległość i azymut.
- Klastry markerów.
- Sektory orientacyjne i realne azymuty, jeśli są w danych.
- Import JSON.
- Import CSV.
- Import XLSX/XLS przez SheetJS z CDN.
- Pobieranie bazy z linku JSON/CSV/XLSX.
- Obsługa linków Google Sheets jako CSV.
- Próba obsługi publicznych linków Google Drive i Dropbox.
- IndexedDB: zapamiętanie aktywnej bazy w przeglądarce.
- Przycisk czyszczenia zapisanej bazy.
- Indeks przestrzenny, żeby filtrowanie widoku nie musiało za każdym razem sprawdzać całych 46k stacji.

## Ważne ograniczenia

- Pełny import XLSX wymaga dostępu do biblioteki SheetJS z CDN. Bez internetu działa nadal JSON/CSV i zapisana baza.
- Publiczny link Google Drive/Dropbox może zostać zablokowany przez CORS albo uprawnienia pliku. Najpewniejszy jest raw JSON/CSV albo Google Sheets opublikowany jako CSV.
- Kafelki mapy pełnego offline nadal nie są pakowane lokalnie. Aplikacja działa offline, ale mapa wymaga kafelków pobranych wcześniej lub internetu.
