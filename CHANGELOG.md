## 3 v25.10.26.1235 — poprawki UX

Naprawa nagłówka desktopowego, panel telefonu poziomo, stały dostęp do działań, kompaktowa legenda, jawne parametry zachowanego wyniku po anulowaniu, grupy MUX i ustawienia VHF/UHF. 69 testów jednostkowych i 23 E2E zakończone powodzeniem. Szczegóły: PRZECZYTAJ_POPRAWKI.md.

# Zmiany

## 3 v25.10.26.1052 — najpierw mapa: prosty panel, liczby w „Szczegółach” (versionCode 8)
- **Panel podsumowania**: nadajnik, duży azymut z kierunkiem (np. 47° NE), polaryzacja, przyciski „Zasięg” i „Ustaw antenę”. Mapa zajmuje >50% ekranu 360×640.
- **Szczegóły**: zakładki Wynik / Instalacja / Teren / Dane, proste wiersze zamiast kafli. Dane techniczne schowane w „Szczegóły techniczne”. Widoczny pasek przewijania i podpowiedź „przewiń ↓”, bez zagnieżdżonego przewijania.
- **Mapa**: wyraźniejsza linia kierunku anteny (z białym obrysem). Legenda zasięgu domyślnie zwinięta i zawsze klikalna.
- **Zasięg**: okno zamyka się samo po obliczeniu. W trybie „Okolica punktu” nie pokazuje się już mylący promień wokół nadajnika. Sposób kolorowania przeniesiony do „Więcej”. Ranking nie podmienia nadajnika, gdy obliczono już mapę zasięgu.
- **Postęp**: jedna mała etykieta z przyciskiem przerwania, która nie zasłania przycisku MUX. Usunięty drugi, niespójny licznik.
- **Wybór MUX**: prosta lista z kanałem, miastem i znacznikiem ✓.
- **Ustawienia**: na wierzchu tylko system, zysk anteny UHF i straty kabla. Reszta w „Zaawansowane”.
- **Komunikaty**: wyświetlane u góry ekranu, nie zasłaniają okien ani panelu.
- **Testy E2E**: mapa >50% w podsumowaniu (360×640), pełne przewinięcie każdej zakładki, zwinięta legenda, samozamykanie okna zasięgu.

## 3 v25.10.26.0946 — wybór MUX-a zawsze widoczny, przytrzymanie zamiast kliknięcia, mapa pola, raport obliczeń (versionCode 7)
- **MUX**:
  - Stały przycisk „MUX: [wybrany] ▾” otwiera siatkę wszystkich MUX-ów.
  - Zmiana nadajnika zachowuje MUX (np. Święty Krzyż → Tarnobrzeg: MUX-3 zostaje). Gdy nadajnik nie nadaje danego MUX-a, pojawia się komunikat.
  - Ranking liczony jest dla każdego MUX-a osobno: 14 kandydatów w promieniu 120 km i przycisk „Sprawdź kolejne”. Ręczny wybór nie jest nadpisywany.
  - Słabe nadajniki pozostają na liście. Statusy: sprawdzony — słaby wynik / jeszcze niesprawdzony / brak danych.
  - Lista nadajników: filtr MUX; każdy wiersz pokazuje nazwę, kanał, wariant, odległość, azymut i zapas. Wyszukiwanie dowolnego nadajnika.
- **Ustawianie punktu**:
  - Dotknięcie, przesunięcie ani zoom nie przesuwają punktu. Punkt ustawia przytrzymanie 600 ms (ruch ≤ 10 px), z pierścieniem postępu i blokadą kliknięcia.
  - Pinezki nie da się przeciągać. Po zmianie punktu przez 8 s widoczny jest pasek „Cofnij”.
  - Na komputerze: menu prawego przycisku „Ustaw punkt tutaj”. Dostępne też okno „Zmień lokalizację” i podpowiedź „Przytrzymaj mapę, aby ustawić punkt”.
- **Panel**:
  - Przycisk „Rozwiń szczegóły”/„Zwiń” (aria-expanded) i trzy stany: zwinięty / podsumowanie / 85%.
  - Przyciski „Zasięg” i „Ustaw antenę” są poza obszarem przewijania.
  - Sekcje: Wynik / Instalacja / Profil terenu / Dane obliczeń.
  - Na ekranach ≥ 900 px panel boczny ma szerokość 380 px.
