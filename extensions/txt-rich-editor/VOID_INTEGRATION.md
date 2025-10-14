# Void Integration for txt-rich-editor

## Overview

The txt-rich-editor integrates with Void's AI chat and inline editing features through custom commands that intercept the standard Void keybindings (Ctrl+L and Ctrl+K) when working with rich text files.

## Problem Solved

Void's default `void.ctrlLAction` and `void.ctrlKAction` commands expect a Monaco code editor with an active model, but txt-rich-editor uses a webview with `contentEditable` for rich text editing. This integration bridges that gap.

## Architecture

### Command Flow

```
User Action (Ctrl+L/Ctrl+K or Click)
    ↓
txtRichEditor.ctrlL / txtRichEditor.ctrlK (extension.ts)
    ↓
Check file extension (.txt, .gdoc, .docx)
    ↓
txtRichEditor.webview.addToChat / inlineEdit
    ↓
Webview receives 'request-plain-text-for-chat'
    ↓
Webview extracts text and posts 'void-add-to-chat'
    ↓
VoidWebviewBridge handles message
    ↓
Store in workspace state + Open Void sidebar
```

### Key Components

#### 1. Command Registration (`extension.ts`)

```typescript
const txtRichCtrlL = vscode.commands.registerCommand(
  'txtRichEditor.ctrlL',
  async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const fileExt = editor.document.uri.fsPath.split('.').pop()?.toLowerCase();

    // Only handle for our file types
    if (!['txt', 'gdoc', 'docx'].includes(fileExt || '')) {
      return vscode.commands.executeCommand('void.ctrlLAction');
    }

    // For txt-rich-editor, request plain text from webview
    return vscode.commands.executeCommand('txtRichEditor.webview.addToChat');
  }
);
```

#### 2. Webview Bridge (`voidWebviewBridge.ts`)

Handles bidirectional communication:

- Receives messages from webview
- Stores content in workspace state
- Opens Void sidebar
- Provides content retrieval command for Void

#### 3. Webview Message Handling (`richTextEditorProvider.ts`)

```typescript
case 'request-plain-text-for-chat':
  const plainText = editor.innerText || editor.textContent;
  const selection = window.getSelection();
  vscode.postMessage({
    type: 'void-add-to-chat',
    plainText: selection && !selection.isCollapsed
      ? selection.toString()
      : plainText,
    selection: selectionInfo
  });
  break;
```

#### 4. Package Configuration (`package.json`)

**Commands:**

```json
{
  "command": "txtRichEditor.ctrlL",
  "title": "Add Selection to Void Chat",
  "category": "Rich Text Editor",
  "icon": "$(comment-discussion)"
}
```

**Keybindings:**

```json
{
  "command": "txtRichEditor.ctrlL",
  "key": "ctrl+l",
  "mac": "cmd+l",
  "when": "resourceExtname == .txt || resourceExtname == .gdoc || resourceExtname == .docx"
}
```

## How It Works

### Add to Chat (Ctrl+L)

1. User selects text in rich editor
2. Presses Ctrl+L or clicks "Add to Chat" button
3. `txtRichEditor.ctrlL` command checks file type
4. If txt/gdoc/docx, triggers `txtRichEditor.webview.addToChat`
5. Webview extracts plain text (selection or entire document)
6. Webview posts `void-add-to-chat` message
7. `VoidWebviewBridge` stores content in workspace state
8. Opens Void sidebar (tries multiple command variations)
9. Void can read content via `txtRichEditor.getContentForChat`

### Edit Inline (Ctrl+K)

1. User selects text in rich editor
2. Presses Ctrl+K or clicks "Edit Inline" button
3. `txtRichEditor.ctrlK` command checks file type
4. If txt/gdoc/docx, triggers `txtRichEditor.webview.inlineEdit`
5. Webview extracts HTML context
6. Webview posts `void-inline-edit` message
7. Bridge stores context and invokes `void.ctrlKAction`
8. (Void processes edit)
9. Result sent back via `void-apply-edit` message
10. Webview receives `apply-html-edit` and updates content

