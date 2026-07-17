# PDF Viewer (Rust/WASM)

A high-fidelity, feature-rich PDF viewer integrated directly into the SafeAppealNavigator IDE. Powered by a dual-WASM architecture that combines a **Rust/wasm-bindgen wrapper** around the **PDFium rendering engine** for accurate, pixel-perfect PDF display with full interactive capabilities.

## Features

- **Accurate PDF rendering** — Uses Google's PDFium library (the same engine that powers Chrome) for pixel-perfect page rendering
- **Text selection & copying** — Transparent HTML text layer overlaid on the canvas enables native browser text selection
- **Page navigation** — Previous/Next buttons, keyboard arrows, sidebar thumbnail click-to-navigate
- **Zoom controls** — Zoom In/Out buttons and Ctrl+Scroll wheel zoom (0.5×–3.0× range)
- **Sidebar with three tabs** — Thumbnails, Outline (table of contents), and Bookmarks
- **Document outline** — Automatically extracted from PDF bookmark metadata via WASM
- **Highlight annotations** — Four colors (yellow, green, blue, pink) applied to text selections, persisted across sessions
- **Bookmark annotations** — Named page bookmarks stored with the annotation system
- **Signature support** — Draw or type signatures, place and reposition them on any page, save for reuse
- **DocuSign integration** — Send the open PDF for e-signature through the DocuSign service
- **Print support** — Opens the PDF in the system browser for native printing (Ctrl+P)
- **Session persistence** — Last-viewed page is saved per-file and restored on re-open
- **Preload strategies** — Configurable preloading (`all` or `adjacent`) for fast page switching

## Quick Start

1. Open any `.pdf` file in the IDE — the viewer opens automatically
2. Use **Previous/Next** or **arrow keys** to navigate pages
3. Hold **Ctrl** and scroll the mouse wheel to zoom
4. Select text on the page with the mouse, then click a **highlight color** button to annotate
5. Click **✍️ Signature** to draw or type a signature and place it on the page
6. Click **📧 DocuSign** to send the document for e-signature (requires DocuSign configuration)
7. Click **🖨️ Print** or press **Ctrl+P** to print via the system browser

## Documentation

| Document | Description |
|---|---|
| [Architecture](./architecture.md) | System design, WASM module structure, data flow |
| [Developer Guide](./developer-guide.md) | Code organization, extension points, contributing |
| [User Guide](./user-guide.md) | End-user feature walkthrough |
| [API Reference](./api-reference.md) | WASM API, postMessage protocol, TypeScript interfaces |
| [Build Guide](./build-guide.md) | Prerequisites, build steps, troubleshooting |

## Technology Stack

| Layer | Technology |
|---|---|
| PDF Rendering | PDFium (Google Chrome's PDF engine) via Emscripten WASM |
| Rust WASM Layer | `pdfium-render` crate + `wasm-bindgen` |
| TypeScript Bundle | esbuild (bundles `main.ts` + all modules → `pdfRustViewer.js`) |
| VSCode Integration | `EditorPane` + `IOverlayWebview` |
| Annotations | `IPDFAnnotationService` (persisted to VSCode storage) |
| Signatures | Canvas 2D API + base64 PNG stored as annotation image data |
| DocuSign | `IDocuSignService` + `void.docusign.sendForSignature` command |
