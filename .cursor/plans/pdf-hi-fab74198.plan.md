<!-- fab74198-9b0b-46de-bfa1-3c224a92d619 614fd71e-5621-4b81-9dc2-f65151ecc32d -->
# PDF Viewer Enhancement: Highlights & AI Integration

## Overview

Enhance the PDF viewer with persistent annotations and Ctrl+K quick edit integration, enabling AI-powered text selection, summarization, and annotation features.

## Architecture

### 1. Persistent Annotations Storage

Store PDF annotations using VSCode's `IStorageService` (same pattern as `PersistentStore` in merge editor):

**Location**: `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfAnnotationService.ts` (new)

```typescript
interface PDFAnnotation {
  id: string;
  pdfUri: string;
  startPage: number; // Support multi-page selections in future
  endPage: number;
  page: number; // Primary page (for single-page selections)
  text: string;
  color: string; // e.g., 'yellow', 'green', 'red'
  boundingBoxes: Array<{
    page: number;
    x: number;      // PDF coordinate space (not screen space)
    y: number;
    width: number;
    height: number
  }>;
  note?: string; // Optional AI-generated or user note
  ariaLabel?: string; // Accessibility label for screen readers
  version?: string; // PDF file hash to detect content changes
  createdAt: number;
}

export interface IPDFAnnotationService {
  createAnnotation(pdfUri: URI, annotation: Omit<PDFAnnotation, 'id' | 'createdAt'>): Promise<PDFAnnotation>;
  getAnnotations(pdfUri: URI, page?: number): Promise<PDFAnnotation[]>; // Page-specific for performance
  updateAnnotation(id: string, updates: Partial<PDFAnnotation>): Promise<void>;
  deleteAnnotation(id: string): Promise<void>;
  clearAnnotations(pdfUri: URI, page?: number): Promise<void>;
  exportAnnotations(pdfUri: URI): Promise<string>; // JSON export for sharing
  importAnnotations(pdfUri: URI, data: string): Promise<void>;
  searchAnnotations(query: string): Promise<PDFAnnotation[]>; // Search across all PDFs
}
```

Use `IStorageService` with `StorageScope.WORKSPACE` and `StorageTarget.USER` to persist annotations per-workspace. Pattern from `92:143:src/vs/workbench/contrib/mergeEditor/browser/utils.ts`.

**Performance Strategy**:

