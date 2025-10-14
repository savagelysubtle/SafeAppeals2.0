# Compilation Commands

## Root Project (VS Code Fork)

```bash
cd src && npx tsc --skipLibCheck
node ./node_modules/gulp/bin/gulp.js compile-extensions
```

## txt-rich-editor Extension

```bash
# TypeScript only (fast) - WORKS
npx tsc --skipLibCheck --project extensions/txt-rich-editor/tsconfig.json

# Full extension build
cd extensions/txt-rich-editor && npm run compile

# Extension development watch mode
cd extensions/txt-rich-editor && npm run watch
```

## Quick Commands

### TypeScript only (fast)

```bash
# Root project
cd src && npx tsc --skipLibCheck

# Extension only
npx tsc --skipLibCheck --project extensions/txt-rich-editor/tsconfig.json
```

### Full build

```bash
node ./node_modules/gulp/bin/gulp.js compile-extensions
```

### Extension development

```bash
cd extensions/txt-rich-editor && npm run watch
```

## txt-rich-editor Void Integration

### ⚠️ CRITICAL: How to Open Files in Rich Text Editor

**The screenshot shows a PLAIN TEXT editor, not the rich text editor!**

To test the Void integration, you MUST open files in the rich text editor webview:

1. **Right-click the file** in Explorer → "Open With..." → "Rich Text Editor"
2. OR change `package.json` line 32: `"priority": "option"` (instead of `"default"`)
3. OR remove the `priority` field entirely to make it the default

**You'll know you're in the rich text editor when you see:**

- ✅ Ribbon toolbar with Bold, Italic, etc. buttons
- ✅ Rich formatting (actual bold/italic text)
- ✅ Page-like layout with margins

**You're in the wrong editor if you see:**

- ❌ Line numbers
- ❌ Minimap
- ❌ Monospace font

### Add to Chat (Ctrl+L) & Edit Inline (Ctrl+K)

The txt-rich-editor integrates with Void's AI chat and inline editing features:

**Commands registered:**

- `txtRichEditor.ctrlL` - Add selection to Void chat (bound to Ctrl+L/Cmd+L)
- `txtRichEditor.ctrlK` - Edit inline with Void (bound to Ctrl+K/Cmd+K)

**How it works:**

1. User selects text in txt-rich-editor
2. Selection helper popup appears with "Add to Chat" and "Edit Inline" options
3. Clicking or pressing keybinding triggers custom command
4. Command checks if file is .txt, .gdoc, or .docx
5. Webview extracts plain text and sends to extension
6. Extension stores content in workspace state
7. Extension opens Void sidebar
8. Void reads content via `txtRichEditor.getContentForChat` command

**Files involved:**

- `extensions/txt-rich-editor/src/extension.ts` - Command registration
- `extensions/txt-rich-editor/src/voidWebviewBridge.ts` - Bridge between webview and Void
- `extensions/txt-rich-editor/src/richTextEditorProvider.ts` - Webview message handling
- `extensions/txt-rich-editor/package.json` - Command definitions and keybindings

**Testing:**

1. Open a .txt file in txt-rich-editor
2. Select some text
3. Press Ctrl+L or click "Add to Chat" in the popup
4. Void sidebar should open with the content ready to use

## Compilation & Testing

### After Making Changes

```bash
# 1. Compile VS Code core (for new Void API)
cd src && npx tsc --skipLibCheck

# 2. Compile txt-rich-editor extension
npx tsc --skipLibCheck --project extensions/txt-rich-editor/tsconfig.json

# 3. Reload VS Code
# Press Ctrl+Shift+P → "Developer: Reload Window"
```

### Diagnostic Command

To debug the integration:

```
Ctrl+Shift+P → "Rich Text Editor: Show Integration Diagnostic"
```

This shows:

- Whether rich text editor is active
- Editor registry state
- Registered commands count

### See Complete Documentation

- **`extensions/txt-rich-editor/INTEGRATION_COMPLETE.md`** - Full implementation details
- **`extensions/txt-rich-editor/TESTING_INSTRUCTIONS.md`** - Testing guide
- **`extensions/txt-rich-editor/VOID_INTEGRATION.md`** - Architecture docs
