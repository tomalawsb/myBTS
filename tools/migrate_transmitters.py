#!/usr/bin/env python3
"""Migracja data/transmitters.json do schematu 3 (bez zmiany wartości pomiarowych).
Użycie: python tools/migrate_transmitters.py wejscie.json data/transmitters.json
 - dodaje schema_version=3 i data_version,
 - nie wstawia wartości domyślnych (brak = null),
 - zeruje ant_pattern_path, jeżeli lokalny plik nie istnieje.
"""
import json, sys
from pathlib import Path

def main(argv):
    if len(argv) < 3:
        print("Użycie: python tools/migrate_transmitters.py wejscie.json wyjscie.json"); return 2
    src, dst = Path(argv[1]), Path(argv[2])
    data = json.loads(src.read_text(encoding="utf-8"))
    root = dst.parent.parent
    data["schema_version"] = 3
    data["data_version"] = data.get("data_version") or f"radiopolska-{data.get('updated_at','nieznana')}"
    data.setdefault("source", "RadioPolska — wykaz emisji DVB-T/T2")
    for tx in data.get("transmitters", []):
        if tx.get("height_source", "").startswith("RadioPolska: n.p.t. z emisji; przyjęto maksymalną"):
            tx["height_source"] = "wysokość obiektu = najwyższa antena z emisji (używana tylko zastępczo)"
        for m in tx.get("muxes", []):
            m.setdefault("antenna_height_m", None)
            p = m.get("ant_pattern_path")
            if p and not (root / p).exists():
                m["ant_pattern_path"] = None
    dst.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"OK: {len(data['transmitters'])} obiektów, wersja danych {data['data_version']}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
