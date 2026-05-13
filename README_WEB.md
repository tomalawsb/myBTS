# myBTS Web Pro 3.17 - 1305260732

Wersja web/PWA do przeglądania stacji BTS na mapie Leaflet.

## Najważniejsze zmiany 3.10

- Dodany import paczki ZIP z UKE, np. „pobierz wszystkie załączniki w formacie .zip”.
- Import bazy obsługuje teraz JSON / CSV / XLSX / XML / ZIP.
- Przy problemie HTTP 403 / CORS aplikacja pokazuje wyraźny komunikat i kieruje do importu ręcznego.
- Dodane przyciski: „Otwórz stronę UKE”, „SI2PEM / raporty PEM”, „Źródła azymutu i mocy” oraz „Pobierz szablon CSV parametrów”.
- Dodane ostrzeżenie, jeśli aplikacja jest uruchomiona jako `file://` zamiast przez lokalny serwer HTTP.
- PDF/TXT/CSV/XLSX/JSON/XML/ZIP służy do uzupełniania parametrów stacji: pasm, azymutów, mocy/EIRP, wysokości anteny, pochylenia i zasięgu, jeżeli dokument zawiera takie dane tekstowe.

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
3. W aplikacji kliknij „Import JSON / CSV / XLSX / XML / ZIP”.
4. Wskaż pobrany ZIP/XLSX.

## Skąd brać parametry techniczne

Najlepsze źródła uzupełniające to raporty/zgłoszenia PEM z SI2PEM, BIP gmin/powiatów oraz własny backend, który pobiera API SI2PEM i wystawia gotowy JSON/CSV. W aplikacji kliknij „SI2PEM / raporty PEM”, wyszukaj stację/raport i wgraj znaleziony PDF/TXT/CSV/XLSX/JSON/XML/ZIP przez „Uzupełnij parametry”. PDF musi mieć warstwę tekstową. Skan-obraz bez tekstu nie zostanie odczytany bez OCR.


## 3.11 - 1205261805
- Naprawiony import JSON/CSV/XLSX/XML/ZIP.
- Dodany awaryjny parser bez Web Workera.
- Dodany wbudowany odczyt ZIP/XLSX, gdy CDN/SheetJS/JSZip nie działa.
- Lepsze rozpoznawanie kolumn UKE: szerokość/długość WGS84, miejscowość, operator, pozwolenie, pasmo.


## 3.17 - 1305260732
- Dodany import parametrów technicznych z PDF/TXT/CSV/XLSX/JSON/XML/HTML/ZIP oraz z linku.
- Program uzupełnia teraz: azymuty, moc/EIRP, wysokość anteny, pochylenie anteny, zasięg i pasma.
- Dodany szablon CSV parametrów generowany z aplikacji.
- Dodane pola w szczegółach stacji: wysokość anteny, pochylenie anteny i jakość danych technicznych.
- Zmieniono mylący przycisk „Skąd wziąć PDF” na „SI2PEM / raporty PEM”.
- Przygotowano aplikację pod przyszły backend SI2PEM, bez dodawania tokenu/API bezpośrednio do frontendu.
