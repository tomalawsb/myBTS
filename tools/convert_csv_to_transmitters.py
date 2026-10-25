#!/usr/bin/env python3
"""Konwerter CSV -> data/transmitters.json (schemat 3, zgodny z aplikacją).
Kolumny (nagłówek): name,site,lat,lon,site_elevation_m,mast_height_m,region,mux,channel,
frequency_mhz,erp_kw,polarization,band,antenna_height_m,source
Starsze nazwy height_m (n.p.m. obiektu) i mast_m są akceptowane.
Puste pola zostają puste (null) — konwerter NIE wstawia wartości domyślnych.
Użycie: python tools/convert_csv_to_transmitters.py wejscie.csv data/transmitters.json
"""
import csv, json, re, sys
from datetime import date
from pathlib import Path

ALIASES = {"height_m": "site_elevation_m", "mast_m": "mast_height_m"}

def num(v):
    if v is None: return None
    v = str(v).strip().replace(",", ".")
    if not v: return None
    try: return float(v)
    except ValueError: return None

def slug(t):
    t = t.lower()
    for a, b in zip("ąćęłńóśźż", "acelnoszz"): t = t.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "tx"

def channel_freq(ch):
    if ch is None: return None
    if 5 <= ch <= 12: return 177.5 + 7 * (ch - 5)
    if 21 <= ch <= 69: return 474 + 8 * (ch - 21)
    return None

def convert(rows):
    groups, errors = {}, []
    for i, raw in enumerate(rows, start=2):
        r = {ALIASES.get(k.strip(), k.strip()): (v or "").strip() for k, v in raw.items() if k}
        lat, lon = num(r.get("lat")), num(r.get("lon"))
        if lat is None or lon is None:
            errors.append(f"wiersz {i}: brak współrzędnych"); continue
        key = (r.get("name") or f"{lat},{lon}", round(lat, 5), round(lon, 5))
        tx = groups.setdefault(key, {
            "id": None, "name": r.get("name") or f"Nadajnik {lat:.4f},{lon:.4f}", "short_name": r.get("site") or r.get("name"),
            "location": r.get("name"), "site": r.get("site"), "lat": lat, "lon": lon,
            "site_elevation_m": num(r.get("site_elevation_m")), "mast_height_m": num(r.get("mast_height_m")),
            "region": r.get("region") or None, "source": r.get("source") or "CSV użytkownika", "muxes": []})
        chm = re.search(r"\d+", r.get("channel") or "")
        ch = int(chm.group()) if chm else None
        freq = num(r.get("frequency_mhz"))
        if freq is None and ch is not None: freq = channel_freq(ch)
        tx["muxes"].append({
            "name": r.get("mux") or "MUX", "channel": f"K{ch}" if ch else None, "channel_no": ch,
            "frequency_mhz": freq, "erp_kw": num(r.get("erp_kw")),
            "polarization": (r.get("polarization") or None), "band": r.get("band") or ("VHF" if freq and freq < 300 else ("UHF" if freq else None)),
            "antenna_height_m": num(r.get("antenna_height_m")), "ant_file_url": None})
    used = set(); txs = []
    for tx in groups.values():
        base = slug(tx["name"]); tid = base; n = 2
        while tid in used: tid = f"{base}-{n}"; n += 1
        used.add(tid); tx["id"] = tid; txs.append(tx)
    return {"schema_version": 3, "data_version": f"csv-{date.today().isoformat()}", "updated_at": date.today().isoformat(),
            "source": "Import CSV", "transmitters": txs}, errors

def main(argv):
    if len(argv) < 3:
        print(__doc__); return 2
    with open(argv[1], encoding="utf-8-sig", newline="") as f:
        out, errors = convert(list(csv.DictReader(f)))
    Path(argv[2]).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for e in errors: print("UWAGA:", e)
    print(f"OK: {len(out['transmitters'])} obiektów, {sum(len(t['muxes']) for t in out['transmitters'])} emisji")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
