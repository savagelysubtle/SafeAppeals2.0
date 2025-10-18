<!-- 0ebf805f-f27b-485c-90ec-5bf01bb9a540 d7c23628-63f7-4251-9f20-ef3bec84c3b8 -->
# Native PDF Viewer Integration - Complete Implementation Plan

## Research Findings: Critical Missing Pieces

### What Was Missing from Original Plan:

1. **Webview Lifecycle Management**: Claim/release mechanism for webview reuse
2. **Content Security Policy (CSP)**: Webview security requirements
3. **File Access from Webview**: Can't use `file://` URIs directly
4. **EditorInput Serialization**: Session persistence not mentioned
5. **Extension API vs Built-in API**: Can't port extension code directly
6. **PDF.js Worker Handling**: Worker file serving not addressed
7. **Text Selection for Ctrl+K**: Getting selection from PDF viewer

## Complete Implementation Strategy

### 1. Document Viewer Service Infrastructure

**Create** `src/vs/workbench/contrib/void/common/documentViewerService.ts`:

```typescript
export interface IDocumentViewerService {
    _serviceBrand: undefined;
    
    // Extract text for AI (whole document)
    getTextContent(uri: URI): Promise<string | null>;
    
    // Extract text for specific pages (for Ctrl+K selection)
    getTextContentRange(uri: URI, startPage: number, endPage: number): Promise<string | null>;
    
    // Check if file is viewable document
    isDocumentFile(uri: URI): boolean;
    
    // Register extractors
    registerExtractor(extensions: string[], extractor: DocumentContentExtractor): void;
}
```

**Register as singleton** with `InstantiationType.Delayed`

### 2. PDF Viewer Components (Complete Architecture)

**Folder structure**:

```
src/vs/workbench/contrib/void/browser/documentViewers/
├── pdfViewer/
│   ├── pdfViewerEditor.ts              # EditorPane implementation
│   ├── pdfViewerInput.ts               # EditorInput implementation
│   ├── pdfViewerInputSerializer.ts     # Session persistence
│   ├── pdfContentExtractor.ts          # Text extraction service
│   ├── pdfViewerService.ts             # Webview management
│   └── media/
│       ├── pdfViewer.html              # Webview UI
│       ├── pdfViewer.css               # Styles
│       ├── pdfViewer.js                # Webview script
│       └── lib/
│           ├── pdf.min.js              # PDF.js (local copy)
│           └── pdf.worker.min.js       # PDF.js worker
└── documentViewer.contribution.ts       # Registration
```

#### A. PDF Viewer Editor (`pdfViewerEditor.ts`)

Extend `EditorPane` (pattern: `WebviewEditor`):

