# DVB-T/T2 Point

PWA dla instalatorów anten telewizji naziemnej. Po wskazaniu punktu montażu (mapa, GPS, adres, współrzędne) aplikacja podaje:
nadajnik i MUX, **azymut**, **polaryzację**, odległość, widoczność radiową (LOS + 60% strefy Fresnela), natężenie pola,
poziom na odbiorniku i **zapas ponad minimum** dla wybranego systemu (DVB-T2 / DVB-T). Pomaga ustawić antenę kompasem telefonu
i może narysować mapę zasięgu (okolica 1 km lub obszar nadajnika).

> Wynik to **model**. Domyślnie aplikacja używa P.1812 oraz dostępnych danych terenu i pokrycia terenu; model uproszczony pomija zabudowę i las. Użyte źródła i ich braki są opisane przy wyniku. Ostateczną ocenę daje pomiar miernikiem.

## Uruchomienie
- Windows: `URUCHOM.cmd` (Python 3 — najpierw `D:\Users\Admin\Środowiska\Python311`, potem `py`/`python` z PATH) → http://localhost:8080
- Dowolnie: `python -m http.server 8080` w tym folderze i otwórz `http://localhost:8080/`.
- PWA/geolokalizacja/kompas wymagają HTTPS (lub localhost). Na telefon: hosting HTTPS, np. GitHub Pages.

## Struktura
```
index.html, manifest.json, service-worker.js, css/style.css, css/layout.css
js/core/   logika bez DOM (testowana w Node): geo, rf, ant, txdata, state, errors, compass-math, version
js/app/    interfejs: main, dom, dem, area(+worker), storage, geocode, compass, profile-chart, reference
data/      transmitters.json (schemat 3), ant/*.ant (zweryfikowane charakterystyki), ant/index.json
vendor/    Leaflet 1.9.4 (lokalnie — działa offline, CSP bez CDN)
tools/     set_version.py, migrate_transmitters.py, convert_csv_to_transmitters.py,
           build_transmitters_from_radiopolska.py, ant_tools.py
tests/     unit/*.test.mjs (node --test), e2e/run.mjs (Playwright)
```

## Model obliczeń (algorytm geo-rf-3.0)
- Profil: łuk wielkiego koła, próbki co ~40 m (256–2000), DEM Terrarium z=12 (~25–30 m/px).
- Geometria: krzywizna Ziemi k = 4/3, wysokość anteny **danego MUX-a** (zastępczo wysokość obiektu — oznaczone), teren nadajnika z bazy.
- Dyfrakcja: Deygout (do 3 krawędzi), J(v) wg ITU-R P.526. Wykres, ocena punktu i mapa zasięgu używają tych samych funkcji.
- E = 106,92 + 10·log ERP[kW] + G_ant − 20·log d[km] − L_dyfr [dBµV/m]
- P = E + G[dBi] − 20·log f[MHz] − 77,2 − L_kabla [dBm]; U = P + 108,75 [dBµV, 75 Ω]
- E_min z kTB + NF + C/N + margines implementacji (presety DVB-T2 256QAM 2/3, 64QAM 2/3, DVB-T 64QAM 3/4, 2/3).
- Skala: < 0 dB brak (czerwony, kratka) · 0–6 granica (bursztyn, ukośne) · 6–15 dobry · ≥ 15 duży zapas.

## Testy
```
node --test "tests/unit/*.test.mjs"                 # 34 testy logiki
npm i -D playwright && npx playwright install chromium
node tests/e2e/run.mjs                  # 11 scenariuszy (390×844 i 1280×800, offline)
```
E2E podmieniają sieć: syntetyczny teren (płasko 100 m), puste kafle mapy, sztuczny Nominatim.

## Wersja i wydanie
- `BUILD.cmd` → ustawia wersję `3 vDD.MM.RR.GGMM` (czas Europe/Warsaw) w `js/core/version.js` i `service-worker.js`, uruchamia testy.
- `GITHUB_WYSLIJ.cmd` → commit i push do https://github.com/tomalawsb/myBTS (gałąź main). `GITHUB_POBIERZ.cmd` → pobranie.

## Dane i licencje
Nadajniki: RadioPolska (CC BY 4.0 — wymagane podanie źródła). Teren: Mapzen Terrarium / AWS Open Data.
Mapy: © OpenStreetMap contributors, OpenTopoMap (CC-BY-SA), Esri World Imagery. Wyszukiwanie: Nominatim (max 1 zapytanie/s).
Leaflet © Volodymyr Agafonkin (BSD-2). Podkłady mapowe nie są pobierane masowo do pracy offline (zasady OSM).
