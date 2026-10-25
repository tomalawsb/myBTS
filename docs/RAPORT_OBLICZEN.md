# Raport obliczeń — porównanie modeli (DVBT-Point 3)

Skrypt: `node tools/compare.mjs --json wynik.json`. Stary algorytm to kod z commita 272df9a, rozpakowany poleceniem `git archive 272df9a js | tar -x -C /tmp/old272`.
Wszystkie modele dostają te same dane: teren Terrarium z=12 (rozdzielczość źródła ok. 26 m, próbkowanie profilu co 40 m), klutter CORINE 2018 (tylko P.1812) i dane emisji z `data/transmitters.json`.

**Instalacja:** antena na wysokości 10 m n.p.t., zysk 10 dBi, kabel 3 dB, odbiornik DVB-T2 256-QAM 2/3.

**Emisje:**
- Święty Krzyż: MUX-3 K47 (682 MHz), 150 kW ERP, antena dookólna (brak pliku ANT, 0 dB).
- Tarnobrzeg: MUX-3 K26 (514 MHz), 23,23 kW ERP, charakterystyka ANT 1712. Maksimum 0 dB w azymucie 60°, minimum −13,5 dB w azymucie 300°.

## Wyniki (natężenie pola E w dBµV/m; zapas liczony dla P.1812)

| Punkt | Nadajnik | d [km] | ANT [dB] | stary 272df9a | Deygout | P.1812 | zapas P.1812 [dB] |
|---|---|---|---|---|---|---|---|
| Punkt główny 50.33624, 21.32573 | Święty Krzyż K47 | 61,5 | 0,0 | 92,9 | 92,9 | 82,1 | 33,3 |
| Punkt główny | Tarnobrzeg K26 | 30,5 | −0,6 | 88,1 | 88,1 | 72,9 | 26,6 |
| Mielec (50.2870, 21.4250) | Święty Krzyż K47 | 69,1 | 0,0 | 91,9 | 91,9 | 75,9 | 27,1 |
| Mielec | Tarnobrzeg K26 | 30,4 | 0,0 | 90,3 | 90,3 | 77,7 | 31,4 |
| Czermin (50.3290, 21.3290) | Święty Krzyż K47 | 62,3 | 0,0 | 92,8 | 92,8 | 82,5 | 33,7 |
| Czermin | Tarnobrzeg K26 | 30,9 | −0,5 | 88,5 | 88,5 | 79,5 | 33,2 |
| 25 km od Tarnobrzega, az 60° (kierunek silny) | Święty Krzyż K47 | 67,9 | 0,0 | 90,7 | 90,7 | 72,0 | 23,2 |
| j.w. | Tarnobrzeg K26 | 25,0 | 0,0 | 88,5 | 88,5 | 73,5 | 27,2 |
| 25 km od Tarnobrzega, az 300° (kierunek słaby) | Święty Krzyż K47 | 31,9 | 0,0 | 73,9 | 73,9 | 76,5 | 27,7 |
| j.w. | Tarnobrzeg K26 | 25,0 | −13,5 | 56,2 | 56,2 | 54,6 | 8,3 |

Minimalne natężenie pola dla tej instalacji wynosi 48,8 dBµV/m przy K47 i 46,3 dBµV/m przy K26.

**Stary algorytm a Deygout:** stary algorytm to też Deygout na tym samym kroku profilu (40 m), więc wyniki są identyczne. W wersji 3 zmieniło się to, że P.1812 jest domyślny, a ten sam zestaw parametrów obowiązuje dla punktu, rankingu i mapy zasięgu.

## Skąd 92,9 dBµV/m (stary wynik dla Świętego Krzyża)

Model uproszczony, czyli wolna przestrzeń plus dyfrakcja Deygout:

E = 106,92 + 10·log10(ERP[kW]) + G_ANT − 20·log10(d[km]) − L_dyfr

Dla punktu głównego: 106,92 + 10·log10(150) + 0 − 20·log10(61,5) − 0 = 106,92 + 21,76 − 35,78 = **92,9 dBµV/m**.

- Trasa ma pełną widoczność optyczną z zachowaną strefą Fresnela (status „clear”), więc Deygout daje stratę 0 dB.
- Model uproszczony nie uwzględnia klutteru wzdłuż trasy, troposcatteru ani statystyki 50% lokalizacji. Dlatego przy otwartej trasie daje praktycznie wartość dla wolnej przestrzeni.
- P.1812 dla tej samej trasy daje Lb = 135,7 dB, czyli Lbfs 124,8 dB plus Ld 10,9 dB. Różnica bierze się z dyfrakcji delta-Bullington na profilu z wysokościami klutteru CORINE (lasy i zabudowa na trasie). Wynik wynosi 82,1 dBµV/m, około 10,8 dB mniej niż model uproszczony.

## Wnioski

- W punkcie głównym oba nadajniki MUX-3 zapewniają duży zapas: Święty Krzyż K47 ok. +33 dB, Tarnobrzeg K26 ok. +27 dB.
- Ranking według zapasu wskazuje Święty Krzyż. Wybór Tarnobrzega zachowuje MUX-3, czyli wariant „Rzeszow” na K26.
- **Kierunek słaby ANT 1712 (az 300°):** −13,5 dB charakterystyki obniża pole Tarnobrzega do ok. 55 dBµV/m. Zapas spada do ok. +8 dB, ale emisja nadal jest widoczna na liście jako słabsza.
- Wyniki modelowe dotyczą 50% czasu i 50% lokalizacji. Nie uwzględniają budynków przy samej antenie ani zakłóceń współkanałowych (brak sumowania SFN).
