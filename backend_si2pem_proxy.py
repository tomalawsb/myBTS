"""
Backend SI2PEM dla myBTS Web Pro.

Cel:
- token SI2PEM zostaje na serwerze,
- frontend PWA wysyła tylko dane stacji,
- backend pobiera dane z SI2PEM API i odsyła gotowe parametry do aplikacji.

Uruchomienie lokalne:
  pip install -r backend_requirements.txt
  set SI2PEM_TOKEN=TU_WKLEJ_TOKEN
  set SI2PEM_ENDPOINT_TEMPLATE=/api/...    # ścieżka z dokumentacji Swagger SI2PEM
  uvicorn backend_si2pem_proxy:app --host 0.0.0.0 --port 8787

Adres w aplikacji PWA:
  http://localhost:8787
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Iterable, List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

APP_NAME = "myBTS SI2PEM Backend"
DEFAULT_BASE_URL = "https://si2pem.gov.pl"
DEFAULT_TIMEOUT = 35.0
DEFAULT_RADIUS_M = 350


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


SI2PEM_API_BASE = _env("SI2PEM_API_BASE", DEFAULT_BASE_URL).rstrip("/")
SI2PEM_TOKEN = _env("SI2PEM_TOKEN")
SI2PEM_ENDPOINT_TEMPLATE = _env("SI2PEM_ENDPOINT_TEMPLATE")
SI2PEM_AUTH_HEADER = _env("SI2PEM_AUTH_HEADER", "Authorization")
SI2PEM_AUTH_SCHEME = _env("SI2PEM_AUTH_SCHEME", "Bearer")
SI2PEM_TIMEOUT = float(_env("SI2PEM_TIMEOUT", str(DEFAULT_TIMEOUT)) or DEFAULT_TIMEOUT)
SI2PEM_RADIUS_M = int(_env("SI2PEM_RADIUS_M", str(DEFAULT_RADIUS_M)) or DEFAULT_RADIUS_M)
ALLOWED_ORIGINS = [x.strip() for x in _env("SI2PEM_ALLOWED_ORIGINS", "*").split(",") if x.strip()]

app = FastAPI(title=APP_NAME, version="3.19")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


class StationLookup(BaseModel):
    station_id: str = ""
    operator: str = ""
    city: str = ""
    address: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    bands: List[str] = Field(default_factory=list)
    azimuths: List[float] = Field(default_factory=list)
    power: str = ""
    antenna_height_m: Optional[float] = None
    tilt_deg: Optional[float] = None


class EnrichRequest(BaseModel):
    app: str = "myBTS Web Pro"
    version: str = ""
    mode: str = "selected"
    requested_at: str = ""
    stations: List[StationLookup]


@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "name": APP_NAME,
        "base_url": SI2PEM_API_BASE,
        "endpoint_template_set": bool(SI2PEM_ENDPOINT_TEMPLATE),
        "token_set": bool(SI2PEM_TOKEN),
    }


@app.post("/api/si2pem/enrich")
async def enrich_from_si2pem(payload: EnrichRequest) -> Dict[str, Any]:
    if not payload.stations:
        raise HTTPException(status_code=400, detail="Brak stacji w żądaniu.")
    if not SI2PEM_TOKEN:
        raise HTTPException(status_code=500, detail="Brak zmiennej środowiskowej SI2PEM_TOKEN na backendzie.")
    if not SI2PEM_ENDPOINT_TEMPLATE:
        raise HTTPException(status_code=500, detail="Brak SI2PEM_ENDPOINT_TEMPLATE. Wstaw ścieżkę endpointu z dokumentacji Swagger SI2PEM.")

    supplements: List[Dict[str, Any]] = []
    errors: List[str] = []

    headers = {
        "Accept": "application/json",
        SI2PEM_AUTH_HEADER: f"{SI2PEM_AUTH_SCHEME} {SI2PEM_TOKEN}".strip(),
    }

    async with httpx.AsyncClient(timeout=SI2PEM_TIMEOUT, follow_redirects=True) as client:
        for station in payload.stations:
            try:
                url = build_si2pem_url(station)
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()
                records = extract_records(data)
                station_supplements = [normalize_record_to_supplement(record, station, url) for record in records]
                supplements.extend([s for s in station_supplements if is_useful_supplement(s)])
            except Exception as exc:  # noqa: BLE001
                station_label = station.station_id or station.address or station.city or "bez ID"
                errors.append(f"{station_label}: {exc}")

    return {
        "ok": True,
        "requested": len(payload.stations),
        "returned": len(supplements),
        "supplements": supplements,
        "errors": errors[:20],
    }


def build_si2pem_url(station: StationLookup) -> str:
    values = {
        "station_id": station.station_id,
        "operator": station.operator,
        "city": station.city,
        "address": station.address,
        "lat": "" if station.latitude is None else station.latitude,
        "lon": "" if station.longitude is None else station.longitude,
        "latitude": "" if station.latitude is None else station.latitude,
        "longitude": "" if station.longitude is None else station.longitude,
        "radius_m": SI2PEM_RADIUS_M,
        "radius": SI2PEM_RADIUS_M,
    }
    path = SI2PEM_ENDPOINT_TEMPLATE.format(**values)
    if path.startswith("http://") or path.startswith("https://"):
        return path
    return f"{SI2PEM_API_BASE}/{path.lstrip('/')}"


def extract_records(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("items", "data", "results", "records", "content", "installations", "measurements", "features"):
        value = payload.get(key)
        if isinstance(value, list):
            out: List[Dict[str, Any]] = []
            for item in value:
                if isinstance(item, dict) and isinstance(item.get("properties"), dict):
                    merged = {**item.get("properties", {})}
                    geometry = item.get("geometry") or {}
                    if isinstance(geometry, dict):
                        merged["geometry"] = geometry
                    out.append(merged)
                elif isinstance(item, dict):
                    out.append(item)
            return out
    return [payload]


def normalize_record_to_supplement(record: Dict[str, Any], station: StationLookup, source_url: str) -> Dict[str, Any]:
    flat = flatten_dict(record)
    # Ważne: w tekście diagnostycznym trzymamy również nazwy pól, nie tylko wartości.
    # Bez tego API zwracające np. {"azimuth": 120, "eirp_dbm": 45} było trudne do rozpoznania.
    all_text = " ".join(f"{key}: {value}" for key, value in flat.items() if value is not None)
    lat, lon = extract_coordinates(flat)

    bands_text = " ".join(str(x) for x in field_values(flat, [
        "bands", "band", "pasma", "pasmo", "technology", "technologia", "system", "standard", "frequency", "czestotliwosc", "częstotliwość"
    ]))
    bands = merge_unique(extract_bands(bands_text), extract_bands(all_text))

    azimuths = extract_azimuths_from_fields(flat)
    if not azimuths:
        azimuths = extract_azimuths(all_text)

    power = normalize_power_from_fields(flat)
    if not power:
        power = extract_power(all_text)

    eirp_dbm = normalize_eirp_dbm_from_fields(flat)
    if not eirp_dbm:
        eirp_dbm = extract_eirp_dbm(all_text)

    antenna_height_m = number_from_fields(flat, [
        "antenna_height_m", "height_m", "height", "wysokosc", "wysokość", "wysokoscanteny", "wysokość anteny",
        "wysokosczawieszenia", "wysokość zawieszenia", "wysokosczawieszeniaanteny", "wysokość zawieszenia anteny"
    ])
    if antenna_height_m is None:
        antenna_height_m = extract_number_by_labels(all_text, ["wysokość anteny", "wysokosc anteny", "wysokość zawieszenia", "height", "antenna height"])

    tilt_deg = number_from_fields(flat, [
        "tilt_deg", "antenna_tilt_deg", "tilt", "downtilt", "pochylenie", "pochylenieanteny", "kąt pochylenia", "katpochylenia"
    ])
    if tilt_deg is None:
        tilt_deg = extract_number_by_labels(all_text, ["pochylenie", "tilt", "downtilt"])

    return {
        "station_id": first_value(flat, ["station_id", "stationid", "site_id", "siteid", "id_stacji", "idstacji", "id", "bt_id", "bts_id"]) or station.station_id,
        "operator": first_value(flat, ["operator", "operator_name", "nazwa_operatora", "uzytkownik", "użytkownik", "podmiot", "network", "sieć", "siec"]) or station.operator,
        "city": first_value(flat, ["city", "miasto", "miejscowosc", "miejscowość", "gmina"]) or station.city,
        "address": first_value(flat, ["address", "adres", "lokalizacja", "location", "ulica"]) or station.address,
        "latitude": lat if lat is not None else station.latitude,
        "longitude": lon if lon is not None else station.longitude,
        "bands": bands,
        "azimuths": azimuths,
        "power": power,
        "eirp_dbm": eirp_dbm,
        "antenna_height_m": antenna_height_m,
        "tilt_deg": tilt_deg,
        "range_km": None,
        "source": "SI2PEM API",
        "param_sources": [source_url],
    }


def flatten_dict(data: Any, prefix: str = "") -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if isinstance(data, dict):
        for key, value in data.items():
            full_key = f"{prefix}_{key}" if prefix else str(key)
            if isinstance(value, (dict, list, tuple)):
                out.update(flatten_dict(value, full_key))
            else:
                out[normalize_key(full_key)] = value
    elif isinstance(data, (list, tuple)):
        scalar_values: List[str] = []
        for index, value in enumerate(data):
            full_key = f"{prefix}_{index}" if prefix else str(index)
            if isinstance(value, (dict, list, tuple)):
                out.update(flatten_dict(value, full_key))
            else:
                out[normalize_key(full_key)] = value
                scalar_values.append(str(value))
        if prefix and scalar_values:
            out[normalize_key(prefix)] = "; ".join(scalar_values)
    return out


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9ąćęłńóśźż]+", "", value.lower())


def first_value(flat: Dict[str, Any], aliases: Iterable[str]) -> str:
    values = field_values(flat, aliases)
    return str(values[0]).strip() if values else ""


def field_values(flat: Dict[str, Any], aliases: Iterable[str]) -> List[Any]:
    wanted = {normalize_key(alias) for alias in aliases}
    values: List[Any] = []
    for key, value in flat.items():
        if value in (None, ""):
            continue
        if key in wanted:
            values.append(value)
            continue
        # Dopasowanie częściowe tylko dla dłuższych aliasów. Krótkie aliasy typu x/y/lat/lon
        # nie mogą łapać przypadkowych kluczy, np. geometrycoordinates.
        if any(len(alias) >= 4 and alias in key for alias in wanted):
            values.append(value)
    return values


def number_from_fields(flat: Dict[str, Any], aliases: Iterable[str]) -> Optional[float]:
    for value in field_values(flat, aliases):
        number = to_float(value)
        if number is not None:
            return number
    return None


def merge_unique(*lists: Iterable[Any]) -> List[Any]:
    out: List[Any] = []
    for values in lists:
        for value in values or []:
            if value not in out:
                out.append(value)
    return out


def extract_azimuths_from_fields(flat: Dict[str, Any]) -> List[int]:
    aliases = [
        "azimuths", "azimuth", "azymuty", "azymut", "bearing", "kierunek", "kierunekanteny",
        "azymutanteny", "azimuth_deg", "azimuthdeg", "azymutstopnie", "azymutdeg"
    ]
    values: List[int] = []
    for raw_value in field_values(flat, aliases):
        for raw in re.findall(r"\b\d{1,3}(?:[,.]\d+)?\b", str(raw_value)):
            value = round(float(raw.replace(",", ".")))
            if 0 <= value < 360 and value not in values:
                values.append(value)
    return sorted(values)[:18]


def normalize_power_from_fields(flat: Dict[str, Any]) -> str:
    power_aliases = [
        "power", "power_w", "powerw", "moc", "mocw", "mocpromieniowana", "eirp", "eirp_w", "eirpw",
        "erp", "max_eirp", "maxeirp", "max_eirp_dbm", "maksymalnamoc", "rownowaznamocpromieniowanaizotropowo"
    ]
    for key, value in ((k, v) for k, v in flat.items() if v not in (None, "")):
        if not any(normalize_key(alias) in key for alias in power_aliases):
            continue
        text = str(value).strip()
        if not text:
            continue
        lower_key = key.lower()
        lower_text = text.lower()
        if any(unit in lower_text for unit in ("dbm", "dbw", "kw", " w", "w")):
            parsed = extract_power(f"{key}: {text}")
            if parsed:
                return parsed
            return text
        number = to_float(text)
        if number is None:
            continue
        if "dbm" in lower_key:
            return f"{format_float(number)} dBm"
        if "dbw" in lower_key:
            return f"{format_float(number)} dBW"
        if "kw" in lower_key:
            return f"{format_float(number)} kW"
        return f"{format_float(number)} W"
    return ""


def normalize_eirp_dbm_from_fields(flat: Dict[str, Any]) -> str:
    for key, value in ((k, v) for k, v in flat.items() if v not in (None, "")):
        if "eirp" not in key or "dbm" not in key:
            continue
        number = to_float(value)
        if number is not None:
            return f"{format_float(number)} dBm"
        text = str(value).strip()
        if text:
            return text if "dbm" in text.lower() else f"{text} dBm"
    return ""


def format_float(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return (f"{value:.3f}".rstrip("0").rstrip(".")).replace(".", ",")


def extract_coordinates(flat: Dict[str, Any]) -> tuple[Optional[float], Optional[float]]:
    lat = to_float(first_value(flat, ["lat", "latitude", "szerokosc", "szerokoscgeograficzna", "y", "geometry_coordinates_1"]))
    lon = to_float(first_value(flat, ["lon", "lng", "longitude", "dlugosc", "dlugoscgeograficzna", "x", "geometry_coordinates_0"]))
    if lat is not None and lon is not None and abs(lat) <= 90 and abs(lon) <= 180:
        return lat, lon
    return None, None


def to_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    text = str(value).replace(",", ".")
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


def extract_bands(text: str) -> List[str]:
    out: List[str] = []
    patterns = [
        (r"\bLTE\s*[-_ ]?\s*(700|800|850|900|1800|2100|2300|2600)\b", "LTE{}"),
        (r"\bGSM\s*[-_ ]?\s*(850|900|1800|1900)\b", "GSM{}"),
        (r"\bUMTS\s*[-_ ]?\s*(850|900|1800|1900|2100)\b", "UMTS{}"),
        (r"\b(?:NR|5G)\s*[-_ ]?\s*n?\s*(1|3|7|8|20|28|38|40|41|77|78)\b", "NR{}"),
    ]
    for pattern, fmt in patterns:
        for match in re.finditer(pattern, text, flags=re.I):
            value = fmt.format(match.group(1)).upper()
            if value not in out:
                out.append(value)
    return out


def extract_azimuths(text: str) -> List[int]:
    values: List[int] = []
    for line in re.split(r"[\r\n;]", text):
        if not re.search(r"azymut|azimuth|kierunek", line, flags=re.I):
            continue
        for raw in re.findall(r"\b\d{1,3}(?:[,.]\d+)?\b", line):
            value = round(float(raw.replace(",", ".")))
            if 0 <= value < 360 and value not in values:
                values.append(value)
    return sorted(values)[:18]


def extract_power(text: str) -> str:
    match = re.search(r"(?:EIRP|ERP|moc|moc promieniowana)[^\d-]{0,80}(-?\d+(?:[,.]\d+)?)\s*(dBm|dBW|kW|W)\b", text, flags=re.I)
    if not match:
        match = re.search(r"(-?\d+(?:[,.]\d+)?)\s*(dBm|dBW|kW|W)\b[^\n]{0,60}(?:EIRP|ERP|moc)", text, flags=re.I)
    if not match:
        return ""
    return f"{match.group(1).replace('.', ',')} {match.group(2)}"


def extract_eirp_dbm(text: str) -> str:
    power = extract_power(text)
    return power if power.lower().endswith("dbm") else ""


def extract_number_by_labels(text: str, labels: Iterable[str]) -> Optional[float]:
    joined = "|".join(re.escape(label) for label in labels)
    match = re.search(rf"(?:{joined})[^\d-]{{0,50}}(-?\d+(?:[,.]\d+)?)", text, flags=re.I)
    if not match:
        return None
    return to_float(match.group(1))


def is_useful_supplement(item: Dict[str, Any]) -> bool:
    return bool(
        item.get("bands")
        or item.get("azimuths")
        or item.get("power")
        or item.get("eirp_dbm")
        or item.get("antenna_height_m") is not None
        or item.get("tilt_deg") is not None
    )
