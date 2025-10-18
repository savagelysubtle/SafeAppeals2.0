<!-- 0ebf805f-f27b-485c-90ec-5bf01bb9a540 d84b7f64-b476-4a59-9d23-821e0ff6b0d5 -->
# Native PDF Viewer Integration into Void Core

## Overview
Integrate a native PDF viewer directly into `src/vs/workbench/contrib/void/` to enable seamless document viewing and AI-powered editing via Ctrl+K/L. This implementation ports functionality from the tomoki1207/pdf extension into Void's core architecture.

## Implementation Strategy

### 1. Create Document Viewer Infrastructure

**Create service layer** (`src/vs/workbench/contrib/void/common/documentViewerService.ts`):
- Interface `IDocumentViewerService` for managing document viewers
- Content extraction bridge for Ctrl+K/L integration
- Registry for file type handlers (PDF, then Office in Phase 2)
- Integrate with existing `IVoidModelService` pattern

**Key methods**:
- `getTextContent(uri: URI): Promise<string>` - Extract text for AI
- `isDocumentFile(uri: URI): boolean` - File type detection
- `registerExtractor(extensions, extractor)` - Extensible architecture

### 2. Build PDF Viewer Components

**Create folder structure**:
```
src/vs/workbench/contrib/void/browser/documentViewers/
├── pdfViewer/
│   ├── pdfViewerEditor.ts       # Main editor pane
│   ├── pdfViewerInput.ts        # Editor input descriptor
│   ├── pdfContentExtractor.ts   # Text extraction for AI
│   └── media/
│       ├── pdfViewer.html       # PDF.js webview
│       └── pdfViewer.css        # Viewer styles
└── documentViewer.contribution.ts  # Registration
```

**PDF Viewer Editor** (`pdfViewerEditor.ts`):
- Extend `EditorPane` class (follows VSCode patterns)
- Embed PDF.js via webview
- Implement zoom, search, navigation, annotations
- Handle multi-page rendering
- Support keyboard shortcuts

**PDF Content Extractor** (`pdfContentExtractor.ts`):
- Reuse existing `pdfjs-dist` from `electron-main/ragFileService.ts`
- Extract text content page-by-page
- Return formatted text for Void AI context
- Handle large PDFs efficiently (streaming)

**PDF Viewer Input** (`pdfViewerInput.ts`):
- Extend `EditorInput` or webview-based input
- Track PDF URI and state
- Handle serialization/deserialization

### 3. Register with VSCode Editor System

**Document Viewer Contribution** (`documentViewer.contribution.ts`):
- Register `PDFViewerEditor` with `EditorPaneRegistry`
- Use `IEditorResolverService` to intercept `*.pdf` file opens
- Set priority to `RegisteredEditorPriority.builtin`
- Create resolver that returns `PDFViewerInput` for PDF files
- Pattern: Similar to `chat.contribution.ts` (line 346-392)

