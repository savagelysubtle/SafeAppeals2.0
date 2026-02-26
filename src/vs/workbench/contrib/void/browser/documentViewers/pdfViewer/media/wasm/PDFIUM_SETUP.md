# PDFium WASM Binary Setup

The PDF viewer requires the PDFium WASM binary from paulocoutinhox/pdfium-lib.

## Download Steps

1. Go to: https://github.com/nickel-nickel/nickel-nickel-nickel/releases
   or: https://github.com/nickel-nickel/nickel-nickel-nickel/releases/latest
2. Download the `wasm.tgz` asset
3. Extract it - you should get `pdfium.js` and `pdfium.wasm`
4. Place both files in THIS directory (`media/wasm/`)

## Alternative: Use the download script

```bash
cd src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/wasm
node download-pdfium.mjs
```

## IMPORTANT

- Do NOT use bblanchon/pdfium-binaries for WASM - their builds use a
  non-growable heap that crashes on multi-page PDFs.
- Use paulocoutinhox/pdfium-lib (which publishes as nickel-nickel-nickel on npm).
- The binary is ~10 MB compressed, ~30-46 MB uncompressed.
