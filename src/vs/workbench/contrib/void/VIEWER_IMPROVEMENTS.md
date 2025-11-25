# Document Viewers Improvement Ideas

This document outlines potential improvements for the SafeAppeals2.0 document viewers (PDF, DOCX, XLSX, Image) covering performance, UI/UX, features, and architecture.

---

## 📊 Current State Summary

| Viewer | Libraries | UI Style | Key Issues |
|--------|-----------|----------|------------|
| PDF | pdf.js (CDN) | Custom sidebar + controls | CDN dependency, basic toolbar |
| DOCX | docx-preview + Tiptap | MS Word-like | Complex bundling, large dependencies |
| XLSX | SheetJS + x-spreadsheet | Ribbon UI | x-spreadsheet defaults leak through |
| Image | Native webview | Minimal | No zoom/pan, basic display |

---

## 🚀 Performance Improvements

### 1. **PDF Viewer**

#### Current Issues
- Uses CDN for pdf.js (network dependency, no offline support)
- Full PDF data sent to webview as base64 (memory spike for large files)
- Thumbnails render all pages upfront (slow for 100+ page documents)

#### Recommendations

```
Priority: HIGH
```

- [ ] **Bundle pdf.js locally** - Eliminate CDN dependency for offline support
- [ ] **Streaming PDF loading** - Use `ArrayBuffer` chunks instead of full base64
- [ ] **Lazy thumbnail rendering** - Only render visible thumbnails, use IntersectionObserver
- [ ] **Page virtualization** - Only keep 3-5 pages in DOM at a time
- [ ] **Worker thread for rendering** - Move PDF rendering off main thread
- [ ] **Preload strategy refinement** - Current `pdfPreloadStrategy` setting needs better implementation
- [ ] **Canvas pooling** - Reuse canvas elements instead of creating new ones

```typescript
// Example: Lazy thumbnail with IntersectionObserver
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      renderThumbnail(entry.target.dataset.pageNum);
    }
  });
}, { rootMargin: '100px' });
```

---

### 2. **DOCX Viewer**

#### Current Issues
- Multiple large bundled libraries (Tiptap, docx-preview, JSZip)
- Retry logic for file reading (masks underlying issues)
- Full document converted to base64 for webview transfer

#### Recommendations

```
Priority: MEDIUM
```

- [ ] **Tree-shake Tiptap bundle** - Only include used extensions
- [ ] **Lazy-load editing mode** - Load Tiptap only when user starts editing
- [ ] **Virtual scrolling for long documents** - Don't render entire document
- [ ] **Stream-parse DOCX** - Parse sections incrementally
- [ ] **Cache parsed DOCX structure** - Don't re-parse on tab switch
- [ ] **Debounce content change events** - Currently fires on every keystroke

---

### 3. **XLSX Viewer**

#### Current Issues
- Full SheetJS library loaded (400KB+)
- x-spreadsheet re-renders entire grid on changes
- No virtualization for large datasets (10k+ rows)

#### Recommendations

```
Priority: HIGH
```

- [ ] **Virtual scrolling** - Only render visible cells (critical for large sheets)
- [ ] **Lazy sheet loading** - Only parse active sheet, load others on demand
- [ ] **Web Worker for calculations** - Offload formula computation
- [ ] **Delta updates** - Only re-render changed cells, not entire grid
- [ ] **Pagination for huge datasets** - Show 1000 rows at a time with nav

---

### 4. **Image Viewer**

#### Current Issues
- No image caching across sessions
- Large images loaded at full resolution
- No progressive loading

#### Recommendations

```
Priority: LOW
```

- [ ] **Generate thumbnails** - Show low-res preview, load full on zoom
- [ ] **Image format detection** - Use native decode hints for format
- [ ] **Memory management** - Release image data when tab hidden

---

## 🎨 UI/UX Improvements

### 1. **PDF Viewer UI**

