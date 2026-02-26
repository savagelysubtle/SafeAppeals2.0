# PDF Viewer API Reference

## Table of Contents

1. [WASM API (Rust → JavaScript)](#wasm-api-rust--javascript)
2. [postMessage Protocol (Host → Webview)](#postmessage-protocol-host--webview)
3. [postMessage Protocol (Webview → Host)](#postmessage-protocol-webview--host)
4. [TypeScript Interfaces](#typescript-interfaces)
5. [VSCode Service Interfaces](#vscode-service-interfaces)

---

## WASM API (Rust → JavaScript)

The Rust WASM module exposes a `PdfRenderer` class and two initialization functions to JavaScript via `wasm-bindgen`.

### Initialization Functions

#### `init(wasmUrl: string): Promise<WebAssembly.Instance>`

Loads and instantiates the Rust WASM binary. Must be called before any `PdfRenderer` usage.

```typescript
import init from './wasm/pdf_viewer.js';
const rustModule = await init(wasmUrl);
```

#### `init_panic_hook(): void`

Registers `console_error_panic_hook` so Rust panics appear in the browser console instead of crashing silently.

```typescript
init_panic_hook();
```

#### `initialize_pdfium_render(pdfiumModule: unknown, rustModule: unknown): boolean`

Binds the `pdfium-render` Rust crate to the loaded PDFium Emscripten instance. **Must be called after both `PDFiumModule()` and `init()` complete.** Returns `true` on success.

```typescript
const ok = initialize_pdfium_render(pdfiumModule, rustModule);
if (!ok) throw new Error('Failed to bind pdfium-render');
```

---

### `PdfRenderer` class

#### `constructor()`

Creates a new renderer instance. Must be constructed after `initialize_pdfium_render()`.

```typescript
const renderer = new PdfRenderer();
```

---

#### `load(data: Uint8Array): string`

Loads PDF bytes into WASM memory, validates the document, and extracts page metadata.

**Parameters**:
- `data` — Raw PDF bytes as a `Uint8Array`

**Returns**: JSON string matching `PdfMetadata`:

```json
{
  "page_count": 12,
  "pages": [
    { "width": 612.0, "height": 792.0 },
    { "width": 612.0, "height": 792.0 }
  ]
}
```

`width` and `height` are in **PDF points** (1 point = 1/72 inch).

**Throws**: `Error` if the PDF is malformed or password-protected (without providing a password).

---

#### `render_page(index: number, width: number, height: number): ImageData`

Renders a page to an `ImageData` object at the specified pixel dimensions.

**Parameters**:
- `index` — 0-based page index
- `width` — Target pixel width (unsigned 16-bit, max 65535)
- `height` — Target pixel height (unsigned 16-bit, max 65535)

**Returns**: `ImageData` (RGBA, premultiplied alpha) ready for `ctx.putImageData()`.

**Notes**:
- Renders form data and annotations (`render_form_data(true)`, `render_annotations(true)`)
- Re-opens PDF from stored bytes on each call
- The pixel dimensions should be computed as: `round(pageWidthInPoints × scale × 96/72)`

**Throws**: `Error` if no PDF is loaded or the index is out of range.

---

#### `render_thumbnail(index: number, max_width: number): ImageData`

Renders a thumbnail at `max_width` pixels wide, preserving the page's aspect ratio.

**Parameters**:
- `index` — 0-based page index
- `max_width` — Maximum pixel width for the thumbnail (unsigned 16-bit)

**Returns**: `ImageData` suitable for `ctx.putImageData()` on a canvas.

---

#### `get_page_text(index: number): string`

Extracts text from a page using a three-strategy fallback approach.

**Parameters**:
- `index` — 0-based page index

**Returns**: JSON string — array of `TextBlock`:

```json
[
  {
    "text": "Section 1: Introduction",
    "x": 72.0,
    "y": 84.5,
    "width": 320.0,
    "height": 14.0,
    "font_size": 12.0
  }
]
```

All coordinates are in **PDF points**, with Y measured from the **top of the page** (already converted from PDF's bottom-origin to screen top-origin by the Rust code).

**Throws**: `Error` if no PDF is loaded.

---

#### `get_outline(): string`

Extracts the document outline (table of contents) from PDF bookmarks.

**Returns**: JSON string — array of `OutlineItem`:

```json
[
  {
    "title": "Chapter 1",
    "page_index": 0,
    "children": []
  },
  {
    "title": "Chapter 2",
    "page_index": 14,
    "children": [
      { "title": "Section 2.1", "page_index": 16, "children": [] }
    ]
  }
]
```

`page_index` is 0-based. Returns an empty array `[]` if the PDF has no bookmarks.

---

#### `get_page_dimensions(index: number): string`

Returns the dimensions of a specific page.

**Parameters**:
- `index` — 0-based page index

**Returns**: JSON string:

```json
{ "width": 612.0, "height": 792.0 }
```

---

#### `page_count(): number`

Returns the total number of pages in the loaded PDF.

---

#### `close(): void`

Frees the stored PDF bytes from WASM memory. Call when the PDF is no longer needed.

---

## postMessage Protocol (Host → Webview)

Messages sent from `PDFViewerEditor` (extension host) to the webview via `webview.postMessage(message)`.

---

### `loadPDF`

Instructs the webview to load and display a PDF.

```typescript
{
    type: 'loadPDF',
    data: string,              // base64-encoded PDF bytes
    encoding: 'base64',
    preloadStrategy: string,   // 'all' | 'adjacent' | 'none'
    startPage: number,         // 1-based page to display first
    pdfUri: string,            // URI string of the PDF file
    skipPreload?: boolean,     // true = skip background preloading (cache hit restore)
}
```

---

### `loadAnnotations`

Pushes the current annotation set for the active PDF to the webview.

```typescript
{
    type: 'loadAnnotations',
    annotations: Annotation[],
}
```

---

### `savedSignatures`

Delivers persisted signatures to render in the signature modal.

```typescript
{
    type: 'savedSignatures',
    signatures: Array<{
        id: string;
        dataURL: string;    // base64 PNG data URL
        createdAt: number;  // Unix timestamp (ms)
    }>,
}
```

---

### `goToPage`

Navigates the webview to a specific page.

```typescript
{
    type: 'goToPage',
    page: number,  // 1-based
}
```

---

### `getState`

Requests the current webview state. The webview replies with a `state` message.

```typescript
{
    type: 'getState',
    requestedUri: string,
    savedPage: number,
}
```

---

### `clearPDF`

Clears the currently loaded PDF from the webview.

```typescript
{
    type: 'clearPDF',
}
```

---

### `getSelectionRect`

Requests the bounding rectangle of the current text selection. The webview replies with a `selectionRect` message.

```typescript
{
    type: 'getSelectionRect',
}
```

---

### `addSignatureAnnotation`

Instructs the webview to add a signature annotation locally (optimistic update before server persistence).

```typescript
{
    type: 'addSignatureAnnotation',
    annotation: Omit<Annotation, 'id' | 'createdAt'>,
}
```

---

## postMessage Protocol (Webview → Host)

Messages sent from the webview via `vscode.postMessage(message)` and received by `PDFViewerEditor.handleWebviewMessage()`.

---

### `ready`

Sent when WASM initialization is complete and the webview is ready to receive `loadPDF`.

```typescript
{ type: 'ready' }
```

---

### `pdfLoaded`

Sent after a PDF is fully loaded and the first page rendered. Triggers host to push annotations.

```typescript
{ type: 'pdfLoaded' }
```

---

### `pageChanged`

Sent whenever the current page changes.

```typescript
{
    type: 'pageChanged',
    page: number,  // 1-based
}
```

The host saves `page` to `IStorageService` for session restoration.

---

### `textSelected`

Sent when the user selects text on the page.

```typescript
{
    type: 'textSelected',
    selection: {
        startPage: number,
        endPage: number,
        text: string,
    },
}
```

---

### `clearSelection`

Sent when the text selection is cleared.

```typescript
{ type: 'clearSelection' }
```

---

### `selectionRect`

Response to a `getSelectionRect` request from the host.

```typescript
{
    type: 'selectionRect',
    rect: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    } | null,
}
```

---

### `addAnnotation`

Requests the host to create a new annotation (highlight or bookmark).

```typescript
{
    type: 'addAnnotation',
    annotation: {
        pdfUri: string;
        page: number;
        text: string;
        color: 'yellow' | 'green' | 'blue' | 'pink' | 'bookmark';
        boundingBoxes: BoundingBox[];
    },
}
```

---

### `updateAnnotation`

Requests the host to update an existing annotation (e.g., after signature drag/resize).

```typescript
{
    type: 'updateAnnotation',
    annotationId: string,
    updates: Partial<Annotation>,
}
```

---

### `deleteAnnotation`

Requests the host to delete an annotation.

```typescript
{
    type: 'deleteAnnotation',
    annotationId: string,
}
```

---

### `addSignatureAnnotation`

Requests the host to persist a signature annotation (distinct from `addAnnotation` to allow custom handling).

```typescript
{
    type: 'addSignatureAnnotation',
    annotation: {
        pdfUri: string;
        page: number;
        text: 'Signature';
        color: 'signature';
        imageData: string;          // base64 PNG data URL
        boundingBoxes: BoundingBox[];
    },
}
```

---

### `getAnnotations`

Requests the host to resend the current annotation set.

```typescript
{ type: 'getAnnotations' }
```

---

### `savePdfSignature`

Requests the host to persist a reusable signature.

```typescript
{
    type: 'savePdfSignature',
    signature: {
        id: string;
        dataURL: string;    // base64 PNG data URL
        createdAt: number;  // Unix timestamp (ms)
    },
}
```

---

### `loadPdfSignatures`

Requests the host to send all saved signatures.

```typescript
{ type: 'loadPdfSignatures' }
```

---

### `deletePdfSignature`

Requests the host to delete a saved signature.

```typescript
{
    type: 'deletePdfSignature',
    signatureId: string,
}
```

---

### `printPdf`

Requests the host to open the PDF in the system browser for printing.

```typescript
{ type: 'printPdf' }
```

---

### `sendForDocuSign`

Requests the host to initiate the DocuSign signature flow.

```typescript
{ type: 'sendForDocuSign' }
```

---

### `error`

Sent when the webview encounters an unrecoverable error.

```typescript
{
    type: 'error',
    error: string,
}
```

---

### `state`

Response to a `getState` request from the host.

```typescript
{
    type: 'state',
    loadedPdfUri: string | null,
    currentPage: number,
    hasPDF: boolean,
    savedPage: number,
}
```

---

## TypeScript Interfaces

### `TextBlock` (renderer.ts)

```typescript
interface TextBlock {
    text: string;
    x: number;         // PDF points, from left edge
    y: number;         // PDF points, from top of page
    width: number;     // PDF points
    height: number;    // PDF points
    font_size: number; // PDF points
}
```

### `BoundingBox` (annotations.ts)

```typescript
interface BoundingBox {
    page: number;
    x: number;      // PDF points
    y: number;      // PDF points
    width: number;  // PDF points
    height: number; // PDF points
}
```

### `Annotation` (annotations.ts)

```typescript
interface Annotation {
    id: string;
    pdfUri: string;
    page: number;
    text: string;
    color: string;               // 'yellow' | 'green' | 'blue' | 'pink' | 'bookmark' | 'signature'
    boundingBoxes: BoundingBox[];
    note?: string;
    imageData?: string;          // base64 PNG (signature only)
    createdAt: number;           // Unix timestamp (ms)
}
```

### `OutlineItem` (sidebar.ts)

```typescript
interface OutlineItem {
    title: string;
    page_index: number | null;  // 0-based; null if destination unknown
    children: OutlineItem[];
}
```

### `Bookmark` (sidebar.ts)

```typescript
interface Bookmark {
    id: string;
    page: number;
    text: string;
}
```

### `PDFSelection` (pdfViewerInput.ts)

```typescript
interface PDFSelection {
    startPage: number;
    endPage: number;
    text: string;
}
```

---

## VSCode Service Interfaces

### `IPDFAnnotationService`

The host-side annotation service. Injected into `PDFViewerEditor`.

```typescript
interface IPDFAnnotationService {
    onDidChangeAnnotations: Event<URI>;
    getAnnotations(uri: URI): PDFAnnotation[];
    addAnnotation(annotation: Omit<PDFAnnotation, 'id' | 'createdAt'>): PDFAnnotation;
    updateAnnotation(id: string, updates: Partial<PDFAnnotation>): void;
    deleteAnnotation(id: string): void;
}
```

### Storage Keys

| Key | Type | Scope | Description |
|---|---|---|---|
| `pdfViewer.lastPage.<uri>` | `number` | Workspace | Last viewed page per PDF |
| `void.pdfSavedSignatures` | `string` (JSON) | Workspace | Array of saved signature objects |
