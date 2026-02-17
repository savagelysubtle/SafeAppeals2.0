# Troubleshooting

## Build Errors

### `bun: command not found: wasm-pack`

**Cause:** `wasm-pack` is not installed.

**Fix:**
```bash
cargo install wasm-pack
```

### `error: The wasm32-unknown-unknown target is not installed`

**Cause:** The Rust WASM compilation target is missing.

**Fix:**
```bash
rustup target add wasm32-unknown-unknown
```

### `error: The wasm32-unknown-unknown targets are not supported by default` (from `getrandom`)

**Cause:** The `getrandom` crate (pulled in by dependencies) requires explicit WASM feature flags.

**Fix:** Ensure `Cargo.toml` includes:
```toml
getrandom = { version = "0.3", features = ["wasm_js"] }
```

### `error: package depends on polars with feature X but polars does not have that feature`

**Cause:** Polars feature names change between versions.

**Fix:** Check the [Polars docs](https://docs.rs/polars) for the correct feature names at the version specified in `Cargo.toml`. Current working features:
```toml
polars = { version = "0.45", default-features = false, features = ["lazy", "dtype-categorical", "strings", "csv"] }
```

### `error[E0599]: no method named X found for struct polars::prelude::CsvReadOptions`

**Cause:** Polars API changes frequently between versions. The CSV reader API is particularly unstable.

**Fix:** The current `table_ops.rs` avoids `CsvReadOptions` entirely and uses `DataFrame::new()` + `Column::new()` directly. If you need CSV parsing, check the Polars version-specific API.

### `warning: "import.meta" is not available with the "iife" output format`

**Cause:** esbuild warns when bundling ES module code (wasm-bindgen glue) into an IIFE.

**Impact:** None. The `import.meta.url` fallback path in wasm-bindgen's `__wbg_init` is never reached because we explicitly pass the WASM URL via the `data-wasm-url` attribute.

### `error[E0282]: type annotations needed` in `map_err` closures

**Cause:** Rust cannot infer the error type in `map_err` when the source function is generic.

**Fix:** Annotate the closure parameter:
```rust
.map_err(|e: calamine::XlsxError| JsError::new(&e.to_string()))?;
```

---

## Runtime Errors

### WASM fails to load in the webview

**Symptoms:** Console shows "WASM init failed" or a CSP violation.

**Check:**
1. Open DevTools in the webview (`Help` -> `Toggle Developer Tools`)
2. Look for CSP errors in the Console tab
3. Verify the CSP in `xlsxRustViewerEditor.ts` includes:
   - `'wasm-unsafe-eval'` in `script-src`
   - The WASM file URI in `connect-src`
   - `vscode-resource:` in `script-src`

### Webview shows blank / no canvas

**Symptoms:** Editor opens but nothing renders.

**Check:**
1. Console should show `[XLSX Rust Viewer] Initializing...` and `[XLSX Rust Viewer] WASM initialized successfully`
2. If you see `No WASM URL provided`, the `data-wasm-url` attribute is not being set
3. Verify `media/wasm/xlsx_rust_viewer_bg.wasm` exists (run `bun run build-wasm`)
4. Verify `media/xlsxRustViewer.js` exists (run `bun run build-xlsx-viewer`)

### File loads but nothing renders

**Symptoms:** Console shows "File parsed, rendering..." but canvas is blank.

**Check:**
1. The JSON returned by `parser.load()` may be empty or malformed
2. Check that the model has `sheets[0].cells` with data
3. The renderer expects `model.sheets[0].cells[row][col].value` -- verify this structure in the console

### "WASM not initialized" error in Worker

**Note:** The Worker (`worker.ts`) is **not currently used**. The POC loads WASM directly on the main webview thread. If you see this error, something is importing/running the worker code incorrectly.

### Scroll performance is poor

**Possible causes:**
- The full `WorkbookModel` JSON is parsed on every scroll (it shouldn't be -- the model is held in memory)
- DPI scaling may be triggering unnecessary redraws
- Very large files may exceed the main thread's capacity (solution: move to Web Worker)

**Mitigation:** The renderer uses `requestAnimationFrame` for scroll redraws and only draws visible cells. For files with >100K rows, consider implementing the Web Worker architecture.

---

## Common Development Issues

### Changes to Rust code don't appear after reload

**Fix:** You need to run **both** build steps:
```bash
bun run build-wasm && bun run build-xlsx-viewer
```
The first compiles Rust to WASM. The second re-bundles the wasm-bindgen JS glue into the IIFE.

### Changes to media TypeScript don't appear after reload

**Fix:** Run:
```bash
bun run build-xlsx-viewer
```
Then reload the window. The media files are not part of the VSCode watch mode -- they have their own build step.

### Changes to extension host TypeScript don't appear

**Fix:** These files (`xlsxRustViewerEditor.ts`, etc.) are compiled by the main VSCode build:
```bash
bun run compile
```
Or let the watch mode (`bun run watchd`) pick them up automatically. Then reload the window.

### The viewer doesn't appear in "Open With..." menu

**Check:**
1. Verify the registration in `documentViewer.contribution.ts` is intact
2. Verify the imports for `XLSXRustViewerEditor`, `XLSXRustViewerInput`, `XLSXRustViewerInputSerializer` are not broken
3. Recompile the extension host code: `bun run compile`
4. Reload the window

### WASM binary is too large

The current WASM binary is ~10 MB due to Polars and Arrow. To reduce size:

1. **Remove Polars** if table ops are not needed (saves ~5-7 MB)
2. **Use `wasm-opt -Oz`** for aggressive size optimization (wasm-pack does this by default in release mode)
3. **Use `default-features = false`** on all dependencies
4. **Consider `wasm-pack build --release`** (already the default)
5. **Gzip/Brotli compression** at the webview level would reduce transfer size (not currently implemented)