## Integration Points

### For Void to Read Content

```typescript
const content = await vscode.commands.executeCommand('txtRichEditor.getContentForChat');
// Returns: { text: string, uri: string } | null
```

### For Void to Send Edits

```typescript
// After processing edit, Void can send result back:
await vscode.commands.executeCommand('txtRichEditor.applyEdit', editedHtml);
```

## Comparison with Standard Void Integration

| Feature | Monaco Editor (Code) | txt-rich-editor (Webview) |
|---------|---------------------|---------------------------|
| Selection | `editor.getSelection()` | `window.getSelection()` |
| Content | `model.getValueInRange()` | `innerText` / `innerHTML` |
| URI | `model.uri` | `document.uri` |
| Language | `model.getLanguageId()` | Derived from extension |
| Direct chat service | ✅ Yes | ❌ No (uses workspace state) |

## Limitations

1. **No Direct Chat Service Access**: Unlike Monaco editors, webview editors can't directly access VS Code services like `IChatThreadService`. Content is stored in workspace state.

2. **Selection Granularity**: Monaco selections are character-precise with line/column info. Webview selections use DOM ranges.

3. **No Line Numbers**: Rich text doesn't have concept of lines, so range is stored as character offsets.

4. **Async Communication**: All webview-extension communication is async via `postMessage`.

## Testing

### Manual Test Steps

1. Open VS Code with txt-rich-editor installed
2. Create or open a `.txt` file
3. Type some content
4. Select text
5. Press Ctrl+L (or click "Add to Chat" button)
6. Verify:
   - Void sidebar opens
   - Content appears in chat context
   - Selection is preserved

### Test Files

- `.txt` - Plain rich text
- `.gdoc` - Google Docs export
- `.docx` - Microsoft Word document

### Expected Behavior

✅ **Working:**

- Selection helper popup appears on text selection
- Ctrl+L opens Void sidebar
- Content is added to chat
- Works with partial selection or full document

❌ **Known Issues:**

- Inline edit (Ctrl+K) requires additional Void-side integration
- Complex formatting may be lost in plain text conversion

## Future Enhancements

1. **Direct Service Access**: Create VS Code API proposal for webview editors to access chat services
2. **Rich Format Preservation**: Send HTML with formatting metadata
3. **Bidirectional Sync**: Real-time collaboration between Void and editor
4. **Image Support**: Include embedded images in chat context
5. **Diff Application**: Apply Void's code diffs to rich text

## Troubleshooting

### Sidebar Doesn't Open

Check command availability:

```javascript
await vscode.commands.getCommands().then(commands =>
  console.log(commands.filter(c => c.includes('void')))
);
```

### Content Not Appearing

Check workspace state:

```javascript
const content = context.workspaceState.get('richTextChatContent');
console.log('Stored content:', content);
```

### Keybinding Conflicts

Ensure `when` clause is specific:

```json
"when": "resourceExtname == .txt || resourceExtname == .gdoc || resourceExtname == .docx"
```

## References

- **Void Selection Helper**: `src/vs/workbench/contrib/void/browser/voidSelectionHelperWidget.ts`
- **Void Sidebar Actions**: `src/vs/workbench/contrib/void/browser/sidebarActions.ts`
- **Chat Thread Service**: `src/vs/workbench/contrib/void/browser/chatThreadService.ts`
- **Webview API**: <https://code.visualstudio.com/api/extension-guides/webview>

## Contributing

When modifying the Void integration:

1. Test with all supported file types (.txt, .gdoc, .docx)
2. Verify keybindings don't conflict with other extensions
3. Check error handling for when Void isn't installed
4. Update this documentation with any changes
5. Add unit tests for message handlers

---

**Last Updated**: 2025-01-14
**Status**: ✅ Functional - Add to Chat working, Edit Inline needs Void-side integration
