# Wyniki testów — 3 v25.10.26.0946

Data: 2026-10-25 09:46 (Europe/Warsaw, UTC+1)

## Testy jednostkowe (npm test): 69 / 69 zaliczonych

- format RadioPolska: 360 wierszy
- interpolacja z zawinięciem 359→0
- pary azymut/wartość
- odrzuca HTML, same zera jako brak danych, wartości dodatnie
- linki /0/ = brak pliku
- pobrane pliki data/ant/*.ant przechodzą parser
- punkt i węzeł obszaru: ta sama wartość (≤ 0,1 dB) na identycznym profilu
- redukcja profilu zachowuje wąskie wierzchołki terenu (porównanie z pełnym profilem)
- interpolacja między węzłami (osobno): liniowa, NaN nie jest zamieniany na wartość
- wygładzanie przez 359→0 nie kręci się dookoła
- odwrócenie i korekta
- stany czujnika
- polecenie obrotu
- alpha względna nie jest kursem; orientacja ekranu
- stałe progi pola i oznaczenie poza skalą
- brak danych nie jest pokazywany jako brak zasięgu; udziały tylko z obliczonych komórek
- zmiana widoku / progu odbiornika nie wymaga propagacji (to samo pole)
- odczyt z mapy: interpolacja, poza obszarem „nie obliczono”, brak danych
- baza: schemat 3, 274 obiekty, brak cichych domyślnych
- Solina MUX-8: 62 m w profilu i w RF (nie 90 m obiektu)
- Częstochowa/Wręczyca MUX-8: 180 m w profilu i w RF (nie 313 m)
- brak wysokości anteny MUX → zastępczo wysokość obiektu, opisana
- VHF i UHF: raster kanałów
- walidacja: brak ERP = null, nie 0; zły rekord pominięty
- natywny kompas: start, odczyt, kalibracja, stop
- P.1812: zgodność z referencją ITU-R SG3 / Py1812 (±0.1 dB)
- P.1812: płaski krótki LOS ≈ wolna przestrzeń
- P.1812: przeszkoda zwiększa tłumienie, klutter R też
- P.2108 §3.1 i pomocnicze
- domyślny model to P.1812
- odwrócenie profilu (Rx→Tx na Tx→Rx) zgodne z bezpośrednim wywołaniem
- płaski LOS: P.1812 ≈ model uproszczony (±3 dB)
- klutter: las na trasie i zabudowa przy odbiorniku obniżają pole
- CORINE: kolory legendy → kody, R i strefy
- PUWG92: południk osiowy
- PUWG92: Warszawa (PKiN) ≈ x 487 km, y 637 km; symetria względem λ0
- kandydaci per MUX: promień 120 km, brak danych osobno, słabe osobno
- ocena jednej emisji: płaski teren → w zasięgu, góra → przeszkoda; brak danych ≠ brak zasięgu
- ranking per MUX: zapas (kroki 3 dB) → widoczność; brak danych na końcu
- ranking zależy od MUX: ten sam punkt, inne MUX-y → inny polecany
- klucz skanu zależy od MUX, punktu, wysokości, odbiornika, modelu i terenu
- 100 km przy 10 kW ERP — co najwyżej sygnał na granicy, nie „duży zapas”
- 20 km przy 100 kW ERP — dobry lub duży zapas
- wybrzuszenie Ziemi k=4/3: 30+30 km ≈ 53 m
- J(v): v=0 → ~6 dB, v=-1 → 0 dB
- płaski teren 60 km: profil i wynik bez sprzeczności
- płaski teren 60 km z niską anteną: krzywizna blokuje — profil i RF zgodne
- pojedyncze wzgórze: przeszkoda wskazana z odległością, strata dyfrakcji dodatnia
- strefa Fresnela oddzielnie od LOS
- jednostki: P[dBm] = E + G − 20log f − 77,2; Emin rośnie z f
- pasma zapasu
- ERP brak → brak wyniku (nie zero)
- promień od nadajnika daje ten sam wynik co analiza punktu
- parametry niezmienne
- zmiana częstotliwości zachowuje teren, unieważnia RF
- zmiana wysokości anteny MUX unieważnia geometrię
- klucz wyniku zawiera wersję algorytmu i ANT
- nieaktualny wynik nie nadpisuje nowszego
- zadania: nowe przerywa stare, Przerwij, isCurrent
- terrainKey nie zależy od wysokości
- areaKey zawiera model, teren, klutter i emisję; nie zależy od odbiornika (zapas liczony z pola)
- selectionKey: każda zmiana wyboru zmienia klucz (wynik nieaktualny nie jest pokazywany)
- zmiana wersji algorytmu (ALGO) nie usuwa zapisanych instalacji
- klasa kropki wg zapasu — progi jak legenda zasięgu
- każda klasa ma symbol (kolor nie jedyną informacją)
- filtr „Tylko w zasięgu”
- brak danych nie jest pokazywany jako brak zasięgu
- filtr domyślny „sprawdzone” nie ukrywa słabych; nadajniki bez MUX-a ukryte
- przypięta implementacja P.1812 i dane referencyjne

## Testy E2E (Playwright, Chromium; kafle i sieć atrapowane): 20 / 20 zaliczonych

- ok   - 360×640: start, przycisk MUX, podpowiedź „Przytrzymaj mapę”
- ok   - dotknięcie, przesunięcie i zoom mapy NIE ustawiają punktu
- ok   - przytrzymanie 600 ms ustawia punkt; „Cofnij” przywraca poprzedni
- ok   - punkt testowy, MUX-3: wynik z azymutem i panel w podsumowaniu
- ok   - kliknięcie mapy z punktem nie przesuwa punktu
- ok   - zmiana nadajnika Święty Krzyż → Tarnobrzeg zachowuje MUX-3
- ok   - szybkie przełączanie: brak nieaktualnego wyniku
- ok   - ranking per MUX; ręczny wybór nie jest nadpisany
- ok   - wybór MUX: siatka wszystkich MUX-ów, zaznaczenie kolorem i symbolem
- ok   - panel: „Rozwiń szczegóły”/„Zwiń” z aria-expanded, sekcje
- ok   - Zasięg: okno, okolica 1 km, legenda pola, odczyt bez przesuwania punktu
- ok   - model i dane obliczeń: P.1812, źródło terenu i krok osobno
- ok   - ustawienia: model uproszczony w zaawansowanych, opis „Uproszczony — …”
- ok   - zapis instalacji i lista Zapisane
- ok   - lista nadajników: filtr MUX, wyszukiwanie dowolnego nadajnika
- ok   - tekst powiększony 130%: brak przewijania w poziomie
- ok   - offline: ponowne uruchomienie z service workera, zapisane zostają
- ok   - poziomo 640×360: panel i przyciski dostępne
- ok   - desktop 1280×800: panel boczny 380 px, menu „Ustaw punkt tutaj”
- ok   - brak błędów JavaScript w konsoli

## Wymagane testy — pokrycie
- **Dotknięcie, przesunięcie i zoom nie przesuwają punktu; przytrzymanie i „Cofnij” działają:** E2E nr 2, 3 i 5.
- **Zmiana nadajnika zachowuje MUX; ranking per MUX:** E2E nr 6 i 8; `rank.test.mjs`.
- **Brak nieaktualnego wyniku:** E2E nr 7; `state.test.mjs` (selectionKey, createResultStore).
- **Punkt a obszar ≤ 0,1 dB:** `area.test.mjs`.
- **Brak danych nie jest pokazywany jako brak zasięgu:** `coverage.test.mjs` i `rank.test.mjs`.
- **Playwright: 360×640, poziomo, 1280, tekst 130%, offline:** E2E nr 1, 16, 17, 18 i 19.
- **Zmiana ALGO zachowuje instalacje:** `storage.test.mjs`.