#### Current State
- Basic Previous/Next/Zoom buttons
- Static sidebar with thumbnails/outline tabs
- Gray (#525252) background

#### Recommendations

```
Priority: MEDIUM
```

**Toolbar Enhancements**:
- [ ] **Fit-to-width / Fit-to-page toggle buttons** with icons
- [ ] **Zoom slider** instead of just buttons (25% - 400% range)
- [ ] **Zoom percentage dropdown** (50%, 75%, 100%, 125%, etc.)
- [ ] **Page number input field** - Direct jump to page
- [ ] **Rotate buttons** (90° CW/CCW)
- [ ] **Full-screen mode** button
- [ ] **Print button** with print preview

**Sidebar Improvements**:
- [ ] **Resizable sidebar** - Drag to resize
- [ ] **Search within PDF** - Text search with highlight
- [ ] **Bookmark panel** - User bookmarks
- [ ] **Attachment panel** - Show embedded files
- [ ] **Keyboard shortcuts panel** - Help overlay

**Visual Polish**:
- [ ] **Dark/Light theme sync** - Match VSCode theme
- [ ] **Smooth page transitions** - CSS animations on navigation
- [ ] **Loading skeleton** - Show placeholder while page renders
- [ ] **Page shadow refinement** - More subtle shadow

```css
/* Example: Modern zoom control */
.zoom-control {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--vscode-input-background);
  border-radius: 4px;
  padding: 2px;
}

.zoom-slider {
  width: 100px;
  accent-color: var(--vscode-focusBorder);
}

.zoom-value {
  min-width: 45px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

---

### 2. **DOCX Viewer UI**

#### Current State
- MS Word-inspired toolbar with formatting buttons
- Page size/margin selectors
- Gray (#525252) background like Word

#### Recommendations

```
Priority: MEDIUM
```

**Ribbon Bar Improvements**:
- [ ] **Collapsible ribbon** - Double-click tab to collapse
- [ ] **Quick Access Toolbar** - Customizable favorite actions
- [ ] **Context-sensitive formatting** - Show relevant options for selection
- [ ] **Font preview** - Show font face in dropdown
- [ ] **Recent colors** - Remember last used colors

**Document View**:
- [ ] **Ruler** - Show margins and tab stops
- [ ] **Page number indicator** - "Page 3 of 12" in corner
- [ ] **View modes** - Print Layout / Web Layout / Outline
- [ ] **Split view** - View two parts of document
- [ ] **Focus mode** - Hide UI, just show document

**Polish**:
- [ ] **Smooth scrolling** between pages
- [ ] **Page turn animation** option
- [ ] **Accessibility improvements** - ARIA labels, keyboard nav

---

### 3. **XLSX Viewer UI**

#### Current State
- Excel-like ribbon with tabs (Home, View, Data)
- Formula bar
- x-spreadsheet grid (basic styling)

#### Recommendations

```
Priority: HIGH
```

**Ribbon Refinements**:
- [ ] **Icon tooltips** - Show keyboard shortcut in tooltip
- [ ] **Mini toolbar on selection** - Floating format bar
- [ ] **Number format dropdown** - Currency, %, Date, etc.
- [ ] **Conditional formatting UI** - Color scales, data bars
- [ ] **Chart insertion** - Basic chart types

**Grid Improvements**:
- [ ] **Freeze panes** - Keep headers visible
- [ ] **Column/row resize handles** - Visual feedback
- [ ] **Selection highlighting** - Highlight entire row/column
- [ ] **Alternating row colors** option
- [ ] **Cell comments/notes** - Hover to see

**Formula Bar**:
- [ ] **Auto-complete** for function names
- [ ] **Syntax highlighting** in formula
- [ ] **Expand/collapse** for long formulas
- [ ] **Reference highlighting** - Color-code cell references

```css
/* Example: Better formula bar */
#formula-input {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-variant-ligatures: common-ligatures;
}

