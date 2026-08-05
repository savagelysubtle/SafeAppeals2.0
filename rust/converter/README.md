# sa-converter

SafeAppeals file converter sidecar. Long-lived NDJSON protocol on stdin/stdout; logs go to stderr only.

## Build

From the repository root:

```bash
cd rust
cargo build -p sa-converter
```

Production / full engine surface (LibreOffice warm worker):

```bash
cargo build -p sa-converter --features libreoffice --release
```

Release binary:

```bash
cargo build -p sa-converter --release
```

The binary is `sa-converter` (see `target/debug/sa-converter` or `target/release/sa-converter`).

## Test

Default CI (pure Rust, no LO/browser/OCR spawn):

```bash
cd rust
cargo test -p sa-converter
```

Optional integration tests (require system tools):

```bash
# LibreOffice
cargo test -p sa-converter --features libreoffice -- --ignored

# Browser-print (Chrome/Chromium)
cargo test -p sa-converter --test browser_tests -- --ignored

# OCR (Tesseract / ocrmypdf)
cargo test -p sa-converter --test ocr_tests -- --ignored
```

Golden fixtures live under `fixtures/`; integration tests under `tests/`.

## Manual smoke test

```bash
cargo run -p sa-converter
```

Then send NDJSON lines on stdin:

```json
{"id":"1","method":"ping","params":{}}
{"id":"2","method":"get_available_conversions","params":{}}
{"id":"3","method":"configure","params":{"roots":["/path/to/workspace"]}}
{"id":"4","method":"convert","params":{"input":"/path/to/workspace/in.md","output":"/path/to/workspace/out.html","type":"md2html"}}
{"id":"5","method":"shutdown","params":{}}
```

Each response is one JSON object per line on stdout.

`configure` probes system tools (`--version` only; no spawn). Browser/OCR/LO jobs spawn on first `convert`.

Optional configure overrides:

```json
{
  "roots": ["/path/to/workspace"],
  "chromium_path": "/usr/bin/google-chrome-stable",
  "lo_profile_dir": "/tmp/safeappeals-lo-profile"
}
```

Environment: `SAFEAPPEALS_CHROME_PATH` overrides Chromium detection.

## Conversions

### P1 — pure Rust (always available in CI)

Utility-tier pairs in `src/engines/`: markdown, docx, epub, html, spreadsheet, pptx text extract, image, pdf text extract (`pdf-extract`), PDF ops (`lopdf`), `merge_pdfs`, and `batch_convert`.

### P2 — LibreOffice (feature `libreoffice`)

Office-fidelity: `docx2pdf`, `xlsx2pdf`, `pptx2pdf`, `epub2pdf`, `pptx2images`. Warm worker with dedicated profile; macros disabled. Hard-disabled without `soffice`.

### P3 — browser-print + OCR (PATH detect, no feature gate)

**Browser-print** (`html2pdf`, court `md2pdf`): headless Chrome/Chromium `--print-to-pdf`. Detection order: `SAFEAPPEALS_CHROME_PATH` → configure `chromium_path` → Google Chrome → Chromium. Local `file://` only; no remote URLs.

**OCR** (fidelity `ocr`, never default for filings):

| Key | Tool | Available when |
|-----|------|----------------|
| `image2text` | Tesseract | `tesseract` on PATH |
| `pdf2ocr_layer` | ocrmypdf | `ocrmypdf` on PATH |
| `pdf2editable` | ocrmypdf | `ocrmypdf` on PATH |

Still unavailable: `pdf2encrypt` (not implemented), `pdf2xlsx`.

## Dependencies

Pure Rust — no system packages required for default CI. External BYO for court/OCR paths:

- **LibreOffice** (`soffice`) — `--features libreoffice` for compile-time LO module
- **Google Chrome / Chromium** — browser-print
- **Tesseract + ocrmypdf** — OCR keys

Uses `pdf-extract` + `lopdf` for PDF text/ops (not pdfium). Pin `image = "0.24"` to match `printpdf 0.7`.
