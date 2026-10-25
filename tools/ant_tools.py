#!/usr/bin/env python3
"""Pobieranie i walidacja charakterystyk anten (.ant) RadioPolska.

  python tools/ant_tools.py download [--limit N] [--delay 0.4]
  python tools/ant_tools.py validate

 - linki /ant_file/0/ to brak pliku — są pomijane (nie są zapisywane jako ANT),
 - zapisywany jest tylko plik, który przejdzie walidację (360 liczb ≤ 0 dB, nie HTML, nie same zera),
 - po pobraniu uzupełniane jest pole ant_pattern_path w data/transmitters.json.
Format zgodny z parserem js/core/ant.js (wiersz i = azymut i°).
"""
from __future__ import annotations
import argparse, json, re, sys, time, urllib.parse, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "data" / "ant" / "index.json"
TXS = ROOT / "data" / "transmitters.json"
UA = "DVB-T-T2-Point/3 ANT downloader (zrodlo: RadioPolska.pl)"
MAX_BYTES = 64 * 1024

def ant_id(url: str) -> str | None:
    m = re.search(r"/ant_file/(\d+)/", url or "")
    return m.group(1) if m and m.group(1) != "0" else None

def validate_text(text: str) -> tuple[bool, str]:
    t = text.strip()
    if not t: return False, "pusty plik"
    if t.startswith("<") or re.search(r"<html|<body|<!doctype", t, re.I): return False, "HTML zamiast ANT"
    vals = []
    for line in t.splitlines():
        line = line.strip()
        if not line or line[0] in "#;": continue
        parts = re.split(r"[\s;\t]+", line.replace(",", "."))
        if len(parts) != 1: return False, "nieobsługiwany układ kolumn (oczekiwano 1 wartości w wierszu)"
        try: vals.append(float(parts[0]))
        except ValueError: return False, f"nieczytelny wiersz: {line[:30]}"
    if len(vals) != 360: return False, f"{len(vals)} wartości zamiast 360"
    if all(v == 0 for v in vals): return False, "same zera (brak charakterystyki)"
    if max(vals) > 0.5: return False, "wartości dodatnie — format niejednoznaczny"
    return True, f"OK, min {min(vals):.1f} dB"

def download(limit: int, delay: float) -> int:
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    done, tried, seen = 0, 0, {}
    for it in idx["items"]:
        aid = ant_id(it.get("url", ""))
        it["ant_file_id"] = aid or ""
        if not aid:
            it.update(downloaded=False, local_path=None, note="Link /0/ — RadioPolska nie ma charakterystyki tej emisji.")
            continue
        it["local_path"] = f"data/ant/{aid}.ant"
        path = ROOT / it["local_path"]
        if aid in seen or path.exists():
            ok, note = validate_text(path.read_text(encoding="utf-8")) if path.exists() else (False, seen.get(aid, "brak"))
            it.update(downloaded=ok, note=note); continue
        if limit and tried >= limit: continue
        tried += 1
        url = it["url"].replace("http://", "https://", 1)
        p = urllib.parse.urlsplit(url)
        url = urllib.parse.urlunsplit((p.scheme, p.netloc, urllib.parse.quote(p.path, safe="/%"), p.query, ""))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
                raw = r.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES: raise ValueError("plik za duży")
            text = raw.decode("utf-8", "replace")
            ok, note = validate_text(text)
            if ok:
                path.write_text(text, encoding="utf-8"); done += 1
        except Exception as e:  # noqa
            ok, note = False, f"błąd pobierania: {e}"
        seen[aid] = note
        it.update(downloaded=ok, note=note)
        print(f"{aid}: {note}")
        time.sleep(delay)
    idx["downloaded_count"] = sum(1 for i in idx["items"] if i.get("downloaded"))
    INDEX.write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
    link_into_transmitters(idx)
    print(f"Pobrano teraz: {done}, łącznie poprawnych: {idx['downloaded_count']}/{len(idx['items'])}")
    return 0

def link_into_transmitters(idx):
    ok = {i["url"]: i["local_path"] for i in idx["items"] if i.get("downloaded")}
    data = json.loads(TXS.read_text(encoding="utf-8"))
    for tx in data["transmitters"]:
        for m in tx["muxes"]:
            m["ant_pattern_path"] = ok.get(m.get("ant_file_url"))
    TXS.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

def validate() -> int:
    bad = 0
    for f in sorted((ROOT / "data" / "ant").glob("*.ant")):
        ok, note = validate_text(f.read_text(encoding="utf-8"))
        if not ok: bad += 1; print(f"BŁĄD {f.name}: {note}")
    print("Walidacja ANT:", "OK" if not bad else f"{bad} błędnych plików")
    return 1 if bad else 0

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("cmd", choices=["download", "validate"])
    ap.add_argument("--limit", type=int, default=0); ap.add_argument("--delay", type=float, default=0.4)
    a = ap.parse_args()
    sys.exit(download(a.limit, a.delay) if a.cmd == "download" else validate())
