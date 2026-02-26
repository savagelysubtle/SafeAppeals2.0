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

### `warning: "import.meta" is not available with the "iife" output format`

**Cause:** esbuild warns when bundling ES module code (wasm-bindgen glue) into an IIFE.

**Impact:** None. The `import.meta.url` fallback path in wasm-bindgen's `__wbg_init` is never reached because we explicitly pass the WASM URL via the `data-wasm-url` attribute.

### `error[E0282]: type annotations needed` in `map_err` closures

**Cause:** Rust cannot infer the error type in `map_err` when the source function is generic.

**Fix:** Annotate the closure parameter:
```rust
.map_err(|e: calamine::XlsxError| JsError::new(&e.to_string()))?;
```

### `error[E0716]: temporary value dropped while borrowed`

**Cause:** Common in the writer when working with `zip::ZipArchive`. A temporary value (e.g., from `archive.by_name()`) is dropped before the borrow is used.

**Fix:** Bind the temporary to a `let` variable to extend its lifetime:
```rust
// Wrong:
return archive.by_name(name).is_ok();

// Right:
let result = archive.by_name(name).is_ok();
result
```

### TypeScript: `Property 'X' does not exist on type 'XlsxWriter'`

**Cause:** The WASM module was rebuilt but the TypeScript webview bundle was not. Or a Rust function was removed/renamed but TypeScript still references the old name.

**Fix:**
1. Rebuild both: `bun run build-wasm && bun run build-xlsx-viewer`
2. If the error persists, check that the Rust function exists and has `#[wasm_bindgen]`
3. Check the generated `media/wasm/xlsx_rust_viewer.js` for the exported name

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
3. The renderer expects `model.sheets[0].cells[row][col].value` — verify this structure in the console

### Charts don't appear after creating them

**Symptoms:** Chart wizard completes but no chart overlay shows.

**Check:**
1. Open DevTools and look for `[ChartManager]` log messages
2. Verify the chart's `series` have populated `dataCache` and `categoryCache` arrays
3. Check that `resolveChartData()` ran successfully (look for console warnings about missing data references)
4. If charts disappear when switching tabs, verify `vscode.setState()` / `getState()` are preserving chart state

### Charts don't appear in Excel after saving

**Symptoms:** File saves successfully and reopens in the viewer with charts, but Excel shows no charts.

**Check:**
1. Open DevTools and look for `[XLSX Writer]` log messages during save — they should show chart injection activity
2. Verify the WASM module is up to date: `bun run build-wasm && bun run build-xlsx-viewer`
3. Open the saved `.xlsx` file as a ZIP and check for:
   - `xl/charts/chart1.xml` — OOXML chart definition
   - `xl/drawings/drawing1.xml` — drawing with two-cell anchor
   - `xl/drawings/_rels/drawing1.xml.rels` — relationship linking drawing to chart
   - `[Content_Types].xml` — should include entries for charts and drawings
   - Worksheet XML should have a `<drawing r:id="rIdN"/>` element
4. If any of these are missing, the `inject_chart_files()` function in `writer.rs` may have encountered an error

### `FileSystemError: EBUSY: resource busy or locked`

**Cause:** The `.xlsx` file is open in another application (typically Microsoft Excel).

**Fix:** Close the file in Excel before saving from the viewer. Excel holds exclusive locks on open files.

### `Ignored call to 'print()'. The document is sandboxed`

**Cause:** The webview iframe has CSP restrictions that prevent direct `window.print()` calls.

**Impact:** The viewer works around this by capturing the canvas as an image and sending it to the extension host, which creates a temporary HTML document for printing. If you see this warning, printing should still work via the fallback mechanism.

### PDF thumbnails all show the last page

**Note:** This issue is in the PDF viewer, not the XLSX viewer, but is documented here for reference since both viewers share WASM patterns.

**Cause:** WASM reuses the same memory buffer for rendered pages. If thumbnails are generated without copying pixel data, all thumbnails reference the same buffer (which contains the last rendered page).

**Fix:** Explicitly copy `ImageData` pixel data for each thumbnail:
```typescript
const copy = new Uint8ClampedArray(imageData.data);
const thumbnailData = new ImageData(copy, imageData.width, imageData.height);
```

---

## Common Development Issues

### Changes to Rust code don't appear after reload

**Fix:** You need to run **both** build steps:
```bash
bun run build-wasm && bun run build-xlsx-viewer
```
The first compiles Rust to WASM and outputs to `media/wasm/`. The second rebundles the wasm-bindgen JS glue into the IIFE.

### Changes to media TypeScript don't appear after reload

**Fix:** Run:
```bash
bun run build-xlsx-viewer
```
Then reload the window. The media files are not part of the VSCode watch mode — they have their own build step.

### Changes to extension host TypeScript don't appear

**Fix:** These files (`xlsxRustViewerEditor.ts`, etc.) are compiled by the main VSCode build:
```bash
bun run compile
```
Or let the watch mode (`bun run watchd`) pick them up automatically. Then reload the window.

### The viewer doesn't appear or files open in a text editor

**Check:**
1. Verify the registration in `documentViewer.contribution.ts` is intact
2. Verify the imports for `XLSXRustViewerEditor`, `XLSXRustViewerInput`, `XLSXRustViewerInputSerializer` are not broken
3. Recompile the extension host code: `bun run compile`
4. Reload the window
5. The viewer should be registered at `RegisteredEditorPriority.exclusive` — if it's at `option` priority, files won't open in it by default

### `TypeError: this.resource.toJSON is not a function`

**Cause:** The `XLSXRustViewerInput` serializer was called with a deserialized input where `resource` is a plain object instead of a `URI` instance.

**Fix:** The serializer's `deserialize()` method must use `URI.revive()`:
```typescript
const resource = URI.revive(parsed.resource);
```
And `toJSON()` should handle the case where `resource` may not have a `toJSON` method:
```typescript
toJSON() {
    return JSON.stringify({ resource: this.resource });
}
```

### Old WASM version running despite rebuild

**Symptoms:** Console log messages don't match the code you wrote. Charts or other features behave as if using old code.

**Check:**
1. Verify the WASM binary was updated: check the file modification time of `media/wasm/xlsx_rust_viewer_bg.wasm`
2. Verify the JS bundle was updated: check the file modification time of `media/xlsxRustViewer.js`
3. Run both builds in sequence: `bun run build-wasm && bun run build-xlsx-viewer`
4. Hard reload the window after rebuilding
