# myBTS Web Pro 3.19 - 1905260655

## Zmienione pliki

- `app.js`
- `index.html`
- `style.css`
- `service-worker.js`
- `manifest.json`
- `backend_si2pem_proxy.py`

## Poprawki

1. GPS działa teraz jak przełącznik:
   - pierwsze kliknięcie uruchamia śledzenie,
   - drugie kliknięcie wyłącza śledzenie,
   - aktywny GPS jest oznaczony wizualnie na przycisku.

2. Ręczne ustawienie punktu pomiarowego wyłącza GPS:
   - punkt ręczny nie jest już nadpisywany kolejnymi odczytami GPS,
   - po kliknięciu mapy, PPM albo dłuższym przytrzymaniu mapa nie wraca samoczynnie do pozycji użytkownika.

3. Kompas/nawigacja bierze najpierw aktywny punkt pomiarowy:
   - jeśli ustawiono punkt ręczny, to on jest źródłem pomiaru,
   - GPS jest używany dopiero wtedy, gdy nie ma punktu ręcznego.

4. Informacja o bazie pokazuje, czy dane techniczne są realne:
   - jeśli brak azymutów, mocy i wysokości anten, aplikacja opisuje zasięgi jako orientacyjne.

5. Przycisk `Źródła azymutu i mocy` ma poprawiony opis:
   - nie udaje pobierania szablonu CSV,
   - otwiera dokumentację SI2PEM API i pokazuje właściwy komunikat.

6. Backend SI2PEM lepiej rozpoznaje dane z API:
   - analizuje nazwy pól i wartości,
   - obsługuje pola typu `azimuth`, `eirp_dbm`, `antennaHeight`, `tilt`, `technology`,
   - poprawnie odczytuje współrzędne GeoJSON z `geometry.coordinates`,
   - nie myli krótkich aliasów `x/y/lat/lon` z przypadkowymi nazwami pól.

## Sprawdzone technicznie

- `node --check app.js` — OK
- `node --check data-worker.js` — OK
- `node --check service-worker.js` — OK
- `python -m py_compile backend_si2pem_proxy.py` — OK
- test parsera backendu SI2PEM na przykładowym rekordzie z `azimuth`, `eirp_dbm`, `antennaHeight`, `tilt`, `geometry.coordinates` — OK

## Nie ruszane

- nie zmieniałem bazy `stations.json`,
- nie przebudowywałem wyglądu aplikacji,
- nie zmieniałem importów UKE,
- nie robiłem dużego podziału `app.js` na moduły, żeby nie zwiększać ryzyka nowych błędów.
