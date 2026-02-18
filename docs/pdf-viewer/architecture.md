# PDF Viewer Architecture

## Table of Contents

1. [System Overview](#system-overview)
2. [Dual-WASM Architecture](#dual-wasm-architecture)
3. [Component Map](#component-map)
4. [Data Flow](#data-flow)
5. [Rendering Pipeline](#rendering-pipeline)
6. [Text Extraction Strategy](#text-extraction-strategy)
7. [Annotation System](#annotation-system)
8. [Signature System](#signature-system)
9. [State Management](#state-management)
10. [Security Model (CSP)](#security-model-csp)

---

## System Overview

The PDF viewer operates across two process boundaries inherent to the VSCode/Electron architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  VSCode Extension Host (Browser Process)                        │
│                                                                  │
│  PDFViewerEditor (pdfViewerEditor.ts)                           │
│  ├── IOverlayWebview  ──── postMessage() ──────────────────────►│
│  ├── IPDFAnnotationService                                       │
│  ├── IStorageService (page persistence, signatures)             │
│  ├── IDocuSignService                                            │
│  └── IFileService (reads PDF bytes)                             │
│                                │                                 │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Webview (Sandboxed iframe)                              │   │
│  │                                                          │   │
│  │  main.ts (coordinator)                                   │   │
│  │  ├── PdfRenderer (Rust WASM)  ──── PDFium (Emscripten)  │   │
│  │  ├── PdfCanvasRenderer (renderer.ts)                     │   │
│  │  ├── Sidebar (sidebar.ts)                                │   │
│  │  ├── AnnotationManager (annotations.ts)                  │   │
│  │  └── SignatureManager (signatures.ts)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

All PDF processing (rendering, text extraction, outline extraction) happens inside the **sandboxed webview** using WASM. The extension host is responsible for file I/O, persistence, and service integration.

---

## Dual-WASM Architecture

The viewer loads two WASM modules in sequence during initialization:

### Module 1: PDFium (Emscripten)

- **What it is**: Google's PDFium library compiled to WebAssembly via Emscripten
- **Source**: `paulocoutinhox/pdfium-lib` (distributed via npm as `nickel-nickel-nickel`)
- **Files**: `media/wasm/pdfium.js` (Emscripten glue) + `media/wasm/pdfium.wasm` (~10 MB compressed)
- **Loaded as**: A separate `<script>` tag in the webview HTML; exposes a global `PDFiumModule()` factory function
- **Purpose**: The native C++ PDF rendering engine. Handles actual PDF parsing, font rendering, annotation rendering, and bitmap generation.

> **Important**: Do NOT substitute with `bblanchon/pdfium-binaries` for WASM — those builds use a non-growable heap that crashes on multi-page PDFs.

### Module 2: Rust WASM (pdf_viewer.wasm)

- **What it is**: A Rust crate (`wasm/src/`) compiled to WASM via `wasm-bindgen`
- **Files**: `media/wasm/pdf_viewer_bg.wasm` + `media/wasm/pdf_viewer.js` (wasm-bindgen glue)
- **Loaded as**: ES module via `import init, { PdfRenderer, ... } from './wasm/pdf_viewer.js'`
- **Purpose**: A safe Rust wrapper that bridges JavaScript ↔ PDFium via the `pdfium-render` crate. Exposes a clean `PdfRenderer` class to JavaScript.

### Initialization Sequence

```
1. PDFiumModule() resolves     → PDFium Emscripten instance ready
2. init(wasmUrl)               → Rust WASM module loaded + memory allocated
3. init_panic_hook()           → Rust panic messages routed to browser console
4. initialize_pdfium_render()  → Rust pdfium-render crate bound to the PDFium instance
5. new PdfRenderer()           → Renderer object created
6. vscode.postMessage('ready') → Extension host notified; PDF load begins
```

Steps 4 and 5 MUST happen after both modules are initialized. If PDFium is not bound before any `PdfRenderer` method is called, rendering will fail with a binding error.

---

## Component Map

```
src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/
├── pdfViewerEditor.ts          # VSCode EditorPane — host process controller
├── pdfViewerInput.ts           # EditorInput subclass for PDF files
├── pdfAnnotationService.ts     # Annotation CRUD + persistence service
│
├── media/                      # Webview-side assets (run inside sandboxed iframe)
│   ├── main.ts                 # Entry point — coordinates all modules, message loop
│   ├── renderer.ts             # PdfCanvasRenderer — canvas painting + text layer
│   ├── sidebar.ts              # Sidebar — thumbnails, outline, bookmarks
│   ├── annotations.ts          # AnnotationManager — highlights, bookmarks rendering
│   ├── signatures.ts           # SignatureManager — modal, placement, drag, resize
│   ├── pdfViewer.css           # All viewer styles
│   ├── pdfRustViewer.js        # [GENERATED] esbuild bundle of main.ts + modules
│   ├── build.mjs               # esbuild script
│   └── wasm/
│       ├── pdf_viewer.js       # [GENERATED] wasm-bindgen JS glue
│       ├── pdf_viewer_bg.wasm  # [GENERATED] Rust WASM binary
│       ├── pdf_viewer.d.ts     # [GENERATED] TypeScript type declarations
│       ├── pdfium.js           # PDFium Emscripten glue (downloaded separately)
│       ├── pdfium.wasm         # PDFium binary (downloaded separately)
│       ├── download-pdfium.mjs # Script to fetch pdfium binaries
│       └── PDFIUM_SETUP.md     # Setup instructions
│
└── wasm/                       # Rust crate source
    ├── Cargo.toml
    ├── build.ps1               # Windows build script
    ├── build.sh                # Unix build script
    ├── pkg/                    # [GENERATED] wasm-bindgen output
    └── src/
        ├── lib.rs              # Crate root — exports PdfRenderer, init_panic_hook
        └── renderer.rs         # PdfRenderer implementation
```

---

## Data Flow

### Opening a PDF

```
User opens .pdf file
       │
       ▼
PDFViewerEditor.setInput()
  │  ├── Creates IOverlayWebview (if first open)
  │  ├── Loads webview HTML (getWebviewHTML())
  │  ├── Reads saved page from IStorageService
  │  └── Calls loadPDF() when webview sends 'ready'
       │
       ▼
loadPDF()
  │  ├── IFileService.readFile() → Uint8Array
  │  ├── Converts to base64 (chunked, 8KB at a time)
  │  ├── Caches in _pdfDataCache
  │  └── webview.postMessage({ type: 'loadPDF', data: base64, ... })
       │
       ▼
Webview: handleLoadPDF()
  │  ├── atob() → Uint8Array
  │  ├── pdfRenderer.load(bytes) → JSON metadata (page count + dimensions)
  │  ├── generateThumbnails() (batched, 5 pages at a time)
  │  ├── extractOutline()
  │  ├── renderPage(startPage)
  │  └── preloadAllPages() or preloadAdjacentPages() based on strategy
```

### Page Rendering

```
renderPage(pageNum)
  │
  ├── Get pageDimensions[pageNum-1]
  ├── Calculate pixel size: points × scale × (96/72)
  ├── pdfRenderer.render_page(index, width, height)
  │     └── [WASM] Pdfium::load_pdf → get_page → render_with_config → as_image_data()
  │           Returns: ImageData (RGBA bytes in WASM memory, transferred to JS)
  │
  ├── canvasRenderer.renderImageData(imageData, w, h)
  │     └── ctx.putImageData() → visible page on canvas
  │
  ├── pdfRenderer.get_page_text(index)
  │     └── [WASM] 3-strategy text extraction → JSON [{text, x, y, w, h, font_size}]
  │
  ├── canvasRenderer.renderTextLayer(blocks, pageW, pageH, scale)
  │     └── Creates transparent <span> elements over the canvas for text selection
  │
  ├── annotationManager.renderAnnotations(page, scale)
  └── vscode.postMessage({ type: 'pageChanged', page })
```

---

## Rendering Pipeline

The page rendering pipeline converts PDF vector data to screen pixels:

```
PDF bytes (stored in Rust Vec<u8>)
       │
       ▼ [Rust] pdfium.load_pdf_from_byte_slice()
PDF Document object (PDFium internal)
       │
       ▼ [Rust] document.pages().get(index)
PDF Page object
       │
       ▼ [Rust] PdfRenderConfig::new()
              .set_target_size(pixelWidth, pixelHeight)
              .render_form_data(true)
              .render_annotations(true)
       │
       ▼ [Rust] page.render_with_config(&config)
PdfBitmap (RGBA bytes in WASM linear memory)
       │
       ▼ [Rust] bitmap.as_image_data()
ImageData (transferred to JS via wasm-bindgen)
       │
       ▼ [JS] ctx.putImageData(imageData, 0, 0)
Visible page on <canvas>
```

**Pixel size calculation**: `pixelWidth = pageWidthInPoints × scale × (96/72)`

Where `96` is the screen DPI and `72` is the number of PDF points per inch.

**Caching**: Rendered `ImageData` objects are cached in `imageDataCache: Map<number, ImageData>`. When the preload strategy is `all`, all pages are rendered up front (max 500). When `adjacent`, only ±2 pages around the current page are kept (older pages evicted).

---

## Text Extraction Strategy

Text extraction uses three fallback strategies, tried in order:

### Strategy 1: Page Objects API (Primary)

Iterates PDF page objects directly. Works even when the WASM binary cannot resolve non-embedded fonts (the most common case in a sandboxed environment).

- Each text object becomes one or more `TextBlock` entries
- Multi-line text objects are split evenly by line height
- Y-coordinates are flipped from PDF bottom-origin to CSS top-origin: `y = pageHeight - obj_top`

### Strategy 2: Character-Level Extraction (Fallback)

Uses `FPDFText_LoadPage` → character-level tight bounding boxes. Characters are grouped into blocks by detecting line breaks (Y-diff > 0.5× font size) or large horizontal gaps (X-gap > 2× font size).

### Strategy 3: Segment-Level Extraction (Last resort)

Uses the text page segments API. Provides coarser granularity but is available when character-level fails.

### Text Layer Rendering

Once text blocks are extracted, `PdfCanvasRenderer.renderTextLayer()` creates transparent `<span>` elements positioned absolutely over the canvas:

```
span.style.color = 'transparent'   // invisible text, but selectable
span.style.position = 'absolute'
span.style.left  = (block.x * scaleX) + 'px'
span.style.top   = (block.y * scaleY) + 'px'
span.style.width = (block.width * scaleX) + 'px'
span.style.fontSize = (block.font_size * scaleY) + 'px'
```

Where `scaleX = canvasWidth / pageWidthInPoints` (ratio of canvas pixels to PDF points).

---

## Annotation System

Annotations are managed across two layers:

### Host Layer (Extension Process)

`IPDFAnnotationService` provides CRUD operations and persists annotations to VSCode storage. It emits `onDidChangeAnnotations` events that trigger a re-sync to the webview.

Each annotation:
```typescript
interface PDFAnnotation {
    id: string;
    pdfUri: string;      // Ties annotation to a specific PDF file
    page: number;
    text: string;        // Selected text (or bookmark name)
    color: string;       // 'yellow' | 'green' | 'blue' | 'pink' | 'bookmark' | 'signature'
    boundingBoxes: BoundingBox[];   // Scaled to PDF point space
    note?: string;
    imageData?: string;  // base64 PNG (signature only)
    createdAt: number;
}
```

### Webview Layer

`AnnotationManager` maintains a local copy of annotations and renders them into a `#pdf-highlight-layer` div that sits above the text layer (z-index: 3, pointer-events: none for highlights, auto for signatures).

**Highlight**: A `div.pdf-highlight` with `mix-blend-mode: multiply` so text remains readable through the color.

**Signature**: A `div.pdf-signature-container` wrapping an `<img>` with 8 resize handles (nw/ne/sw/se/n/s/e/w). The container uses `pointer-events: auto` to support drag and resize interactions.

### Annotation Data Flow

```
User selects text → clicks highlight button
       │
       ▼ annotationManager.createHighlightFromSelection()
       │  Collects DOMRect bounding boxes from window.getSelection()
       │  Converts to PDF point space (divides by scale)
       │
       ▼ vscode.postMessage({ type: 'addAnnotation', annotation })
       │
       ▼ PDFViewerEditor.handleWebviewMessage()
       │  pdfAnnotationService.addAnnotation()
       │  → onDidChangeAnnotations event fires
       │
       ▼ sendAnnotationsToWebview()
       │  webview.postMessage({ type: 'loadAnnotations', annotations })
       │
       ▼ annotationManager.setAnnotations() + renderAnnotations()
```

---

## Signature System

`SignatureManager` handles the full signature lifecycle:

1. **Modal** — Draw (freehand on `<canvas>`) or Type (CSS font rendered to canvas)
2. **Placement** — After "Done", cursor becomes crosshair; next click on the PDF places the signature
3. **Stored as annotation** — Signature image (base64 PNG) stored in `imageData` field of an annotation with `color: 'signature'`
4. **Drag** — `mousedown` on the container starts drag; `mousemove`/`mouseup` on `document` track movement
5. **Resize** — 8 directional handles; resize logic computes delta from `resizeStartX/Y` and original bounds
6. **Saved signatures** — Persisted to VSCode storage via `void.pdfSavedSignatures` key; loaded on modal open

---

## State Management

### Extension Host State

| State | Location | Persistence |
|---|---|---|
| Last viewed page | `IStorageService` key `pdfViewer.lastPage.<uri>` | Per-file, workspace scope |
| Saved signatures | `IStorageService` key `void.pdfSavedSignatures` | Workspace scope |
| PDF byte cache | `_pdfDataCache` in `PDFViewerEditor` | In-memory, session only |
| Annotations | `IPDFAnnotationService` | Persistent (service-managed) |

### Webview State

| State | Location | Persistence |
|---|---|---|
| Current page, scale, URI | `vscode.setState()` / `vscode.getState()` | Survives webview restarts |
| ImageData page cache | `imageDataCache: Map<number, ImageData>` | In-memory, cleared on zoom |
| Page dimensions | `pageDimensions: Array<{width, height}>` | In-memory, reset on PDF load |

---

## Security Model (CSP)

The webview HTML uses a strict Content Security Policy:

```
default-src 'none';
script-src 'nonce-{uuid}' 'wasm-unsafe-eval' vscode-resource:;
style-src 'unsafe-inline' vscode-resource:;
img-src data: vscode-resource:;
connect-src https: vscode-resource:;
font-src data: vscode-resource:;
```

Key points:
- `wasm-unsafe-eval` is required for WASM instantiation (both PDFium and Rust modules)
- Scripts must either carry the nonce or be loaded from `vscode-resource:` URIs
- `connect-src https:` allows DocuSign API communication
- All local resources (CSS, JS, WASM) are served via `vscode-resource:` URIs with `localResourceRoots` set to the `media/` folder