- Lazy-load annotations per page (don't load all pages at once)
- Index by PDF URI + page number for fast lookups
- Cache recently accessed annotations in memory

### 2. PDF Text Layer & Selection

Enhance `pdfViewer.js` to add a text layer overlay for selection:

**PDF.js Text Layer**: Use `page.getTextContent()` and PDF.js built-in `renderTextLayer` utility to render an invisible text layer over the canvas. This enables:

- Native browser text selection
- Copy-paste functionality
- Accurate coordinate tracking

**Changes to `pdfViewer.js`**:

```javascript
async function renderPage(pageNum) {
    // ... existing canvas render ...

    // Render text layer using PDF.js utility
    const textContent = await page.getTextContent();
    const textLayerDiv = document.getElementById('text-layer-' + pageNum);

    // Clear existing text layer
    textLayerDiv.innerHTML = '';

    // Use PDF.js built-in text layer renderer
    pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayerDiv,
        viewport: viewport,
        textDivs: []
    });

    // Load and render annotations for this page
    const annotations = await loadAnnotationsForPage(pageNum);
    renderHighlights(annotations);
}
```

**Coordinate Transformation**: Convert between screen space and PDF space:

```javascript
// Capture bounding boxes when text is selected
function captureSelectionBoundingBoxes() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return [];

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    const canvasRect = canvas.getBoundingClientRect();

    // Transform screen coordinates to PDF coordinates
    return Array.from(rects).map(rect => ({
        page: currentPage,
        x: (rect.left - canvasRect.left) / scale,
        y: (rect.top - canvasRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale
    }));
}
```

**Selection Constraints (MVP)**:

- Single-page selections only (multi-page support deferred to v2)
- Validate that selection doesn't span pages before creating annotation

### 3. Highlight Rendering

Add highlight rendering on top of the text layer:

**Implementation in `pdfViewer.js`**:

- Create a separate `<div>` layer for highlights positioned absolutely over the canvas
- Render highlights from stored annotations using `boundingBoxes`
- Support multiple highlight colors
- Click handler on highlights to show/edit notes

**CSS in `pdfViewer.css`**:

```css
.pdf-text-layer {
  position: absolute;
  left: 0;
  top: 0;
  /* Don't set opacity - PDF.js text layer is transparent by default */
  /* Text divs have color: transparent and are selectable */
  line-height: 1.0;
  white-space: pre;
}

.pdf-highlight-layer {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.pdf-highlight {
  position: absolute;
  background-color: yellow;
  opacity: 0.4;
  mix-blend-mode: multiply;
  pointer-events: auto;
  cursor: pointer;
  transition: opacity 0.2s ease;
  role: mark; /* Semantic HTML for accessibility */
}

.pdf-highlight:hover {
  opacity: 0.6;
}

.pdf-highlight.color-yellow { background-color: #ffeb3b; }
.pdf-highlight.color-green { background-color: #4caf50; }
.pdf-highlight.color-red { background-color: #f44336; }
.pdf-highlight.color-blue { background-color: #2196f3; }
```

**Performance Optimizations**:
- Throttle highlight rendering during zoom/pan operations
- Use `requestAnimationFrame` for smooth updates
- Debounce annotation saves (don't save on every keystroke)

### 4. Ctrl+K Integration

Wire up Ctrl+K to work within PDF viewer by registering a custom action:

**New file**: `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfQuickEditActions.ts`

Register action similar to `35:69:src/vs/workbench/contrib/void/browser/quickEditActions.ts` but:

- Check if active editor is `PDFViewerEditor`
- Extract selected text from `PDFViewerInput.selection`
- Extract current page text via `PDFContentExtractor` (already exists at `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfContentExtractor.ts`)
- Get selection bounding box coordinates from webview for widget positioning
- Show inline quick edit widget overlaid on PDF viewer

**Widget Positioning Strategy**:

```typescript
// In pdfQuickEditActions.ts
async function showQuickEdit(editor: PDFViewerEditor) {
    // Request selection rectangle from webview
    const selectionRect = await editor.getSelectionRect();
    
    // Create container for React widget
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'pdf-quick-edit-widget';
    widgetContainer.style.position = 'absolute';
    widgetContainer.style.left = `${selectionRect.left}px`;
    widgetContainer.style.top = `${selectionRect.bottom + 10}px`;
    widgetContainer.style.zIndex = '1000';
    
    editor._element.appendChild(widgetContainer);
    
    // Render React component
    ReactDOM.render(<QuickEditChat context={pdfContext} />, widgetContainer);
}
```

**Context Gathering for PDF**:

Extend `IContextGatheringService` interface to support PDF context:

```typescript
// In contextGatheringService.ts
getPDFContext(
    uri: URI, 
    selectedText: string, 
    currentPage: number,
    contextRange?: number // Optional: include ±N surrounding pages
): Promise<string>
```

Implementation:

- Use `PDFContentExtractor.extractContentRange()` to get current page text
- Optionally extract surrounding pages (currentPage ± contextRange)
- Combine with selected text
- Format as: "Selected text: {selection}\n\nCurrent page context: {pageText}\n\nSurrounding pages: {surroundingText}"

### 5. Quick Edit Widget for PDF

Since PDF viewer is webview-based, we need a different approach than the standard editor widget:

**Option A** (Recommended): Overlay the QuickEditChat React component

- Position absolutely over the webview
- Use `pdfViewerEditor._element` as mounting point
- Similar pattern to how webview is claimed in `78:80:pdfViewerEditor.ts`

**Option B**: Embed quick edit inside the webview

- Add React component to webview HTML
- More complex IPC communication
- Less integration with existing Void UI

Go with **Option A** for consistency with Void's architecture.

### 6. AI Features Implementation

When user selects text and presses Ctrl+K:

**Input to AI**:

```typescript
{
  selectedText: "...", // From selection
  currentPageText: "...", // From PDFContentExtractor
  pageNumber: 5,
  totalPages: 120,
  documentTitle: "Policy Manual.pdf"
}
```

**AI Capabilities** (3d - all of the above):

- Summarize/explain selection
- Answer questions about document
- Generate annotations (save to `pdfAnnotationService`)

**Prompt template** (add to `src/vs/workbench/contrib/void/common/prompt/prompts.ts`):

```typescript
export const pdfQuickEdit_systemMessage = () => `
You are helping the user understand and annotate a PDF document.
You can:
- Summarize or explain selected text
- Answer questions about the document
- Generate helpful annotations
`;

export const pdfQuickEdit_userMessage = ({
  selectedText,
  currentPageText,
  pageNumber,
  totalPages,
  instructions
}: {
  selectedText: string;
  currentPageText: string;
  pageNumber: number;
  totalPages: number;
  instructions: string;
}) => `
Document: Page ${pageNumber} of ${totalPages}

Selected Text:
${selectedText}

Current Page Context:
${currentPageText}

User Request: ${instructions}
`;
```

### 7. Annotation Actions

Add toolbar actions to PDF viewer controls:

- **Highlight** button (yellow marker icon) - highlights selection
- **AI Annotate** button - Triggers Ctrl+K automatically
- **Clear Highlights** - removes all highlights from current page
- Color picker for highlight colors

## Implementation Order

1. **Storage Service** - Create `pdfAnnotationService.ts` with CRUD operations
2. **Text Layer** - Add PDF.js text layer to `pdfViewer.js`
3. **Highlight Rendering** - Render highlights from storage
4. **Selection Capture** - Update selection handlers to save coordinates
5. **Ctrl+K Action** - Register PDF-specific quick edit action
6. **Context Extraction** - Implement PDF context gathering
7. **Quick Edit Widget** - Overlay QuickEditChat on PDF viewer
8. **AI Integration** - Add prompts and wire up to editCodeService
9. **Toolbar Actions** - Add highlight/annotate buttons to UI

## Files to Create

1. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfAnnotationService.ts`
2. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfQuickEditActions.ts`
3. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfContextGathering.ts`

## Files to Modify

1. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerEditor.ts` - Add annotation service, Ctrl+K support
2. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.js` - Add text layer, highlight rendering
3. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.css` - Add highlight/text layer styles
4. `src/vs/workbench/contrib/void/common/prompt/prompts.ts` - Add PDF-specific prompts
5. `src/vs/workbench/contrib/void/browser/contextGatheringService.ts` - Extend for PDF context

## Key Technical Decisions

- **Storage**: Use `IStorageService` instead of SQLite for simplicity (annotations are lightweight)
- **Text Layer**: Use PDF.js built-in text layer for accurate selection
- **Ctrl+K Widget**: Overlay React component (Option A) for better integration
- **Context**: Pass both selection (4a) and page text (4b) as specified
- **Highlights**: Render as absolutely positioned divs with pointer events for interaction

### To-dos

- [ ] Create pdfAnnotationService.ts with persistent storage using IStorageService
- [ ] Add PDF.js text layer rendering to pdfViewer.js for text selection
- [ ] Implement highlight rendering system with color support and click handlers
- [ ] Update selection handlers to capture bounding boxes and save annotations
- [ ] Create pdfContextGathering.ts to extract selected text and current page content
- [ ] Register PDF-specific Ctrl+K action in pdfQuickEditActions.ts
- [ ] Overlay QuickEditChat React component on PDF viewer
- [ ] Add PDF-specific prompts to prompts.ts for summarization and annotation
- [ ] Add highlight/annotate/clear buttons to PDF viewer toolbar
