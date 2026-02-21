# Developer Guide

## Prerequisites

Before working on the XLSX Rust Viewer, ensure you have:

1. **Rust toolchain** — install via [rustup](https://rustup.rs)
2. **WASM target** — `rustup target add wasm32-unknown-unknown`
3. **wasm-pack** — `cargo install wasm-pack`
4. **Node.js / Bun** — already available in the repo
5. **esbuild** — available via npx (already a transitive dependency)

## Build Commands

### Full Build (both steps)

```bash
bun run build-wasm && bun run build-xlsx-viewer
```

### Step 1: Compile Rust to WASM

```bash
bun run build-wasm
```

This runs:
```bash
cd src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/wasm \
  && wasm-pack build --target web --out-dir ../media/wasm --no-typescript
```

**Output** (written directly to `media/wasm/`):
- `media/wasm/xlsx_rust_viewer_bg.wasm` — the WASM binary
- `media/wasm/xlsx_rust_viewer.js` — wasm-bindgen JS glue (ES module)

**Timing:** ~60s first build (downloads/compiles all dependencies), ~4s incremental.

### Step 2: Bundle Webview TypeScript

```bash
bun run build-xlsx-viewer
```

This runs:
```bash
node src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/build.mjs
```

**Output:**
- `media/xlsxRustViewer.js` — bundled IIFE containing `main.ts` + `renderer.ts` + `ribbon.ts` + `chartManager.ts` + `chartWizardDialog.ts` + `filterDropdown.ts` + `conditionalFormatDialog.ts` + `contextMenu.ts` + Chart.js + wasm-bindgen JS glue

**Timing:** ~30ms.

### After Building

1. Reload the VSCode window: `Ctrl+Shift+P` -> "Developer: Reload Window"
2. Open any `.xlsx` file — the Rust viewer is the default handler

## Development Workflow

### Modifying Rust Code

1. Edit files in `wasm/src/`
2. Run `bun run build-wasm`
3. Run `bun run build-xlsx-viewer` (the esbuild rebundles the new wasm-bindgen JS glue)
4. Reload the VSCode window

### Modifying Webview TypeScript (renderer, main, ribbon, charts, etc.)

1. Edit files in `media/` (`main.ts`, `renderer.ts`, `ribbon.ts`, `chartManager.ts`, etc.)
2. Run `bun run build-xlsx-viewer`
3. Reload the VSCode window

### Modifying Extension Host TypeScript (editor, input, registration)

1. Edit files in the `xlsxRustViewer/` root (`xlsxRustViewerEditor.ts`, etc.)
2. These are compiled by the main VSCode build system (`bun run compile` or watch mode)
3. Reload the VSCode window

## Adding a New Rust Module

1. Create `wasm/src/my_module.rs`
2. Add `pub mod my_module;` to `wasm/src/lib.rs`
3. Use `#[wasm_bindgen]` on any structs/functions to export to JS
4. Run `bun run build-wasm` — wasm-bindgen auto-generates JS bindings
5. Import the new class/function in `media/main.ts` from `./wasm/xlsx_rust_viewer.js`
6. Run `bun run build-xlsx-viewer` to rebundle

### Example: Adding a Search Module

```rust
// wasm/src/search.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SearchEngine;

#[wasm_bindgen]
impl SearchEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> SearchEngine {
        SearchEngine
    }

    pub fn find(&self, model_json: &str, query: &str) -> Result<String, JsError> {
        // ... search logic ...
        Ok("[]".to_string())
    }
}
```

```rust
// wasm/src/lib.rs — add:
pub mod search;
```

```typescript
// media/main.ts — add:
import init, { ..., SearchEngine } from './wasm/xlsx_rust_viewer.js';

let search: SearchEngine | null = null;
// In initialize():
search = new SearchEngine();
```

## Adding a New Webview Component

The webview is bundled as a single IIFE by `build.mjs`. To add a new UI component:

1. Create `media/myComponent.ts`
2. Import and use it from `media/main.ts`
3. Run `bun run build-xlsx-viewer` — esbuild will include it automatically
4. If it needs CSS, add inline styles (the webview has `style-src 'unsafe-inline'`)

Existing components follow a pattern of:
- A class that creates/manages DOM elements
- Callbacks for user actions (passed in or set as properties)
- A `dispose()` or `hide()` method for cleanup

## Adding Rust Dependencies

1. Add the dependency to `wasm/Cargo.toml`
2. Use `default-features = false` where possible to minimize WASM binary size
3. Ensure the crate supports the `wasm32-unknown-unknown` target
4. If the crate uses random number generation, it may need `getrandom` with the `wasm_js` feature

### WASM Compatibility Notes

| Concern | Solution |
|---------|----------|
| `getrandom` / random | Add `getrandom = { version = "0.3", features = ["wasm_js"] }` |
| File I/O | Not available in WASM — use `Cursor<&[u8]>` for in-memory reads |
| Threading | Not available by default — use single-threaded algorithms |
| Networking | Not available — all data must be passed in via function args |
| `std::time` | Limited — use `js_sys::Date` if needed |

### Key Rust Dependencies

| Crate | Purpose |
|-------|---------|
| `calamine` | Parse XLSX cell data |
| `rust_xlsxwriter` (v0.80) | Generate base XLSX files |
| `quick-xml` | Parse/generate OOXML chart XML |
| `zip` | Read/write ZIP entries for chart injection |
| `serde` / `serde_json` | JSON serialization across WASM boundary |
| `js-sys` | JavaScript interop utilities |
| `console_error_panic_hook` | Better panic messages in browser console |

## Extending the Canvas Renderer

The `CanvasRenderer` class in `media/renderer.ts` handles all visual output. Key extension points:

### Adding a New Visual Element

1. Add drawing logic inside the `render()` method
2. Use the `this.ctx` (CanvasRenderingContext2D) for drawing
3. Respect the viewport bounds: use `startRow`/`endRow`/`startCol`/`endCol` for virtualization
4. Account for scroll offsets (`this.scrollTop`, `this.scrollLeft`)
5. Account for header dimensions (`this.headerHeight`, `this.headerWidth`)
6. Account for variable column widths and row heights (`this.colWidths`, `this.rowHeights`)

### Adding a New Event Handler

1. Add the event listener in the constructor
2. Convert screen coordinates to grid coordinates using `mouseToCanvas()`:
   ```typescript
   const { row, col } = this.mouseToCanvas(e.clientX, e.clientY);
   ```
3. Call `this.render()` after state changes

## Testing

### Manual Testing

1. Build both WASM and JS bundle
2. Reload VSCode
3. Open an `.xlsx` file — it opens in the Rust viewer by default
4. Check the DevTools console (`Help` -> `Toggle Developer Tools`) for `[XLSX Rust Viewer]` log messages

### Rust Unit Tests

```bash
cd src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/wasm
cargo test          # Native tests
wasm-pack test      # WASM tests (requires wasm-bindgen-test)
```

### Verifying WASM Exports

After building, check that the JS glue exports match expectations:

```bash
grep "^export" src/vs/.../xlsxRustViewer/media/wasm/xlsx_rust_viewer.js
```

Expected exports: `ContextMenuManager`, `FormulaEngine`, `TableOps`, `ViewportManager`, `XlsxParser`, `XlsxWriter`, `create_simple_xlsx`, `greet`, `init_panic_hook`, `initSync`, `default` (init).

## File Registration

The viewer is registered in `documentViewer.contribution.ts` with three components:

1. **EditorPane** — `XLSXRustViewerEditor` registered with descriptor ID `'void.xlsxRustViewer'`
2. **Input Serializer** — `XLSXRustViewerInputSerializer` for session restore (with `URI.revive()` for safe deserialization)
3. **Editor Resolver** — `XLSXRustResolverContribution` matches `**/*.{xlsx,xls}` with `RegisteredEditorPriority.exclusive`

The `exclusive` priority means the Rust viewer is the **default handler** for `.xlsx` files. The legacy SheetJS-based viewer has been removed.

## Code Conventions

- **Rust:** Follow standard Rust conventions. Use `#[wasm_bindgen]` on all public API. Return `Result<T, JsError>` for fallible operations.
- **TypeScript (extension host):** Follow VSCode conventions — use dependency injection with `@IServiceName` decorators. Never cast to `any`.
- **TypeScript (webview):** Simpler style since it runs in an isolated iframe. Use `acquireVsCodeApi()` for messaging.
- **Naming:** Type mappings use `bOfA` convention (e.g., `cellDataOfRowCol`).
- **Semicolons:** Follow existing file convention.