```typescript
export class PDFViewerEditor extends EditorPane {
    static readonly ID = 'void.pdfViewer';
    
    private _element?: HTMLElement;
    private _dimension?: Dimension;
    private _visible = false;
    private webview?: IOverlayWebview;
    
    constructor(
        @IWebviewService private readonly webviewService: IWebviewService,
        @IFileService private readonly fileService: IFileService,
        @ITelemetryService telemetryService: ITelemetryService,
        // ... other services
    ) {
        super(PDFViewerEditor.ID, telemetryService, themeService, storageService);
    }
    
    protected createEditor(parent: HTMLElement): void {
        this._element = DOM.append(parent, DOM.$('div.pdf-viewer-container'));
    }
    
    override async setInput(input: PDFViewerInput, options, context, token): Promise<void> {
        await super.setInput(input, options, context, token);
        
        if (!this.webview) {
            // Create webview with proper options
            this.webview = this.webviewService.createWebviewOverlay({
                providedViewType: 'void.pdfViewer',
                options: {
                    enableScripts: true,
                    enableForms: false,
                    localResourceRoots: [/* PDF.js lib folder */]
                },
                contentOptions: {},
                extension: undefined
            });
            
            // Mount webview to container
            this.webview.claim(this, this.window, undefined);
            this.webview.layoutWebviewOverElement(this._element!);
            
            // Set up message handlers
            this._register(this.webview.onMessage(message => {
                this.handleWebviewMessage(message);
            }));
            
            // Load webview HTML
            this.webview.setHtml(await this.getWebviewHTML());
        }
        
        // Load PDF file
        const pdfUri = input.resource;
        const pdfContent = await this.fileService.readFile(pdfUri);
        
        // Convert to webview-accessible URI or send as ArrayBuffer
        this.webview.postMessage({
            type: 'loadPDF',
            data: pdfContent.value.buffer // ArrayBuffer
        });
    }
    
    private handleWebviewMessage(message: any) {
        switch (message.type) {
            case 'pageChanged':
                // Track current page for Ctrl+K
                (this.input as PDFViewerInput).currentPage = message.page;
                break;
            case 'textSelected':
                // Store selection for Ctrl+K
                (this.input as PDFViewerInput).selection = message.selection;
                break;
        }
    }
    
    override setEditorVisible(visible: boolean): void {
        this._visible = visible;
        if (this.webview) {
            if (visible) {
                this.webview.claim(this, this.window, undefined);
            } else {
                this.webview.release(this);
            }
        }
        super.setEditorVisible(visible);
    }
    
    private async getWebviewHTML(): Promise<string> {
        // Load HTML with CSP nonce
        const nonce = generateUuid();
        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" 
                  content="default-src 'none'; 
                           script-src 'nonce-${nonce}'; 
                           style-src 'nonce-${nonce}' 'unsafe-inline';">
            <link rel="stylesheet" nonce="${nonce}" href="${this.getMediaUri('pdfViewer.css')}">
        </head>
        <body>
            <canvas id="pdf-canvas"></canvas>
            <script nonce="${nonce}" src="${this.getMediaUri('lib/pdf.min.js')}"></script>
            <script nonce="${nonce}" src="${this.getMediaUri('pdfViewer.js')}"></script>
        </body>
        </html>`;
    }
}
```

**Critical**: Use `IOverlayWebview`, not raw webview creation.

#### B. PDF Viewer Input (`pdfViewerInput.ts`)

```typescript
export class PDFViewerInput extends EditorInput {
    static readonly TYPE_ID = 'void.pdfViewerInput';
    
    currentPage: number = 1;
    selection: {startPage: number, endPage: number, text: string} | null = null;
    
    constructor(
        public readonly resource: URI,
        @IFileService private readonly fileService: IFileService
    ) {
        super();
    }
    
    override get typeId(): string {
        return PDFViewerInput.TYPE_ID;
    }
    
    override get Name(): string {
        return basename(this.resource);
    }
    
    override matches(other: EditorInput): boolean {
        return other instanceof PDFViewerInput && 
               isEqual(this.resource, other.resource);
    }
    
    // For serialization
    toJSON(): any {
        return {
            resource: this.resource.toJSON(),
            currentPage: this.currentPage
        };
    }
}
```

#### C. PDF Input Serializer (`pdfViewerInputSerializer.ts`)

**CRITICAL ADDITION**:

```typescript
export class PDFViewerInputSerializer implements IEditorSerializer {
    static readonly ID = PDFViewerInput.TYPE_ID;
    
    canSerialize(input: EditorInput): boolean {
        return input instanceof PDFViewerInput;
    }
    
    serialize(input: PDFViewerInput): string {
        return JSON.stringify(input.toJSON());
    }
    
    deserialize(instantiationService: IInstantiationService, serializedInput: string): EditorInput {
        const data = JSON.parse(serializedInput);
        const uri = URI.revive(data.resource);
        const input = instantiationService.createInstance(PDFViewerInput, uri);
        input.currentPage = data.currentPage || 1;
        return input;
    }
}
```

#### D. PDF Content Extractor (`pdfContentExtractor.ts`)

Reuse `electron-main/ragFileService.ts` extraction logic:

```typescript
export class PDFContentExtractor implements DocumentContentExtractor {
    constructor(
        @ISendLLMMessageService private readonly sendLLMMessageService: ISendLLMMessageService
    ) {}
    
