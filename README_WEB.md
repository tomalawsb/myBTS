# myBTS Web Pro 3.19 - 1905260655

Wersja web/PWA do przeglądania stacji BTS na mapie Leaflet.

## Najważniejsze zmiany 3.19


- Poprawiono GPS: przycisk działa jako przełącznik, a ręczne ustawienie punktu wyłącza śledzenie GPS.
- Ręczny punkt pomiarowy nie jest już nadpisywany kolejnymi odczytami GPS.
- Informacja o bazie pokazuje, czy zasięgi są orientacyjne z powodu braku azymutów, mocy i wysokości anten.
- Poprawiono przycisk „Źródła azymutu i mocy”.
- Poprawiono parser backendu SI2PEM: rozpoznaje nazwy pól, GeoJSON `geometry.coordinates`, `azimuth`, `eirp_dbm`, `antennaHeight`, `tilt` i technologie.
- Ukryto mylący przycisk „UKE online wyłączone”.
- Dodano panel „Automatyczne uzupełnianie SI2PEM”.
- Dodano zapis adresu własnego backendu SI2PEM.
- Dodano przyciski:
  - „Uzupełnij wybraną BTS”,
  - „Uzupełnij widoczne BTS z SI2PEM”.
- Dodano backend `backend_si2pem_proxy.py`, który trzyma token SI2PEM po stronie serwera.
- Dodano przykład konfiguracji `si2pem_backend_config.example.txt`.
- Dodano `backend_requirements.txt`.
- Frontend nie zapisuje tokenu API, tylko wysyła do backendu dane stacji: ID, operator, adres, pasma i współrzędne.

## Jak to działa

```text
myBTS PWA → Twój backend SI2PEM → SI2PEM REST API → backend normalizuje dane → myBTS dopisuje parametry do BTS
```

Aplikacja dopisuje tylko dane, które da się dopasować do stacji. Nie dopisuje parametrów na siłę.

## Uruchomienie aplikacji PWA na komputerze

Nie otwieraj samego `index.html` dwuklikiem. Uruchom lokalny serwer:

```bat
run_local.bat
```

albo ręcznie:

```bat
python -m http.server 8000
```

Potem wejdź w przeglądarce:

```text
http://localhost:8000
```

## Uruchomienie backendu SI2PEM

```bat
pip install -r backend_requirements.txt
set SI2PEM_TOKEN=TU_WKLEJ_TOKEN
set SI2PEM_API_BASE=https://si2pem.gov.pl
set SI2PEM_ENDPOINT_TEMPLATE=/api/TUTAJ_SCIEZKA_ZE_SWAGGERA?lat={lat}&lon={lon}&radius={radius_m}
uvicorn backend_si2pem_proxy:app --host 0.0.0.0 --port 8787
```

W aplikacji wpisz:

```text
http://localhost:8787
```

Następnie kliknij:

```text
Zapisz backend
Uzupełnij wybraną BTS
```

## Ważne

Do pełnego działania trzeba mieć token SI2PEM i konkretną ścieżkę endpointu ze Swaggera. Bez tego backend uruchomi się, ale zwróci komunikat, że brakuje `SI2PEM_TOKEN` albo `SI2PEM_ENDPOINT_TEMPLATE`.

## Aktualizacja głównej bazy UKE

Automatyczne pobieranie UKE bezpośrednio z frontendu zostało ukryte. Główna baza stacji dalej może być aktualizowana przez:

1. ręczny import ZIP/XLSX/CSV z UKE,
2. gotowy `stations.json`,
3. przyszły backend, który wygeneruje `stations.json` po stronie serwera.

## Import ręczny parametrów technicznych

Nadal działa import z:

```text
PDF / TXT / CSV / XLSX / JSON / XML / HTML / ZIP
```

Program próbuje wyciągnąć:

```text
azymut
moc / EIRP
wysokość anteny
pochylenie anteny
zasięg
pasma
źródło danych
```

PDF musi mieć warstwę tekstową. Skan-obraz bez OCR nie zostanie odczytany.
