# Void Integration for Rich Text Editor

This document explains how the Rich Text Editor integrates with Void's AI agent capabilities.

## Overview

The Rich Text Editor now supports Void's Ctrl+L (chat) and Ctrl+K (inline edit) features, with environment-specific implementations for desktop and web.

## Architecture

### Desktop Mode

- Uses **Monaco editor** for text editing
- Stores HTML formatting in metadata/state
- Displays plain text in Monaco with decorations
- Full Void integration via VSCode services

### Web Mode

- Uses **webview editor** (contenteditable)
- Message-based bridge to Void services
- HTML state managed in webview
- Limited to webview message passing

## Features

### 1. Ctrl+L - Add to Void Chat

**Desktop:**

- Extracts plain text from Monaco editor
- Strips HTML formatting
- Calls Void's `IChatThreadService.addNewStagingSelection()`
- Opens Void sidebar

**Web:**

- Webview sends plain text via postMessage
- Bridge forwards to Void chat command
- Opens Void sidebar

**Usage:**

1. Select text in rich text editor (or no selection for entire file)
2. Press `Ctrl+L` (or `Cmd+L` on Mac)
3. Selection appears in Void chat as plain text

### 2. Ctrl+K - Inline Edit

**Desktop:**

- Extracts HTML from selection
- Stores HTML context for edit handler
- Calls Void's `IEditCodeService.addCtrlKZone()`
- AI edits preserve HTML formatting

**Web:**

- Webview sends HTML selection via postMessage
- Bridge stores HTML context
- Forwards to Void inline edit command
- Edits applied back to webview

**Usage:**

1. Select text in rich text editor
2. Press `Ctrl+K` (or `Cmd+K` on Mac)
3. Enter editing instruction
4. AI modifies content while preserving formatting

## File Structure

```
extensions/txt-rich-editor/src/
├── extension.ts              # Main activation, environment detection
├── monacoRichTextEditor.ts   # Monaco wrapper for desktop
├── richTextEditorProvider.ts # Webview editor provider
├── voidActions.ts            # Ctrl+L and Ctrl+K command registration
├── voidWebviewBridge.ts      # Web environment Void integration
├── htmlEditHandler.ts        # HTML-aware edit processing
└── conversion.ts             # HTML/DOCX utilities
```

## Implementation Details

### Environment Detection

```typescript
import { isWebEnvironment } from './conversion';

if (!isWebEnvironment()) {
  // Desktop: Use Monaco + webview hybrid
  monacoEditor = new MonacoRichTextEditor(context);
} else {
  // Web: Use webview only
  webviewBridge = new VoidWebviewBridge(context);
}
```

### Monaco HTML State Management

The Monaco editor stores HTML state separately from the plain text content:

```typescript
class MonacoRichTextEditor {
  private htmlStateMap = new Map<string, string>(); // uri -> HTML

  getHtmlState(uri: Uri): string | undefined;
  setHtmlState(uri: Uri, html: string): void;
  htmlToPlainText(html: string): string;
}
```

### Webview Message Protocol

**Extension → Webview:**

- `request-plain-text-for-chat`: Request text for Void chat
- `request-html-for-inline-edit`: Request HTML for inline edit
- `apply-html-edit`: Apply edited HTML back to webview

**Webview → Extension:**

- `void-add-to-chat`: Send plain text to Void chat
- `void-inline-edit`: Send HTML for inline editing
- `void-apply-edit`: Edited HTML from Void

### HTML Edit Processing

The `HtmlEditHandler` class processes AI edits:

1. **Parse Void Output**: Extract search/replace blocks

   ```
   <<<<<<< ORIGINAL
   original text
   =======
   replacement text
   >>>>>>> UPDATED
   ```

2. **Apply to HTML**: Replace while preserving formatting
3. **Update Editor**: Sync to Monaco or webview

## Configuration

### Package.json

Commands:

- `txtRichEditor.addToVoidChat` - Ctrl+L action
- `txtRichEditor.inlineEdit` - Ctrl+K action

Keybindings:

- `Ctrl+L` / `Cmd+L` - Add to chat (when `richTextEditorActive`)
- `Ctrl+K` / `Cmd+K` - Inline edit (when `richTextEditorActive`)

Context Keys:

- `richTextEditorActive` - True when .txt/.gdoc/.docx file is active

## Future Enhancements

1. **Better HTML Parsing**: Use proper HTML parser (jsdom/htmlparser2)
2. **Richer Decorations**: More Monaco decorations for HTML styling
3. **Bidirectional Sync**: Real-time sync between Monaco and HTML state
4. **Diff Visualization**: Show HTML-aware diffs in Monaco
5. **Format Preservation**: Smarter AI edit merging with HTML

## Testing

To test the integration:

1. **Desktop Environment:**
   - Open a .txt file
   - Add some rich formatting (bold, italic, headings)
   - Select text and press `Ctrl+L` - should add plain text to Void chat
   - Select text and press `Ctrl+K` - should start inline edit

2. **Web Environment:**
   - Open a .txt file in web version
   - Add rich formatting
   - Test same Ctrl+L and Ctrl+K actions
   - Verify message bridge is working

3. **Formatting Preservation:**
   - Create document with mixed formatting
   - Use Ctrl+K to edit a section
   - Verify formatting outside edit range is preserved
   - Verify edited content maintains appropriate formatting

## Troubleshooting

**Commands don't work:**

- Ensure Void extension is installed and active
- Check that file extension is .txt, .gdoc, or .docx
- Verify `richTextEditorActive` context key is set

**Formatting lost after edit:**

- This is expected for current implementation
- HTML edit handler needs enhancement for better format preservation
- Consider using Slow Apply mode for complex formatting

**Web environment issues:**

- Check browser console for webview message errors
- Verify postMessage bridge is initialized
- Ensure Void services are accessible via commands
