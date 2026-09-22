from pathlib import Path
import sys

assets = Path(sys.argv[1] if len(sys.argv) > 1 else 'android-bts/app/src/main/assets')
app = assets / 'app.js'
index = assets / 'index.html'

s = app.read_text(encoding='utf-8')
s = s.replace('const UKE_ONLINE_IMPORT_ENABLED = false;', 'const UKE_ONLINE_IMPORT_ENABLED = true;')
old = "throw new Error(`${sourceNameFromUrlSafe(url)}: ${err.message}. Publiczne CORS-proxy są wyłączone; użyj bezpośredniego linku z prawidłowym CORS albo importu ręcznego.`);"
new = """try {
      if (window.AndroidNative) {
        const binary = /spreadsheet|excel|octet-stream/i.test(accept);
        if (binary && AndroidNative.fetchBase64) {
          const b64 = AndroidNative.fetchBase64(url);
          if (b64) {
            const raw = atob(b64);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            return new Response(bytes, { status: 200 });
          }
        } else if (AndroidNative.fetchText) {
          const text = AndroidNative.fetchText(url);
          if (text) return new Response(text, { status: 200 });
        }
      }
    } catch (_) {}
    throw new Error(`${sourceNameFromUrlSafe(url)}: ${err.message}. Pobieranie z UKE nie powiodło się.`);"""
if old in s:
    s = s.replace(old, new)
else:
    print('UWAGA: blok CORS nie został podmieniony')
app.write_text(s, encoding='utf-8')

html = index.read_text(encoding='utf-8')
addons = ['terrain-addon.js', 'ui-addon.js', 'radio13-core.js', 'radio13-fix.js', 'radio13-ui.js', 'radio13-events.js', 'radio13-si2pem.js']
for name in addons:
    html = html.replace(f'<script src="{name}"></script>', '')
    html = html.replace(f'<script src="{name}" defer></script>', '')
anchor = '<script src="app.js" defer></script>'
if anchor not in html:
    raise SystemExit('Brak app.js w index.html')
addon_html = '\n'.join(f'<script src="{name}" defer></script>' for name in addons)
html = html.replace(anchor, anchor + '\n' + addon_html)
index.write_text(html, encoding='utf-8')
print('Patched app.js and index.html for BTS Asystent 1.3')
