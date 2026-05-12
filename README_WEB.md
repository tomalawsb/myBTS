# myBTS Web Pro 3.7 - 1205261555

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
- Ustabilizowano kompas: wygładzanie odczytów, ograniczenie częstotliwości odświeżania i ignorowanie zdublowanych zdarzeń orientacji.
- Okienko BTS na mapie zostaje przypięte po kliknięciu nadajnika i nie znika przy odświeżaniu markerów/GPS/kompasu.
- Aktualizacja z UKE próbuje pobrać dane przez dane.gov, BIP UKE oraz zapasową ścieżkę proxy, gdy przeglądarka blokuje CORS.

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


## Zmiany 3.6
- Widoczny komunikat aktualizacji UKE na mapie.
- Pasek postępu pobierania arkuszy UKE.
- Blokada podwójnego kliknięcia podczas aktualizacji.
- Informacja o sukcesie albo błędzie zostaje pokazana użytkownikowi.

## Zmiany 3.7
- Dodano gradient zasięgu BTS: najmocniejszy kolor blisko nadajnika, słabszy na granicy zasięgu.
- Jeżeli są azymuty, gradient jest rysowany jako sektory kierunkowe.
- Jeżeli nie ma azymutu, aplikacja pokazuje orientacyjne koła zasięgu.
- Zasięg może być korygowany mocą/EIRP, jeśli taka informacja jest w bazie.
- Popup BTS pokazuje źródło pewności zasięgu i przycisk „Uzupełnij z UKE”.
