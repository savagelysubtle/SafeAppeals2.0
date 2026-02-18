---
name: PDF Viewer Feature Gaps
overview: Assessment of missing PDF viewer features, prioritized by user impact and implementation effort, for a legal document management tool.
todos:
  - id: page-fit-modes
    content: Add Fit Width / Fit Page / Actual Size zoom presets
    status: pending
  - id: annotation-notes
    content: Add text notes/comments to highlight annotations with popup editor
    status: pending
  - id: continuous-scroll
    content: Implement continuous vertical scroll mode with lazy page rendering
    status: pending
isProject: false
---

# PDF Viewer Feature Gap Assessment

## What You Already Have (Comprehensive)

Your viewer already covers: page navigation, zoom (buttons + Ctrl+scroll), text
selection/copy, 4-color highlighting, bookmarks, drawn/typed signatures with
drag/resize, sidebar with thumbnails + outline + bookmarks, printing via system
browser, DocuSign integration, AI context extraction (Ctrl+K/Ctrl+L with OCR),
preloading strategies, state persistence, and dark mode theming.

That is already well beyond a basic PDF viewer. Below are the meaningful gaps,
prioritized for a **legal document management** use case.

---

## High Priority (High impact, moderate effort)

### 1. Page Fit Modes (Fit Width / Fit Page / Actual Size)

- **Why**: Currently only manual zoom. Users working with legal documents want
  to quickly fit the page to window width for reading.
- **What**: Three buttons: "Fit Width" (scale to container width), "Fit Page"
  (fit entire page), "Actual Size" (100%). The scale calculation uses
  `containerWidth / pageWidth` or
  `min(containerWidth/pageWidth, containerHeight/pageHeight)`.
- **Files**: `media/main.ts` (fit calculations), CSS for toolbar buttons

---

## Medium Priority (Nice-to-have, moderate effort)

### 2. Form Filling

- **Why**: Many legal documents are fillable PDFs (applications, declarations,
  etc.). Currently they render as static pages.
- **What**: Detect and render form fields (text inputs, checkboxes, dropdowns)
  as interactive HTML elements overlaid on the canvas.
- **How**: PDFium has form field APIs (`FPDF_FORMFIELD_`). Use
  `page.annotations()` in pdfium-render to detect widget annotations and render
  corresponding HTML inputs.
- **Files**: New `media/forms.ts`, `wasm/src/renderer.rs` (new `get_form_fields`
  endpoint)

### 3. Continuous Scroll Mode

- **Why**: Currently one page at a time. For reading long legal decisions,
  continuous vertical scrolling (like a web page) is more natural.
- **What**: Render multiple pages stacked vertically in the canvas wrapper, with
  lazy rendering as the user scrolls.
- **How**: Create a virtual scroll container that places page canvases
  vertically. Only render visible pages + 1 page buffer above/below.
- **Files**: New rendering mode in `media/main.ts`, significant refactor of
  render loop

### 4. Annotation Notes / Comments

- **Why**: Lawyers need to annotate documents with notes, not just highlight.
  "This contradicts the evidence on page 5."
- **What**: Click a highlight to attach/edit a text note. Show notes as popups
  or in a sidebar panel.
- **How**: The annotation model already has a `note` field (used for tooltips).
  Add a popup editor on double-click and a notes panel in the sidebar.
- **Files**: `media/annotations.ts`, `media/main.ts`, `pdfAnnotationService.ts`

### 5. Redaction Tool

- **Why**: Legal documents often need sensitive information (SIN, medical
  details) redacted before sharing.
- **What**: Draw black rectangles over content that permanently obscure it in
  exports. Two modes: preview (reversible) and apply (permanent via PDF
  modification).
- **How**: Add a redaction annotation type. For permanent redaction, would need
  WASM-side PDF modification (complex).
- **Files**: `media/annotations.ts` (new annotation type),
  `wasm/src/renderer.rs` (optional permanent redaction)

---

## Lower Priority (Polish / advanced)

### 6. Rotate Page View

- **Why**: Some scanned legal documents are rotated. Quick 90-degree rotation
  helps reading.
- **What**: Button to rotate the current view 90/180/270 degrees.
- **How**: Apply CSS `transform: rotate()` to the render container, or pass
  rotation to the WASM render config.

### 7. Export Annotations

- **Why**: Share annotations with colleagues or include in case files.
- **What**: Export annotations as JSON or embed them in a new PDF copy.

### 8. Dark Mode Reading (Invert Colors)

- **Why**: Long reading sessions. Some users prefer inverted/sepia colors for
  the PDF content itself.
- **What**: CSS filter on the canvas (`filter: invert(1)` or sepia).

### 9. Page Transition Animations

- **Why**: Polish. Smooth fade or slide between pages.

---

## Recommendation

Text Search (Ctrl+F) and Copy to Clipboard (Ctrl+C) are already functional.
For the remaining features, I would recommend implementing in this order:

1. **Page Fit Modes** -- quick win, very useful for document reading
2. **Annotation Notes** -- adds depth to existing highlight feature
3. **Continuous Scroll** -- significant UX improvement for reading

Item 1 is small in scope. Item 2 builds on existing code. Item 3 is a larger
refactor but high value.
