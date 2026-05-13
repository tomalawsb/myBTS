# Backend SI2PEM dla myBTS Web Pro 3.18

Ten backend jest pośrednikiem między aplikacją PWA a SI2PEM API.

## Dlaczego backend jest potrzebny

Token SI2PEM nie może być wpisany do `app.js`, bo każdy użytkownik przeglądarki mógłby go podejrzeć. Frontend wysyła do backendu tylko dane wybranych stacji, a backend trzyma token i wykonuje zapytania do SI2PEM.

## Uruchomienie

```bat
pip install -r backend_requirements.txt
set SI2PEM_TOKEN=TU_WKLEJ_TOKEN
set SI2PEM_API_BASE=https://si2pem.gov.pl
set SI2PEM_ENDPOINT_TEMPLATE=/api/TUTAJ_SCIEZKA_ZE_SWAGGERA?lat={lat}&lon={lon}&radius={radius_m}
uvicorn backend_si2pem_proxy:app --host 0.0.0.0 --port 8787
```

W aplikacji wpisz adres backendu:

```text
http://localhost:8787
```

Potem kliknij:

```text
Zapisz backend
Uzupełnij wybraną BTS
```

albo:

```text
Uzupełnij widoczne BTS z SI2PEM
```

## Co trzeba uzupełnić po uzyskaniu API

Najważniejsza rzecz to `SI2PEM_ENDPOINT_TEMPLATE`, czyli konkretna ścieżka endpointu ze Swaggera SI2PEM. Bez tego backend nie wie, który endpoint SI2PEM ma pytać.

Przykład szablonu:

```text
/api/.../search?lat={lat}&lon={lon}&radius={radius_m}
```

To jest tylko przykład. Faktyczną ścieżkę trzeba przepisać ze Swaggera po uzyskaniu dostępu.

## Format zwracany do frontendu

Backend zwraca:

```json
{
  "ok": true,
  "requested": 1,
  "returned": 1,
  "supplements": [
    {
      "station_id": "BT12345",
      "operator": "Play",
      "city": "Mielec",
      "address": "ul. Przykładowa 1",
      "latitude": 50.2872,
      "longitude": 21.4231,
      "bands": ["LTE1800", "NR78"],
      "azimuths": [0, 120, 240],
      "power": "120 W",
      "eirp_dbm": "",
      "antenna_height_m": 32,
      "tilt_deg": 3,
      "source": "SI2PEM API",
      "param_sources": ["SI2PEM API"]
    }
  ],
  "errors": []
}
```