**File pattern matching**:
```typescript
editorResolverService.registerEditor(
  `**/*.pdf`,
  { id: PDFViewerEditor.ID, label: 'PDF Viewer', priority: builtin },
  { canSupportResource: resource => resource.path.endsWith('.pdf') },
  { createEditorInput: ({ resource }) => createPDFInput(resource) }
)
```

### 4. Integrate with Void's Ctrl+K/L Actions

**Modify** `src/vs/workbench/contrib/void/browser/sidebarActions.ts`:
- In Ctrl+L action (line ~93): Check if active editor is `PDFViewerInput`
- If PDF detected, call `documentViewerService.getTextContent(uri)`
- Add extracted text to `chatThreadService.addNewStagingSelection()`
- Use type `'File'` with extracted `textContent` field

**Modify** `src/vs/workbench/contrib/void/browser/quickEditActions.ts`:
- Similar integration for Ctrl+K (quick edit)
- Extract PDF content in selection range if applicable
- Allow AI to suggest changes to PDF text

### 5. Import PDF.js Library

**Use existing PDF.js** from RAG service:
- Already imported in `electron-main/ragFileService.ts` (line 77)
- Use `pdfjs-dist/build/pdf.mjs` for Node.js context
- For webview: Use PDF.js CDN or bundle locally

**Bundle approach**:
- Add PDF.js to `extensions/package.json` or void-specific deps
- Use esbuild/webpack to bundle for webview
- Store in `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/lib/`

### 6. License Compliance

**Research licenses**:
- PDF.js: Apache License 2.0 (Mozilla)
- tomoki1207/pdf extension: MIT License (verify from GitHub)

**Add to ThirdPartyNotices.txt**:
- Append PDF.js license notice (format: name, version, URL, full license text)
- Append tomoki1207/pdf extension notice if porting code directly
- Follow existing format in `ThirdPartyNotices.txt` (line 1-50 shows pattern)

**Location**: Root `ThirdPartyNotices.txt`

### 7. Register Services and Contributions

**Update** `src/vs/workbench/contrib/void/browser/void.contribution.ts`:
```typescript
// Import document viewer service
import '../common/documentViewerService.js'

// Import document viewer contributions
import './documentViewers/documentViewer.contribution.js'
```

**Register singleton** in `documentViewerService.ts`:
```typescript
registerSingleton(IDocumentViewerService, DocumentViewerService, InstantiationType.Delayed);
```

### 8. Handle Edge Cases

- **Large PDFs**: Stream content, implement pagination
- **Password-protected PDFs**: Show password prompt
- **Corrupted PDFs**: Show error message
- **Text extraction failures**: Fallback to "PDF content unavailable"
- **Performance**: Lazy load pages, cache rendered pages

## Testing Plan

1. **Basic viewing**: Open various PDFs, verify rendering
2. **Ctrl+L integration**: Select PDF, press Ctrl+L, verify text appears in chat
3. **Ctrl+K integration**: Select PDF text, press Ctrl+K, verify AI can reference it
4. **Multi-page PDFs**: Test large documents (100+ pages)
5. **Edge cases**: Password-protected, corrupted, scanned PDFs (OCR needed?)
6. **Performance**: Measure load times, memory usage

## Files to Create

1. `src/vs/workbench/contrib/void/common/documentViewerService.ts`
2. `src/vs/workbench/contrib/void/browser/documentViewers/documentViewer.contribution.ts`
3. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerEditor.ts`
4. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerInput.ts`
5. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfContentExtractor.ts`
6. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.html`
7. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.css`

## Files to Modify

1. `src/vs/workbench/contrib/void/browser/void.contribution.ts` (add imports)
2. `src/vs/workbench/contrib/void/browser/sidebarActions.ts` (Ctrl+L handling)
3. `src/vs/workbench/contrib/void/browser/quickEditActions.ts` (Ctrl+K handling)
4. `ThirdPartyNotices.txt` (add PDF.js and extension licenses)

## Success Criteria

- PDFs open natively in Void (not as code text)
- Ctrl+L on PDF file adds readable text to chat
- Ctrl+K can reference PDF content for AI edits
- No extension dependencies - fully integrated into core
- Proper license attribution in ThirdPartyNotices.txt

## Next Steps (Phase 2 - Not in this plan)

- Office viewer (docx, xlsx, pptx)
- Legacy Office formats (doc, xls, ppt)
- TXT file viewer enhancements


### To-dos

- [ ] Create IDocumentViewerService interface and implementation in common/
- [ ] Create folder structure for PDF viewer in browser/documentViewers/pdfViewer/
- [ ] Implement PDF content extractor using existing pdfjs-dist from RAG service
- [ ] Create PDFViewerInput class extending EditorInput
- [ ] Implement PDFViewerEditor extending EditorPane with PDF.js webview
- [ ] Create webview HTML and CSS for PDF rendering
- [ ] Create documentViewer.contribution.ts to register PDF editor with EditorResolverService
- [ ] Modify sidebarActions.ts to handle PDF files with Ctrl+L
- [ ] Modify quickEditActions.ts to handle PDF files with Ctrl+K
- [ ] Update void.contribution.ts to import document viewer services
- [ ] Add PDF.js and tomoki1207/pdf licenses to ThirdPartyNotices.txt
- [ ] Test PDF viewing, Ctrl+K/L integration, and edge cases