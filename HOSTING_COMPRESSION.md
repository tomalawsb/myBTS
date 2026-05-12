# Kompresja stations.json

Wygenerowane pliki:

- `stations.json` — baza zgodna wstecznie, zwykły JSON.
- `stations.json.br` — Brotli, najlepsza kompresja.
- `stations.json.gz` — Gzip, wariant awaryjny.

Aplikacja domyślnie odpytuje `stations.json`. Na hostingu ustaw kompresję tak, aby żądanie `/stations.json` było obsługiwane jako Brotli/Gzip zależnie od nagłówka `Accept-Encoding`.

Minimalne wymagane nagłówki dla wariantu Brotli:

```text
Content-Type: application/json; charset=utf-8
Content-Encoding: br
Vary: Accept-Encoding
```

Minimalne wymagane nagłówki dla wariantu Gzip:

```text
Content-Type: application/json; charset=utf-8
Content-Encoding: gzip
Vary: Accept-Encoding
```

Jeżeli hosting nie pozwala ustawić nagłówków dla `.br` / `.gz`, zostaw `stations.json` i włącz zwykłą kompresję Brotli/Gzip w panelu hostingu albo na serwerze WWW.