    async extractContent(uri: URI): Promise<string> {
        // Call electron-main extraction via IPC
        const result = await this.sendLLMMessageService.callElectronMain('extractPDFContent', {
            uri: uri.toString(),
            allPages: true
        });
        return result.text;
    }
    
    async extractContentRange(uri: URI, startPage: number, endPage: number): Promise<string> {
        const result = await this.sendLLMMessageService.callElectronMain('extractPDFContent', {
            uri: uri.toString(),
            startPage,
            endPage
        });
        return result.text;
    }
}
```

### 3. Webview Assets (`media/`)

#### `pdfViewer.html` (simplified, actual HTML built in code)

See `getWebviewHTML()` in PDFViewerEditor

#### `pdfViewer.js` (webview script)

```javascript
// Communication with host
const vscode = acquireVsCodeApi();

// PDF.js setup
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';

let pdfDoc = null;
let currentPage = 1;

// Listen for messages from host
window.addEventListener('message', async (event) => {
    const message = event.data;
    
    if (message.type === 'loadPDF') {
        // Load PDF from ArrayBuffer
        const loadingTask = pdfjsLib.getDocument({data: message.data});
        pdfDoc = await loadingTask.promise;
        renderPage(1);
    }
});

async function renderPage(pageNum) {
    const page = await pdfDoc.getPage(pageNum);
    // ... render to canvas ...
    currentPage = pageNum;
    
    // Notify host of page change
    vscode.postMessage({
        type: 'pageChanged',
        page: pageNum
    });
}

// Text selection handling
document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection.toString()) {
        vscode.postMessage({
            type: 'textSelected',
            selection: {
                startPage: currentPage,
                endPage: currentPage,
                text: selection.toString()
            }
        });
    }
});
```

### 4. Registration (`documentViewer.contribution.ts`)

```typescript
// Register editor pane
Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane)
    .registerEditorPane(
        EditorPaneDescriptor.create(
            PDFViewerEditor,
            PDFViewerEditor.ID,
            'PDF Viewer'
        ),
        [new SyncDescriptor(PDFViewerInput)]
    );

// Register serializer
Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory)
    .registerEditorSerializer(
        PDFViewerInputSerializer.ID,
        PDFViewerInputSerializer
    );

// Register resolver
class PDFResolverContribution extends Disposable {
    constructor(
        @IEditorResolverService editorResolverService: IEditorResolverService,
        @IInstantiationService instantiationService: IInstantiationService
    ) {
        super();
        
        this._register(editorResolverService.registerEditor(
            `**/*.pdf`,
            {
                id: PDFViewerEditor.ID,
                label: 'PDF Viewer',
                priority: RegisteredEditorPriority.builtin
            },
            {
                singlePerResource: false,
                canSupportResource: resource => 
                    resource.scheme === Schemas.file && resource.path.endsWith('.pdf')
            },
            {
                createEditorInput: ({ resource }) => ({
                    editor: instantiationService.createInstance(PDFViewerInput, resource)
                })
            }
        ));
    }
}
```

### 5. Ctrl+K/L Integration (Updated)

**Modify** `sidebarActions.ts`:

```typescript
// In Ctrl+L action:
const editor = editorService.getActiveCodeEditor();
const model = editor?.getModel();

// NEW: Check for PDF viewer
const activePane = editorService.getActiveEditorPane();
if (activePane?.input instanceof PDFViewerInput) {
    const pdfInput = activePane.input as PDFViewerInput;
    const documentViewerService = accessor.get(IDocumentViewerService);
    
    // Get text based on selection or whole document
    let textContent: string;
    if (pdfInput.selection) {
        textContent = await documentViewerService.getTextContentRange(
            pdfInput.resource,
            pdfInput.selection.startPage,
            pdfInput.selection.endPage
        );
    } else {
        textContent = await documentViewerService.getTextContent(pdfInput.resource);
    }
    
    chatThreadService.addNewStagingSelection({
        type: 'File',
        uri: pdfInput.resource,
        language: 'pdf',
        textContent,
        state: { wasAddedAsCurrentFile: false }
    });
    
    // Open sidebar and focus
    await commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID);
    await chatThreadService.focusCurrentChat();
    return;
}

