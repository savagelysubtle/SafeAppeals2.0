<!-- 29617583-5e9b-42ac-b96b-87f491251d87 a43249eb-2e56-4ab1-8f61-b3401006a410 -->
# Add Void Chat & Inline Editing to Rich Text Editor

## Overview

Integrate void agent capabilities (Ctrl+L chat and Ctrl+K inline editing) into the txt-rich-editor extension. Use Monaco editor for desktop environments and keep webview for web, with plain text chat integration and HTML-preserving inline edits.

## Implementation Strategy

### 1. Create Monaco-Based Rich Text Editor (Desktop)

**File**: `extensions/txt-rich-editor/src/monacoRichTextEditor.ts` (new)

Create a Monaco editor wrapper that:

- Stores HTML representation in model metadata/state
- Displays plain text in Monaco but tracks formatting separately
- Syncs between HTML state and plain text display
- Integrates with void's `IEditCodeService` and `IChatThreadService`

**Key components**:

- Custom language/mode for rich text files
- Decorations for rich text styling (bold, italic, headings)
- HTML <-> Plain text bidirectional conversion
- Document save handler that writes plain text to file

### 2. Environment-Aware Editor Provider

**File**: `extensions/txt-rich-editor/src/richTextEditorProvider.ts` (modify)

Add environment detection and conditional provider registration:

```typescript
// Check if desktop vs web
if (!isWebEnvironment()) {
    // Register Monaco-based editor provider
    registerMonacoRichTextEditor(context);
} else {
    // Keep existing webview provider
    registerWebviewRichTextEditor(context);
}
```

### 3. Bridge Void Services to Webview (Web Only)

**File**: `extensions/txt-rich-editor/src/voidWebviewBridge.ts` (new)

For webview editor, create message handlers:

- Extract plain text from contenteditable
- Send to void chat service via postMessage bridge
- Receive inline edit HTML changes from void
- Apply HTML edits back to contenteditable

### 4. Register Void Keybindings for Rich Text Files

**File**: `extensions/txt-rich-editor/src/voidActions.ts` (new)

Register Ctrl+L and Ctrl+K actions with context keys:

```typescript
when: resourceExtname =~ /\\.(txt|gdoc|docx)$/ && richTextEditorActive
```

**Ctrl+L Action**:

- Get plain text from editor (strip HTML)
- Get selection range
- Call `IChatThreadService.addNewStagingSelection()`
- Open void sidebar

**Ctrl+K Action**:

- Get HTML selection
- Call `IEditCodeService.addCtrlKZone()`
- Display inline edit UI
- Stream AI edits to HTML (not plain text)

### 5. HTML-Aware Inline Editing

**File**: `extensions/txt-rich-editor/src/htmlEditHandler.ts` (new)

Custom edit handler for HTML content:

- Parse HTML before/after for search-replace
- Apply LLM edits to HTML structure
- Preserve formatting tags during edits
- Update both Monaco model (if desktop) or webview (if web)

### 6. Update Package.json

Add void-specific configurations and commands:

- Context keys for rich text editor focus
- Keybindings for Ctrl+L and Ctrl+K
- Command contributions

## File Changes

### New Files

1. `extensions/txt-rich-editor/src/monacoRichTextEditor.ts` - Monaco wrapper for desktop
2. `extensions/txt-rich-editor/src/voidWebviewBridge.ts` - Webview void integration
3. `extensions/txt-rich-editor/src/voidActions.ts` - Keybinding actions
4. `extensions/txt-rich-editor/src/htmlEditHandler.ts` - HTML-aware editing

### Modified Files

1. `extensions/txt-rich-editor/src/extension.ts` - Conditional provider registration
2. `extensions/txt-rich-editor/src/richTextEditorProvider.ts` - Split web/desktop logic
3. `extensions/txt-rich-editor/package.json` - Add commands, keybindings, context keys

## Technical Considerations

- Monaco editor will need custom decorators to show rich text styling
- HTML parsing/diffing for inline edits requires careful implementation
- State sync between HTML and plain text representations must be robust
- Ensure void services are available (use `ICodeEditorService`, `IEditCodeService`, `IChatThreadService`)

## Testing

After implementation, test:

1. Desktop: Open .txt file, should use Monaco editor with rich text features
2. Web: Open .txt file, should use webview editor
3. Both: Ctrl+L should add selection to void chat as plain text
4. Both: Ctrl+K should open inline edit that preserves HTML formatting
5. Desktop: Monaco decorations should reflect HTML formatting
6. Both: Edits should save as plain text to file

### To-dos

- [ ] Add environment detection logic to conditionally use Monaco (desktop) vs webview (web) editor
- [ ] Create Monaco-based rich text editor with HTML state management and plain text display
- [ ] Create void service bridge for webview editor (message passing for chat and inline edits)
- [ ] Register Ctrl+L and Ctrl+K actions for rich text files with proper context keys
- [ ] Implement Ctrl+L action: extract plain text, add to chat thread service, open sidebar
- [ ] Implement Ctrl+K action: create edit zone, handle HTML-aware inline editing
- [ ] Create HTML-aware edit handler that preserves formatting during AI edits
- [ ] Update package.json with void commands, keybindings, and context keys
- [ ] Test both Monaco and webview editors with void chat and inline editing features