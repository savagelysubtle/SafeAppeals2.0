# PDF Viewer Developer Guide

## Table of Contents

1. [File Responsibilities](#file-responsibilities)
2. [Extension Host (pdfViewerEditor.ts)](#extension-host-pdfviewereditorsts)
3. [Webview Coordinator (main.ts)](#webview-coordinator-maints)
4. [Canvas Renderer (renderer.ts)](#canvas-renderer-rendererts)
5. [Sidebar (sidebar.ts)](#sidebar-sideparts)
6. [Annotation Manager (annotations.ts)](#annotation-manager-annotationsts)
7. [Signature Manager (signatures.ts)](#signature-manager-signaturests)
8. [Rust WASM Layer (renderer.rs)](#rust-wasm-layer-rendererrs)
9. [Key Design Decisions](#key-design-decisions)
10. [Common Extension Patterns](#common-extension-patterns)
11. [Known Limitations](#known-limitations)

---

## File Responsibilities

| File | Process | Responsibility |
|---|---|---|
| `pdfViewerEditor.ts` | Extension host | VSCode editor pane, webview lifecycle, file I/O, persistence |
| `pdfViewerInput.ts` | Extension host | `EditorInput` subclass identifying PDF files |
| `pdfAnnotationService.ts` | Extension host | Annotation CRUD, persistence, change events |
| `media/main.ts` | Webview | Entry point, WASM initialization, message loop, PDF load coordination |
| `media/renderer.ts` | Webview | Canvas painting (`putImageData`), text layer DOM construction |
| `media/sidebar.ts` | Webview | Thumbnail rendering, outline display, bookmark list |
| `media/annotations.ts` | Webview | Highlight/signature DOM rendering, selection, delete |
| `media/signatures.ts` | Webview | Signature modal, draw/type modes, placement, drag/resize |
| `wasm/src/lib.rs` | WASM | Crate root, panic hook registration |
| `wasm/src/renderer.rs` | WASM | `PdfRenderer` — PDF load, page render, text extraction, outline |

---

## Extension Host (pdfViewerEditor.ts)

`PDFViewerEditor` extends `EditorPane` and manages the webview overlay.

### Lifecycle

```
constructor()
  → registers pdfAnnotationService.onDidChangeAnnotations listener
  
createEditor(parent)
  → creates #pdf-viewer-container div

setInput(input, options, context, token)
  → creates IOverlayWebview if needed (webviewService.createWebviewOverlay)
  → claims/layouts webview
  → registers message handler
  → calls getWebviewHTML() and webview.setHtml()
  → either: loads PDF immediately (if webview ready)
  →     or: stores as _pendingInput (waits for 'ready' message)

handleWebviewMessage(message)
  → routes by message.type (see API Reference)

loadPDF(input, startPage)
  → fileService.readFile() → chunked base64 conversion → postMessage('loadPDF')
  → caches base64 in _pdfDataCache

dispose()
  → webview.release()
```

### Caching Strategy

`_pdfDataCache` stores the last loaded PDF as `{ uri, data: base64 }`. When the same PDF is opened again (e.g., switching between editor tabs), the cached base64 is re-sent with `skipPreload: true` to avoid re-rendering all pages.

`_webviewReady` and `_pendingInput` handle the race condition where `setInput` is called before the webview finishes loading. The webview sends a `'ready'` message when WASM initialization completes.

### Page Persistence

Pages are stored in `IStorageService` using `StorageScope.WORKSPACE (-1)`:
```
key: 'pdfViewer.lastPage.' + pdfUri
value: pageNumber (number)
```

### Webview HTML

`getWebviewHTML()` builds the full HTML string injected into the webview. Key elements:
- `#config` div: carries `data-wasm-url` and `data-pdfium-url` attributes (webview-safe URIs)
- `#pdf-viewer-layout`: main flex layout container
- `#sidebar`: left panel with three tabs
- `#pdf-container`: right panel with controls, canvas wrapper, and annotation toolbar
- `#signature-modal`: overlay modal for signature creation

Scripts are loaded with a per-session nonce for CSP compliance:
1. `pdfium.js` (Emscripten glue, loaded first)
2. `pdfRustViewer.js` (esbuild bundle of all TypeScript modules)

---

## Webview Coordinator (main.ts)

`main.ts` is the entry point for all webview-side code. It owns the top-level state and coordinates between modules.

### Module Initialization

```typescript
initialize()
  → new PdfCanvasRenderer(canvas, textLayer, renderContainer)
  → new Sidebar(thumbnails, outline, bookmarks, onNavigate)
  → new AnnotationManager(getCurrentPage, getScale, getPdfUri, postMessage)
  → new SignatureManager(getCurrentPage, getScale, getPdfUri, postMessage, annotationManager)
  → setupUIHandlers()
  → initializeWasm()  // async, dual-WASM load sequence
```

### Key State Variables

| Variable | Type | Description |
|---|---|---|
| `pdfRenderer` | `PdfRenderer \| null` | Rust WASM renderer instance |
| `canvasRenderer` | `PdfCanvasRenderer \| null` | Canvas painting helper |
| `currentPage` | `number` | 1-indexed current page |
| `pageCount` | `number` | Total page count from PDF metadata |
| `scale` | `number` | Current zoom (default 0.8; range 0.5–3.0) |
| `pageDimensions` | `Array<{width,height}>` | Per-page dimensions in PDF points |
| `imageDataCache` | `Map<number, ImageData>` | Pre-rendered page cache |
| `wasmReady` | `boolean` | Whether WASM init completed |
| `pendingLoadMessage` | `MessageEvent['data'] \| null` | Load message buffered before WASM ready |
| `preloadStrategy` | `string` | `'all'` or `'adjacent'` (from host settings) |

### Preload Strategies

- `'all'`: Renders all pages (max 500) into `imageDataCache` after initial page load. Best for small–medium PDFs.
- `'adjacent'`: Renders ±2 pages around the current page. Evicts pages outside ±5 window. Best for large PDFs.
- `'none'`: No preloading (only current page rendered on demand).

---

## Canvas Renderer (renderer.ts)

`PdfCanvasRenderer` is a thin wrapper over the canvas 2D context, responsible for:

1. **`renderImageData(imageData, width, height)`** — Resizes the `<canvas>` element and calls `putImageData`
2. **`renderTextLayer(blocks, pageWidth, pageHeight, scale)`** — Converts WASM text blocks (PDF point space) to absolutely-positioned transparent `<span>` elements over the canvas
3. **`ensureHighlightLayer()`** — Creates/returns the `#pdf-highlight-layer` div (z-index: 3)

### Coordinate System

PDF uses a bottom-left origin with points as units. The screen uses a top-left origin with pixels.

The WASM layer already converts Y-coordinates: `y = pageHeight - obj_top` (flipped from PDF to screen space).

The TypeScript layer then scales from PDF points to canvas pixels:
```
scaleX = canvasWidth / pageWidthInPoints
scaleY = canvasHeight / pageHeightInPoints

pixelLeft = block.x * scaleX
pixelTop  = block.y * scaleY
```

The canvas pixel size is computed by: `pixelWidth = round(pdfWidth × scale × 96/72)`

---

## Sidebar (sidebar.ts)

`Sidebar` manages three tabs: **Thumbnails**, **Outline**, and **Bookmarks**.

### Thumbnails

- Rendered via WASM at 150px max width (`pdfRenderer.render_thumbnail(index, 150)`)
- Generated in batches of 5 with `setTimeout(0)` yields between batches to avoid blocking the main thread
- Each thumbnail is a `<canvas>` element with `putImageData`
- Clicking navigates to that page (`onNavigate` callback)
- Active thumbnail gets the `active` class and is scrolled into view

### Outline

- Extracted from PDF bookmarks via `pdfRenderer.get_outline()`
- Rendered recursively up to 3 indent levels (`level-1`, `level-2`, `level-3` classes)
- Page index is 0-based from WASM; sidebar converts to 1-based for navigation
- If no bookmarks exist, shows "No outline available" placeholder

### Bookmarks

- Sourced from the annotation system (annotations with `color: 'bookmark'`)
- Sorted by page number
- Each item shows label, page number, and a delete button
- Delete dispatches `CustomEvent('deleteBookmark', { detail: id })` — caught in `main.ts`

---

## Annotation Manager (annotations.ts)

`AnnotationManager` handles the webview side of the annotation system.

### Key Methods

| Method | Description |
|---|---|
| `setAnnotations(annotations)` | Replaces the local annotation array (called when host pushes updates) |
| `addLocalAnnotation(annotation)` | Adds without notifying host (used for optimistic signature placement) |
| `createHighlightFromSelection(page, scale)` | Reads `window.getSelection()`, computes bounding boxes, sends `addAnnotation` message |
| `renderAnnotations(page, scale)` | Clears and re-renders all annotations for the current page |
| `selectAnnotation(id)` | Adds `selected` CSS class and blue outline |
| `deselectAll()` | Removes all selection styling |
| `deleteSelectedAnnotation()` | Sends `deleteAnnotation` message for the currently selected annotation |
| `updateAnnotationBoundingBoxes(id, boxes)` | Updates local state and sends `updateAnnotation` message (used after drag/resize) |

### Annotation Colors

```typescript
const COLOR_MAP = {
    yellow: 'rgba(255, 235, 59, 0.4)',
    green:  'rgba(76, 175, 80, 0.4)',
    blue:   'rgba(33, 150, 243, 0.4)',
    pink:   'rgba(233, 30, 99, 0.4)',
};
```

`mix-blend-mode: multiply` on highlight divs means the color blends with the text below without obscuring it.

### Signature Rendering

Signature annotations (`color: 'signature'`) are rendered as `div.pdf-signature-container` containing an `<img>` element. Eight resize handles (directional: nw, ne, sw, se, n, s, e, w) are appended as child divs. The `SignatureManager` is wired to these handles via callback properties on `AnnotationManager`:
- `onSignatureStartDrag`
- `onSignatureStartResize`  
- `onSignatureContextMenu`

---

## Signature Manager (signatures.ts)

`SignatureManager` owns all signature-related UI and interaction.

### Create Flow

1. User clicks "✍️ Signature" button
2. `showModal()` — displays the signature modal, requests saved signatures from host
3. **Draw mode**: Freehand canvas drawing with mouse/touch support
4. **Type mode**: Text input rendered to canvas with cursive CSS fonts
5. User clicks "Done" → `doneSignature()` calls `enterPlacementMode()`
6. **Placement mode**: Cursor becomes crosshair; a click listener added to `document`
7. User clicks on the PDF canvas → `placeSignature()` computes relative PDF coordinates → sends `addSignatureAnnotation` message

### Available Signature Fonts (Type Mode)

| Option | Font Family |
|---|---|
| Classic Script | "Brush Script MT", cursive |
| Elegant Cursive | "Lucida Handwriting", cursive |
| Modern Script | "Segoe Script", cursive |
| Bold Signature | "Edwardian Script ITC", cursive |

### Drag & Resize

Both operations are handled via `document`-level `mousemove`/`mouseup` listeners (called from `main.ts` global handlers `handleGlobalMouseMove` and `handleGlobalMouseUp`).

**Drag**: Tracks `dragOffsetX/Y` from the mousedown event; repositions the element via `style.left/top` on mousemove.

**Resize**: Uses `originalBounds` captured at resize start and computes new bounds based on which handle is active (8 directions). Minimum size: 20px.

When drag/resize completes, `annotationManager.updateAnnotationBoundingBoxes()` persists the new position/size through the host's annotation service.

---

## Rust WASM Layer (renderer.rs)

### PdfRenderer struct

```rust
pub struct PdfRenderer {
    pdf_bytes: Option<Vec<u8>>,   // Full PDF stored in WASM memory
    page_count: u32,
    password: Option<String>,
}
```

PDF bytes are re-loaded from memory on each operation rather than holding a live `PdfDocument` reference. This is intentional: `pdfium-render` documents hold references to the `Pdfium` singleton which complicates `wasm-bindgen` struct storage. Re-opening from bytes has negligible overhead compared to the rendering cost.

### Static Pdfium Instance

```rust
static PDFIUM: OnceLock<Pdfium> = OnceLock::new();
```

`OnceLock` ensures the `Pdfium` binding is created exactly once per WASM module lifetime. The singleton is initialized by calling `initialize_pdfium_render()` from JavaScript after both WASM modules are ready.

### Exposed API

| Function | Signature | Description |
|---|---|---|
| `load` | `(&mut self, data: &[u8]) -> Result<String, JsError>` | Load PDF, return JSON metadata |
| `render_page` | `(&self, index: i32, width: u16, height: u16) -> Result<ImageData, JsError>` | Render page at pixel size |
| `render_thumbnail` | `(&self, index: i32, max_width: u16) -> Result<ImageData, JsError>` | Render at max width, preserving aspect ratio |
| `get_page_text` | `(&self, index: i32) -> Result<String, JsError>` | Extract text blocks as JSON array |
| `get_outline` | `(&self) -> Result<String, JsError>` | Extract bookmarks/outline as JSON |
| `get_page_dimensions` | `(&self, index: i32) -> Result<String, JsError>` | Get page size in PDF points |
| `page_count` | `(&self) -> u32` | Return total page count |
| `close` | `(&mut self)` | Free PDF bytes from memory |

All page indices are **0-based** in the Rust API. JavaScript callers subtract 1 before calling.

---

## Key Design Decisions

### Why Dual WASM?

PDFium is a C++ library compiled to WASM via Emscripten. Rust's `pdfium-render` crate provides safe, idiomatic Rust bindings that call into the Emscripten WASM module. Both binaries must be loaded — the Emscripten module does the actual PDF work while the Rust module provides the JS-facing API surface.

### Why Store PDF Bytes in Rust?

`pdfium-render` documents borrow from the `Pdfium` singleton's lifetime. Storing a `PdfDocument` in a `wasm-bindgen` struct would require lifetime annotations that wasm-bindgen cannot express across the JS boundary. Storing raw bytes and re-opening per-call is the standard workaround.

### Why Base64 Transfer?

The VSCode webview `postMessage` API uses structured clone for object transfer. `Uint8Array` can be transferred via structured clone, but the extension host reads the file as a `VSBuffer` which requires conversion. Base64 was chosen for its universality and simplicity, with chunked encoding (8KB chunks) to avoid stack overflows on large files.

### Why esbuild instead of webpack/rollup?

esbuild is significantly faster and already available in the Void toolchain. The webview bundle is an IIFE (self-executing function) since ES modules are not available in VSCode webviews without additional scaffolding.

### Why `mix-blend-mode: multiply` for highlights?

Multiply blend mode darkens based on the underlying color, making highlights look natural against both white and colored PDF backgrounds. A simple semi-transparent overlay would wash out text; multiply preserves readability.

---

## Common Extension Patterns

### Adding a New Message Type

**In the webview** (`main.ts`):
```typescript
// In the window.addEventListener('message', ...) handler
case 'myNewMessage':
    // handle message
    break;
```

**In the host** (`pdfViewerEditor.ts`):
```typescript
// In handleWebviewMessage(), switch on data.type
case 'myNewMessage':
    // handle message from webview
    break;
```

To send from host to webview:
```typescript
this.webview.postMessage({ type: 'myNewMessage', ...data });
```

To send from webview to host:
```typescript
vscode.postMessage({ type: 'myNewMessage', ...data });
```

### Adding a New Rust WASM Method

1. Add the method to `PdfRenderer` in `wasm/src/renderer.rs` with `#[wasm_bindgen]`
2. Rebuild: `cd wasm && .\build.ps1` (Windows) or `./build.sh` (Unix)
3. The method will be available in TypeScript via the generated `pdf_viewer.js` glue

### Adding a New Annotation Type

1. Add a new `color` value constant (e.g., `'underline'`)
2. Handle it in `AnnotationManager.renderAnnotations()` — add a new `renderXxxAnnotation()` method
3. Add a UI button in `pdfViewerEditor.ts → getWebviewHTML()`
4. Wire the button in `main.ts → setupUIHandlers()`

---

## Known Limitations

| Limitation | Detail |
|---|---|
| Non-embedded fonts | Some PDFs with non-embedded fonts may show fallback text rendering. Strategy 1 (page objects) mitigates this but cannot reconstruct glyphs from CID fonts. |
| Password-protected PDFs | The `PdfRenderer` has a `password` field but there is currently no UI to prompt for a password. Password must be set before `load()`. |
| PDF form editing | Forms are rendered (via `render_form_data(true)`) but are not interactive. Field values cannot be changed. |
| PDF page reflow | The viewer renders fixed-size bitmaps; it does not support PDF reflowable content (e.g., tagged PDF/accessibility trees). |
| Large PDF preloading | Preloading all pages of a very large PDF (1000+ pages) may consume significant memory. The limit is hardcoded to 500 pages. |
| Annotation export | Annotations are stored in VSCode storage and overlaid on the view, but they are not embedded into the PDF file itself. |
| Signature embedding | Signature placement annotations are stored as bounding-box overlays, not embedded into PDF as digital signatures. |
| Print quality | Printing is handled by opening the original PDF in the system browser, which bypasses any in-viewer annotations. |