- **Okno „Zasięg”**: wybór obszaru (nadajnik albo okolica punktu 1 km), promień 30/60/100 km, widok pole/zapas, przyciski Oblicz / postęp / Przerwij.
- **Mapa zasięgu**:
  - Domyślnie pokazuje natężenie pola w progach 48/53/60/65/70/74/85 dBµV/m. Widok zapasu przełącza się bez ponownego liczenia.
  - Legenda podaje MUX, kanał, nadajnik, jednostkę i model. Suwak krycia, domyślnie 45%.
  - Dotknięcie mapy odczytuje wartość bez przesuwania punktu. Poza obszarem widać okrąg granicy i napis „Nie obliczono”.
  - Udziały procentowe liczone są tylko z obliczonych komórek: „Dodatni zapas modelowy na N% obliczonego obszaru”.
- **Obliczenia**:
  - P.1812 jest domyślny i używa jednego zestawu parametrów. Model uproszczony („Uproszczony — bez pełnego uwzględnienia warunków propagacji”) jest w ustawieniach zaawansowanych.
  - Rozdzielczość źródła terenu i krok próbkowania pokazywane są osobno. Braki danych są widoczne w interfejsie.
  - Przypięta wersja implementacji P.1812 i danych referencyjnych. `ALGO_VERSION = geo-rf-5.0-p1812`; zapisane instalacje zostają i są przeliczane.
- **Raport**: `tools/compare.mjs` i `docs/RAPORT_OBLICZEN.md` (stary algorytm / Deygout / P.1812 dla 5 punktów, wyjaśnienie 92,9 dBµV/m).
- **Wygląd**: jasny motyw, jeden niebieski kolor akcji, cele dotyku ≥ 48 px, ikona z etykietą, odstępy 8/16/24.
- **Testy**: 69 jednostkowych i 20 E2E (360×640, poziomo, 1280, tekst 130%, offline). Wyniki w `docs/WYNIKI_TESTOW.md`.

## 3 v25.10.26.0050 — wybór MUX-a, realistyczne kolory zasięgu, płynność (versionCode 6)
- **Wybór multipleksu**: pod nazwą nadajnika w panelu wyniku lista kafelków MUX (nazwa, kanał K, MHz, polaryzacja, ERP, zapas z oceny) — dotknięcie przelicza analizę dla tego MUX-a. Zakładka Nadajnik: kliknięcie nadajnika nie przenosi już od razu na mapę, tylko pokazuje kartę z listą MUX-ów + przycisk „Pokaż analizę na mapie”; tabela emisji w rozwijanych szczegółach.
- **Mapa zasięgu (obszar i okolica) liczona ITU-R P.1812 + CORINE** — tym samym modelem co analiza punktu (wcześniej wolna przestrzeń + Deygout, zbyt optymistycznie, zielono przy przysłoniętym Fresnelu). Węzły co ~R/140 km na promieniu, 360 promieni, w Web Workerze, z anulowaniem.
- **Skala kolorów**: progi zapasu 0 / 10 / 20 dB (uwzględniają zmienność lokalizacyjną σ≈5,5 dB; wcześniej 0/6/15). Legenda pokazuje progi w dBµV/m. `ALGO_VERSION = geo-rf-4.1-p1812`.
- **Płynność**: kropki nadajników aktualizowane przyrostowo (bez przebudowy 274 markerów), zbijanie do klatki; zapis ustawień zbiorczy (debounce); +/− wysokości z opóźnieniem 350 ms; skan oddaje wątek UI między nadajnikami; Leaflet preferCanvas.
- Testy: `realism.test.mjs` (100 km/10 kW nie jest „dobry”), E2E: wybór MUX-a, obszar P.1812 w workerze z legendą dBµV/m.

## 3 v24.10.26.2256 — ITU-R P.1812, klutter CORINE, NMT GUGiK (versionCode 5; zawiera zmiany z 3 v24.10.26.2242)
- **Model ITU-R P.1812-7 domyślnie** (`js/core/p1812.js`, port Py1812/OFCOM, BSD-3): delta-Bullington, propagacja anomalna, troposcatter, 50% czasu / 50% lokalizacji, ΔN = 45, N0 = 320 (stałe dla Polski). Przełącznik w Ustawieniach odbioru: „ITU-R P.1812” ↔ „uproszczony (Deygout)”. 24 przypadki referencyjne z profili walidacyjnych ITU-R SG3 (wartości oczekiwane z Py1812), zgodność ±0,1 dB.
- **Klutter**: pokrycie terenu CORINE Land Cover 2018 (EEA, 100 m) wzdłuż profilu (wysokości reprezentatywne R wg P.1812, strefa radiometeorologiczna morze/ląd) + strata klutteru przy odbiorniku wg ITU-R P.2108 §3.1; 150 m przy końcach trasy bez R (bez podwójnego liczenia). Cache kafli `dvbt-point-clc-v1`. ESA WorldCover niedostępny z WMS — nie używany.
- **NMT GUGiK 1 m** (online, analiza punktu): wysokości z usługi GetHByPointList (PUWG-1992, `js/core/puwg92.js`), partie po 400 punktów, kontrola spójności (liczba punktów, wartości 0, odchyłka > 40 m od DEM), akceptacja przy ≥ 90% punktów; inaczej / offline / poza Polską — DEM Terrarium ~30 m. Cache `dvbt-point-nmt-v1`, anulowanie przy zmianie punktu.
- **Opis źródeł w wyniku**: linia „Model: … · Teren: … · Pokrycie: …” na karcie, tabela „Model i dane” w Parametrach, eksport JSON (model, źródła, składowe P.1812), Diagnostyka (model, czyszczenie cache NMT/CORINE).
- Mapa zasięgu okolicy nadal liczona modelem uproszczonym (oznaczone w legendzie). CSP: dodane image.discomap.eea.europa.eu i services.gugik.gov.pl. `ALGO_VERSION = geo-rf-4.0-p1812` (zapisane wyniki przeliczane).
- Testy: `p1812.test.mjs`, `propagation.test.mjs`, `puwg92.test.mjs`; E2E: linia modelu i danych, przełączanie modelu (atrapy CORINE/NMT).

