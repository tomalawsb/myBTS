# myBTS Web Pro 3.10 - 1205261740

Wersja web/PWA do przeglądania stacji BTS na mapie Leaflet.

## Najważniejsze zmiany 3.10

- Dodany import paczki ZIP z UKE, np. „pobierz wszystkie załączniki w formacie .zip”.
- Import bazy obsługuje teraz JSON / CSV / XLSX / ZIP.
- Przy problemie HTTP 403 / CORS aplikacja pokazuje wyraźny komunikat i kieruje do importu ręcznego.
- Dodane przyciski: „Otwórz stronę UKE” oraz „Skąd wziąć PDF”.
- Dodane ostrzeżenie, jeśli aplikacja jest uruchomiona jako `file://` zamiast przez lokalny serwer HTTP.
- PDF/TXT służy do uzupełniania parametrów wybranej stacji, np. pasm, mocy, azymutów, zasięgu, jeżeli raport zawiera takie dane tekstowe.

## Uruchomienie na komputerze

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

## Aktualizacja danych UKE

Przycisk „Aktualizuj z UKE online” próbuje pobrać dane bezpośrednio z dane.gov/BIP UKE. Część plików UKE bywa hostowana przez Box/app.box.com i przeglądarka może zablokować pobranie przez CORS albo HTTP 403.

Najpewniejsza metoda:

1. Kliknij „Otwórz stronę UKE”.
2. Pobierz „wszystkie załączniki w formacie .zip” albo wybrane arkusze XLSX.
3. W aplikacji kliknij „Import JSON / CSV / XLSX / ZIP”.
4. Wskaż pobrany ZIP/XLSX.

## Skąd brać PDF/TXT

PDF/TXT bierz z raportów pomiarowych albo SI2PEM. W aplikacji kliknij „Skąd wziąć PDF”, wyszukaj stację/raport w SI2PEM i pobierz raport, jeśli jest dostępny. PDF musi mieć warstwę tekstową. Skan-obraz bez tekstu nie zostanie odczytany bez OCR.