.formula-fn { color: #569CD6; } /* Function names */
.formula-ref { color: #4EC9B0; } /* Cell references */
.formula-str { color: #CE9178; } /* Strings */
.formula-num { color: #B5CEA8; } /* Numbers */
```

---

### 4. **Image Viewer UI**

#### Current State
- Centered image with drop shadow
- No controls
- Basic error handling

#### Recommendations

```
Priority: MEDIUM
```

**Essential Controls**:
- [ ] **Zoom controls** - Fit / 100% / Zoom in/out / Slider
- [ ] **Pan/drag** - Click and drag to pan zoomed image
- [ ] **Rotate buttons** - 90° CW/CCW
- [ ] **Flip buttons** - Horizontal/Vertical
- [ ] **Reset view** - Return to default

**Advanced Features**:
- [ ] **Checkerboard background** - Show transparency
- [ ] **Image info panel** - Dimensions, file size, format, color space
- [ ] **Color picker** - Click to get color from image
- [ ] **Zoom to selection** - Draw box to zoom area
- [ ] **Compare mode** - Side-by-side with another image

**Keyboard & Mouse**:
- [ ] **Mouse wheel zoom** - Zoom at cursor position
- [ ] **Double-click** - Toggle fit/100%
- [ ] **Arrow keys** - Pan when zoomed
- [ ] **Escape** - Reset view

```html
<!-- Example: Image viewer toolbar -->
<div class="image-toolbar">
  <button id="zoom-fit" title="Fit to window">⊡</button>
  <button id="zoom-100" title="Actual size (100%)">1:1</button>
  <button id="zoom-out" title="Zoom out (-)">−</button>
  <input type="range" id="zoom-slider" min="10" max="500" value="100">
  <span id="zoom-percent">100%</span>
  <button id="zoom-in" title="Zoom in (+)">+</button>
  <div class="separator"></div>
  <button id="rotate-ccw" title="Rotate left">↺</button>
  <button id="rotate-cw" title="Rotate right">↻</button>
  <div class="separator"></div>
  <button id="info-toggle" title="Image info">ℹ</button>
</div>
```

---

## ✨ Feature Enhancements

### 1. **Cross-Viewer Features**

- [ ] **Unified toolbar API** - Consistent action registration
- [ ] **Context menu standardization** - Right-click menus
- [ ] **Keyboard shortcut consistency** - Same shortcuts across viewers
- [ ] **Copy to clipboard** - Selected content
- [ ] **Find/Replace** - Ctrl+F in all viewers
- [ ] **Print support** - Ctrl+P
- [ ] **Recent documents** - Quick access list

### 2. **PDF-Specific Features**

- [ ] **Text annotation** - Highlight, underline, strikethrough
- [ ] **Freehand drawing** - Draw on PDF
- [ ] **Sticky notes** - Add comments
- [ ] **Form filling** - Basic PDF form support
- [ ] **Digital signature** - Sign PDFs
- [ ] **Redaction tool** - Black out sensitive info
- [ ] **Split/Merge** - Extract pages, combine PDFs
- [ ] **OCR integration** - Text recognition for scanned PDFs

### 3. **DOCX-Specific Features**

- [ ] **Track changes view** - Show/hide revisions
- [ ] **Comments panel** - View/add comments
- [ ] **Styles panel** - Apply/modify styles
- [ ] **Table of contents** - Auto-generate
- [ ] **Mail merge** - Basic merge fields
- [ ] **Export to PDF** - Convert DOCX → PDF
- [ ] **Compare documents** - Diff two versions

### 4. **XLSX-Specific Features**

- [ ] **Pivot tables** (basic)
- [ ] **Data validation** - Dropdowns, ranges
- [ ] **Named ranges** - Define and use
- [ ] **Auto-fill** - Drag to extend series
- [ ] **Sort/Filter** - Column filtering
- [ ] **Charts** - Basic chart types (bar, line, pie)
- [ ] **Sparklines** - Mini inline charts
- [ ] **Import/Export CSV**

### 5. **Image-Specific Features**

- [ ] **Basic annotations** - Draw shapes, add text
- [ ] **Crop tool** - Select and crop
- [ ] **Simple filters** - Brightness, contrast, grayscale
- [ ] **Export format** - Convert between formats
- [ ] **EXIF viewer** - Show photo metadata
- [ ] **Gallery mode** - Browse images in folder

---

## 🏗️ Architecture Improvements

### 1. **Shared Infrastructure**

```
Priority: HIGH
```

- [ ] **Create `BaseDocumentViewer` class**
  - Common lifecycle management
  - Standard message handling
  - Unified state restoration

- [ ] **Shared webview utilities**
  - Theme synchronization
  - Keyboard handling
  - Error display

- [ ] **Common toolbar component**
  - Reusable button/dropdown components
  - Consistent styling

```typescript
// Example: Base viewer class
abstract class BaseDocumentViewer extends EditorPane {
  protected webview?: IOverlayWebview;
  protected webviewReady = false;

  protected abstract getWebviewHTML(): string;
  protected abstract handleWebviewMessage(message: any): void;
  protected abstract loadDocument(input: EditorInput): Promise<void>;

  protected setupWebview(): void {
    // Common webview setup
  }

  protected sendToWebview(message: object): void {
    if (this.webviewReady && this.webview) {
      this.webview.postMessage(message);
    }
  }
}
```

### 2. **State Management**

- [ ] **Centralized viewer state service**
  - Zoom levels, scroll positions, selections
  - Persist across sessions
  - Sync across split views

- [ ] **Undo/Redo stack**
  - Shared implementation
  - Memory-efficient snapshots

### 3. **Content Extraction Service**

- [ ] **Unified `IContentExtractor` interface**
  - Already partially implemented
  - Standardize for all viewers
  - Support streaming extraction

- [ ] **Background extraction worker**
  - Don't block UI during extraction
  - Progress reporting

### 4. **Testing Infrastructure**

- [ ] **Unit tests for viewers**
  - Mock webview
  - Test message handling

- [ ] **Integration tests**
  - Open/close documents
  - Edit operations

- [ ] **Performance benchmarks**
  - Load time by file size
  - Memory usage

---

## 🎯 Priority Matrix

| Category | Quick Wins (1-2 days) | Medium Effort (1 week) | Large Effort (2+ weeks) |
|----------|----------------------|------------------------|------------------------|
| **Performance** | Lazy thumbnails, debounce events | Virtual scrolling, worker threads | Page virtualization, streaming |
| **UI/UX** | Tooltips, keyboard shortcuts | Zoom slider, toolbar polish | Ribbon collapse, rulers |
| **Features** | Copy, print, find | Annotations, comments | OCR, charts, form fill |
| **Architecture** | Base class | State service | Full test suite |

---

## 📋 Recommended Implementation Order

### Phase 1: Foundation (2 weeks)
1. Create `BaseDocumentViewer` class
2. Implement virtual scrolling for XLSX
3. Add zoom controls to Image viewer
4. Bundle pdf.js locally

### Phase 2: Performance (2 weeks)
1. Lazy thumbnail rendering for PDF
2. Tree-shake Tiptap bundle
3. Add loading skeletons
4. Implement page virtualization for PDF

### Phase 3: UI Polish (2 weeks)
1. Modernize PDF toolbar
2. Add keyboard shortcuts help
3. Implement theme sync
4. Add formula autocomplete for XLSX

### Phase 4: Features (3+ weeks)
1. PDF text annotation
2. DOCX comments panel
3. XLSX basic charts
4. Image zoom/pan controls

---

## 📚 Resources & References

### Libraries to Consider
- **PDF**: [react-pdf](https://github.com/wojtekmaj/react-pdf), [pdfjs-dist](https://mozilla.github.io/pdf.js/)
- **DOCX**: [mammoth.js](https://github.com/mwilliamson/mammoth.js), [docx](https://github.com/dolanmiu/docx)
- **XLSX**: [ExcelJS](https://github.com/exceljs/exceljs), [Luckysheet](https://github.com/dream-num/Luckysheet)
- **Images**: [panzoom](https://github.com/anvaka/panzoom), [Cropper.js](https://github.com/fengyuanchen/cropperjs)

### Design Inspiration
- Microsoft Office Online
- Google Docs/Sheets
- Adobe Acrobat
- Figma image viewer

---

**Last Updated**: November 25, 2025
**Author**: SafeAppeals2.0 Team