## 3 v24.10.26.2242 — kolory nadajników, etykiety na satelicie, nowa ikona (versionCode 5)
- **Kropki nadajników wg odbioru w punkcie** (wynik skanu): ++ ciemnozielony duży zapas (≥15 dB), + zielony dobry (≥6 dB), ! bursztyn na granicy (0–6 dB, przerywana obwódka), × czerwony poniżej minimum, ? szary nieobliczony/brak danych, ★ polecany (złota obwódka), wybrany z niebieską ramką. Te same progi/kolory co legenda zasięgu (`MARGIN_BANDS`); symbol + styl obwódki (kolor nie jest jedyną informacją); legenda w zakładce Nadajnik; odświeżane po zmianie punktu. Nowy moduł `js/core/txstyle.js`.
- **Poprawka filtra „Tylko w zasięgu”**: w trakcie skanu mapa pokazywała wszystkie nadajniki (niebieskie). Teraz w trakcie skanu tylko kandydaci (szare „…”), po skanie wyłącznie nadajniki z zapasem ≥ 0 dB + aktualnie wybrany.
- **Satelita z nazwami miejscowości**: nakładka Esri Reference (World_Boundaries_and_Places + World_Transportation: miejscowości, granice, drogi) z atrybucją; domyślnie włączona, przełącznik w oknie Warstwy.
- **Nowa ikona**: maszt nadawczy z falami i bursztynowym nadajnikiem na gradiencie #155BDD; PNG 192/512, maskable 512, favicon 32, adaptive icon Androida (foreground/background/monochrome, mdpi–xxxhdpi, roundIcon).
- Testy: `txstyle.test.mjs`, E2E: kolory/filtr/legenda kropek, nakładka etykiet satelity. Obliczenia RF i dane bez zmian.

## 3 v24.10.26.2221 — poprawki po testach na Motorola Edge 50 Ultra (versionCode 4)
- **Okolica 1 km**: zwijana legenda (chip z paskiem kolorów i % odbioru), panel dolny po mapie zasięgu obniżany do 200 px.
- **Kompas natywny (Android)**: `NativeCompass` — ROTATION_VECTOR, rezerwowo akcelerometr+magnetometr; `remapCoordinateSystem` wg obrotu ekranu; deklinacja z `GeomagneticField`; wygładzanie kołowe; dokładność z magnetometru; ~20 Hz do JS (`window.__nativeCompass`); prośba o kalibrację „ósemką”. JS preferuje mostek `DVBTNative`, w przeglądarce bez zmian (deviceorientation).
- **Róża kompasu na mapie**: stały przycisk z N, igłą kierunku telefonu i znacznikiem kierunku nadajnika; stożek kierunku przy punkcie; kliknięcie otwiera „Ustaw antenę”.
- **Wygląd**: ikony Lucide (obrys 2 px), przyciski 48 px z cieniem i stanem wciśnięcia, akcent #155BDD.
- **Panel**: płynne przeciąganie uchwytem (pointer events) na dowolną wysokość, delikatne przyciąganie tylko przy min/max, zapamiętana wysokość, tapnięcie nie powoduje skoku; obsługa klawiatury.
- **Wstecz**: zamyka okna/listy/zakładki i obniża panel; na mapie pierwszy raz komunikat „Naciśnij ponownie, aby wyjść”, drugi w 2 s zamyka aplikację (Android: `MainActivity` → `handleBack()`; PWA: History API).
- **Nadajniki „Tylko w zasięgu” (domyślnie) / „Wszystkie”**: skan kandydatów do 120 km (LOS/Fresnel, zapas sygnału, cache, postęp), ranking zapas → liczba MUX → widoczność, oznaczenie „Polecany” na liście, karcie i mapie; ręczny wybór ma pierwszeństwo. Nowy moduł `js/core/rank.js`. Obliczenia RF bez zmian.
- Testy: `rank.test.mjs`, `native-compass.test.mjs`, nowe scenariusze E2E (skan/Polecany, róża kompasu, Wstecz, przeciąganie panelu).
- Android: AGP 8.10.1 / Gradle 8.11.1 (zgodne z lokalnym cache), `versionCode 4`.

