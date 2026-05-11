# myBTS Web Pro — PWA v1

Pierwsza webowa wersja aplikacji myBTS przepisana z Kivy na HTML/CSS/JavaScript.

## Uruchomienie lokalne

Najpewniej uruchamiaj przez lokalny serwer HTTP, nie przez dwuklik na `index.html`:

```bat
python -m http.server 8000
```

Potem otwórz:

```text
http://localhost:8000
```

## Publikacja na GitHub Pages

Wrzuć wszystkie pliki z tego folderu do repozytorium i ustaw GitHub Pages na branch/folder z plikami.

## Zrobione w v1

- aplikacja webowa/PWA bez Kivy,
- mapa kafelkowa OSM i satelitarna ESRI,
- obsługa `stations.json`,
- pełna baza stacji z paczki źródłowej,
- filtrowanie po operatorze, paśmie, tekście i promieniu,
- GPS / „Moja pozycja”,
- punkt pomiarowy ustawiany z mapy,
- odległość i azymut do BTS,
- lista najbliższych stacji,
- szczegóły stacji,
- markery operatorów w kolorach,
- klastry na niższych zoomach,
- rysowanie sektorów i zasięgu orientacyjnego,
- użycie realnych `azimuths` i `range_km`, jeśli są w danych,
- zapis ustawień w przeglądarce,
- jasny motyw domyślny i opcjonalny ciemny,
- service worker i manifest PWA,
- ręczne wczytanie pliku JSON.

## Czego nie ma jeszcze w v1

- importu plików UKE XLSX/CSV bezpośrednio w przeglądarce,
- lokalnego SQLite z aplikacji Kivy,
- pobierania aktualizacji z Google Drive,
- pełnego offline dla kafelków mapy,
- zaawansowanej optymalizacji danych pod bardzo słabe telefony.

