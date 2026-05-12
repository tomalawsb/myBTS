# myBTS Web Pro 3.8 - 1205261630

Wersja przebudowana od początku pod układ mobilny i bibliotekę Leaflet.

## Najważniejsze zmiany

- Usunięto własny silnik mapy oparty o ręczne kafelki i `canvas`.
- Dodano Leaflet 1.9.4 jako normalną bibliotekę mapową.
- Dodano układ mobilny: mapa jako główny ekran + dolny wysuwany panel.
- Uproszczono górny pasek: zostało samo wyszukiwanie, GPS przeniesiono na przezroczysty przycisk na mapie, opcje są wysuwane dolnym uchwytem.
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

## Zmiany 3.8
- Zmniejszono aplet/popup BTS na mapie.
- Usunięto krzyżyk zamykania popupu; zamykanie działa kliknięciem obok na mapie.
- Usunięto przycisk menu z trzema kreskami z górnego paska.
- Opcje na telefonie otwiera się przez przeciągnięcie dolnego uchwytu panelu.
- Przycisk OK w wyszukiwarce jest ukryty, Enter nadal uruchamia szukanie.
- Krzyżyk czyszczenia wyszukiwarki pokazuje się dopiero po wpisaniu tekstu.
- GPS jest osobnym, przezroczystym przyciskiem na mapie.