## 3 v24.10.26 — przebudowa (wszystkie 15 etapów)
### 1. Porządek i struktura
- Moduły ES (`js/core` bez DOM, `js/app` interfejs) zamiast jednego `app.js`; Leaflet lokalnie; usunięte `.bak`, raporty ETAP, duplikaty skryptów.
- Repozytorium git, testy jednostkowe (`node --test`) i E2E (Playwright).
### 2. Wspólny stan instalacji
- Jeden niezmienny zestaw parametrów (`makeInstallationParams`) dla profilu, oceny i mapy zasięgu.
- Klucze wyników teren/geometria/RF/obszar; wynik nieaktualny (inny klucz) jest odrzucany.
### 3. Kompas
- Jedno źródło kursu; iOS `webkitCompassHeading`, `alpha` tylko gdy absolutny; korekta orientacji ekranu.
- Stany czujnika (brak, zgoda, odmowa, oczekiwanie, nieświeży, ręczny); wygładzanie z zawinięciem 359→0.
- „Kierunek prawidłowy” tylko przy znanej dokładności ≤ 10°; kalibracja (odwrócenie, poprawka).
### 4. Offline
- Service worker z wersjonowanym cache, usuwa tylko własne stare cache; dane: najpierw sieć, offline kopia.
- Teren w osobnym cache (`dvbt-point-dem-v1`), zapis instalacji „do pracy offline” (profil w IndexedDB), baner offline.
### 5. Jedna geometria
- Wysokość anteny **MUX-a** (np. Solina MUX-8 62 m zamiast 90 m obiektu); k = 4/3 w wykresie, ocenie i mapie; teren nadajnika z bazy.
### 6. Uczciwe jednostki i model
- Natężenie pola dBµV/m, moc dBm, poziom dBµV (75 Ω) — rozdzielone; E_min z założeń instalacji; Deygout zamiast umownych kar.
### 7. Baza i ANT
- Schemat 3 (`schema_version`, `data_version`), brak wartości = `null` (bez domyślnego masztu 60 m), walidacja i raport problemów.
- Parser `.ant`: odrzuca HTML, wartości dodatnie/mieszane, pliki-wypełniacze (same zera, linki `/0/`).
### 8. Zadania
- Menedżer zadań: nowe zadanie przerywa poprzednie, postęp, przycisk „Przerwij”, limit równoległych pobrań, deduplikacja kafli.
### 9. Tryby analizy
- Punkt / okolica 1 km / obszar nadajnika (promień z horyzontu radiowego). Obliczenia w Web Workerze (z awaryjnym trybem w oknie), raster na canvas.
### 10. Lokalizacja i wyszukiwanie
- GPS z dokładnością i ostrzeżeniem, przeciągany znacznik, współrzędne, Nominatim zgodnie z zasadami (1/s, ochrona przed starymi odpowiedziami).
### 11–12. Interfejs
- Najpierw mapa, panel wyniku, dolna nawigacja Mapa/Nadajnik/Zapisane, menu; tokeny wizualne, tryb ciemny, cele dotyku ≥ 44 px.
### 13. Zapisane instalacje
- Nazwa, notatka, wynik, wyszukiwanie, eksport/import JSON, usuwanie; ostrzeżenie o zmianie bazy/algorytmu.
### 14. Książka i dostępność
- Tabele ze źródłami: kanały, DAB+, C/N DVB-T (EN 300 744 tab. A.1, Gauss/Rice/Rayleigh), DVB-T2 (orientacyjnie), poziomy (PAL oznaczone jako historyczne), MER, BER osobno dla T i T2, konstelacje.
- Pułapka fokusu w oknach, Escape, `aria-live`, wzory (nie tylko kolor) w legendzie i rastrze.
### 15. Testy i dokumentacja
- 34 testy jednostkowe, 11 scenariuszy E2E, README, ten plik, skrypty URUCHOM/BUILD/GITHUB.

### Znane ograniczenia
- Brak budynków, lasu, odbić, SFN i zakłóceń międzykanałowych w modelu; DEM ~25–30 m.
- Wartości C/N DVB-T2 orientacyjne. Kompas telefonu ±10–20°.
- Nie testowano na fizycznym telefonie (tylko emulacja w Chromium).
