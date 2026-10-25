#!/usr/bin/env python3
"""Ustawia wersję aplikacji w js/core/version.js i service-worker.js.
Użycie: python tools/set_version.py            -> "3 vRR.MM.DD.GGMM" wg czasu Europe/Warsaw
        python tools/set_version.py "3 v24.10.26.1530"
"""
import re, sys
from datetime import datetime
from pathlib import Path
try:
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo('Europe/Warsaw'))
except Exception:
    now = datetime.now()
ROOT = Path(__file__).resolve().parent.parent
ver = sys.argv[1] if len(sys.argv) > 1 else now.strftime('3 v%d.%m.%y.%H%M')
if not re.fullmatch(r'3 v\d{2}\.\d{2}\.\d{2}\.\d{4}', ver):
    sys.exit(f'Nieprawidłowy format wersji: {ver!r}')
for rel, pat in [('js/core/version.js', r"(APP_VERSION = ')[^']*(')"), ('service-worker.js', r"(const VERSION = ')[^']*(')"), ('android/app/build.gradle', r"(versionName ')[^']*(')")]:
    p = ROOT / rel
    t = p.read_text(encoding='utf-8')
    t2, n = re.subn(pat, lambda m: m.group(1) + ver + m.group(2), t)
    if n != 1:
        sys.exit(f'Nie znaleziono wersji w {rel}')
    p.write_text(t2, encoding='utf-8')
print(ver)