// ... rest of existing code for text editors
```

### 6. PDF.js Bundle Management

**Add to root `package.json` or `extensions/package.json`**:

```json
{
  "dependencies": {
    "pdfjs-dist": "^3.11.174"
  }
}
```

**Copy PDF.js to media folder** (build script or manual):

- `node_modules/pdfjs-dist/build/pdf.min.js` → `media/lib/pdf.min.js`
- `node_modules/pdfjs-dist/build/pdf.worker.min.js` → `media/lib/pdf.worker.min.js`

**OR** use build step in `gulpfile` to copy assets

### 7. Electron-Main PDF Extraction Bridge

**Add to** `electron-main/sendLLMMessageService.ts`:

```typescript
// Register handler for PDF extraction
ipcMain.handle('extractPDFContent', async (event, args) => {
    const { uri, allPages, startPage, endPage } = args;
    const ragFileService = accessor.get(IRAGFileService);
    return await ragFileService.extractPDFPages(URI.parse(uri), startPage, endPage);
});
```

**Update** `electron-main/ragFileService.ts`:

Add method:

```typescript
async extractPDFPages(uri: URI, startPage?: number, endPage?: number): Promise<{text: string}> {
    // Reuse existing extractPDF logic but with page range support
    // ...
}
```

### 8. License Compliance

**Add to `ThirdPartyNotices.txt`**:

```
---------------------------------------------------------

PDF.js 3.11.174 - Apache License 2.0
https://github.com/mozilla/pdf.js

Copyright 2011 Mozilla Foundation

Licensed under the Apache License, Version 2.0 (the "License");
[full Apache 2.0 license text]

---------------------------------------------------------

vscode-pdf Extension (reference implementation) - MIT License  
https://github.com/tomoki1207/vscode-pdfviewer

Copyright (c) Tomoki Imai

Permission is hereby granted, free of charge...
[full MIT license text]

---------------------------------------------------------
```

### 9. Register Services

**Update** `void.contribution.ts`:

```typescript
// Document viewer service
import '../common/documentViewerService.js'

// PDF viewer components
import './documentViewers/documentViewer.contribution.js'
```

## Testing Checklist

1. PDF opens in viewer (not text editor)
2. Navigation works (page up/down)
3. Zoom works
4. Ctrl+L on PDF adds full text to chat
5. Select text in PDF, Ctrl+L adds only selection
6. Ctrl+K with selection works
7. Session persistence (reopen window, PDF state restored)
8. Large PDFs (100+ pages) perform well
9. Password-protected PDFs show prompt
10. CSP doesn't block scripts

## Files to Create

1. `src/vs/workbench/contrib/void/common/documentViewerService.ts`
2. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerEditor.ts`
3. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerInput.ts`
4. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerInputSerializer.ts` ⭐ NEW
5. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfContentExtractor.ts`
6. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfViewerService.ts`
7. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.html`
8. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.css`
9. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/pdfViewer.js` ⭐ NEW
10. `src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media/lib/` (PDF.js files)
11. `src/vs/workbench/contrib/void/browser/documentViewers/documentViewer.contribution.ts`

## Files to Modify

1. `src/vs/workbench/contrib/void/browser/void.contribution.ts`
2. `src/vs/workbench/contrib/void/browser/sidebarActions.ts`
3. `src/vs/workbench/contrib/void/browser/quickEditActions.ts`
4. `src/vs/workbench/contrib/void/electron-main/ragFileService.ts` (add page range support)
5. `src/vs/workbench/contrib/void/electron-main/sendLLMMessageService.ts` (add IPC handler)
6. `package.json` or `extensions/package.json` (add pdfjs-dist dependency)
7. `ThirdPartyNotices.txt`

## Success Criteria

- PDFs open in native viewer with full navigation
- Ctrl+L/K work with full document or selections
- Sessions persist across restarts
- No CSP violations
- Proper license attribution
- Performance good for large PDFs (streaming/pagination)

## Phase 2 (Separate Plan)

- Office viewer (docx, xlsx, pptx)
- Legacy Office formats
- OCR for scanned PDFs

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