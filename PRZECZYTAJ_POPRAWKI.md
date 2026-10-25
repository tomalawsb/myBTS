# Wersja 3 v25.10.26.1235 — poprawki obsługi

Baza: DVBT-Point 3 v25.10.26.1052. Oryginalna paczka nie została zmieniona.

## Co poprawiono

- Komputer: wyszukiwarka, MUX i menu są nad panelem wyniku i nie są zasłaniane.
- Telefon pionowo: rozwinięcie szczegółów zachowuje wybór MUX-a, przyciski Zasięg i Ustaw antenę.
- Telefon poziomo (od 600 px szerokości, do 500 px wysokości): panel boczny, mapa obok, dostępne zakładki i działania.
- Komunikaty postępu znajdują się wewnątrz panelu, nie na przyciskach mapy. Widoczny jest postęp najważniejszego zadania i liczba pozostałych.
- Legenda ma ograniczoną wysokość i przewijaną treść. Opis techniczny jest rozwijany. Suwak ma prawidłową nazwę „Krycie warstwy”.
- Anulowanie nowego obszaru zachowuje poprzednią mapę i jednoznacznie podaje jej promień. Nie wyświetla starego wyniku jako nowego.
- Anulować można także przygotowanie obliczeń. Postęp nie przebudowuje formularza przy każdej aktualizacji.
- MUX-y podzielono na krajowe, lokalne i pozostałe. Brak numeru MUX-a jest opisany; oryginalne identyfikatory i dane zachowano.
- Ustawienia pokazują na pierwszym miejscu zysk anteny pasma wybranej emisji (VHF albo UHF).
- Zmieniono wersję cache PWA; zachowano magazyny instalacji i danych terenu. Android versionCode: 9.

## Uruchomienie

1. Rozpakuj ZIP do osobnego folderu.
2. Na Windows uruchom URUCHOM.cmd (wymaga Pythona 3). Otworzy http://localhost:8080/.
3. Nie otwieraj index.html bezpośrednio przez dwuklik — aplikacja korzysta z modułów i service workera.
4. Na hosting HTTPS/GitHub Pages skopiuj zawartość folderu DVBT-Point, w tym css/layout.css i service-worker.js.
5. Po aktualizacji istniejącej PWA odśwież ją. W Menu → O aplikacji sprawdź wersję 3 v25.10.26.1235. Nie trzeba usuwać zapisanych instalacji.

Paczka zawiera gotową aplikację WWW/PWA oraz projekt Android. Nie zawiera nowo skompilowanego APK.

## Weryfikacja

- 69 testów jednostkowych: wszystkie zakończone powodzeniem, w tym referencje P.1812 i spójność obliczeń.
- 23 testy E2E Chromium: wszystkie zakończone powodzeniem. Pokrywają gesty, wybór MUX/nadajnika, dostępność przycisków, legendę, anulowanie 60 km po wyniku 30 km, VHF, zapis instalacji, offline, powiększony tekst i różne układy ekranu.
- E2E korzystają z syntetycznego terenu i odpowiedzi usług. Rzeczywista blokada sieci sprawdza cache PWA; navigator.onLine jest dodatkowo symulowane, ponieważ użyty Chromium raportował true po przeładowaniu mimo blokady CDP.
- Dodatkowa ręczna kontrola w przeglądarce z rzeczywistymi usługami mapowymi i terenowymi: komputer 1440×900, telefon 390×844, 360×640 i 844×390.
- Nie testowano fizycznego GPS/kompasu ani nowego APK na urządzeniu Android.

Algorytm propagacji, pliki ANT i baza nadajników nie były zmieniane. To wydanie poprawia interfejs i zarządzanie zadaniami; nie stanowi nowej kalibracji modelu zasięgu.
