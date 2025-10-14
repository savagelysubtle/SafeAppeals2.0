# Testing Instructions for txt-rich-editor Void Integration

## Problem: File Opens in Plain Text Editor

**What you're seeing:** When you open `sample.txt`, it opens in VS Code's default Monaco text editor (the one shown in your screenshot), NOT in the txt-rich-editor webview.

**Why this happens:** The custom editor in `package.json` has `"priority": "default"`, which means VS Code prefers the built-in editor.

## How to Test the Rich Text Editor

### Method 1: Open With... (Recommended)

1. **Close the currently open file**
2. In the Explorer sidebar, **right-click** `sample.txt`
3. Select **"Open With..."**
4. Choose **"Rich Text Editor"**
5. The file will now open in the webview-based rich text editor (with the ribbon toolbar at the top)

### Method 2: Use Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Open with Rich Text Editor"
3. Select the command
4. Choose the file

### Method 3: Change Default Editor Priority

**Option A: Make it ask every time (recommended for testing):**

Edit `package.json` line 32:

```json
"priority": "option"  // Instead of "default"
```

**Option B: Make it the default (auto-open in rich editor):**

Remove the priority line entirely from `package.json`:

```json
{
  "viewType": "txtRichEditor.editor",
  "displayName": "Rich Text Editor",
  "selector": [
    {
      "filenamePattern": "*.txt"
    },
    {
      "filenamePattern": "*.gdoc"
    }
  ]
  // NO priority field = this becomes the default
}
```

## Verifying You're in the Rich Text Editor

You'll know you're in the **Rich Text Editor** webview when you see:

✅ **Ribbon toolbar** at the top with formatting buttons (Bold, Italic, etc.)
✅ **Rich formatting** - text with actual bold/italic/colors
✅ **"Add to Chat Ctrl+L"** button appears when you select text
✅ **Page-like layout** with margins

You'll know you're in the **Plain Text Editor** (Monaco) when you see:

❌ No ribbon toolbar
❌ Line numbers on the left
❌ Plain monospace font
❌ Standard Monaco editor features (minimap, etc.)

## Testing Void Integration

### Once you're in the Rich Text Editor

1. **Type or select some text**
2. **Select the text** (highlight it with your mouse)
3. **Wait for the popup** - You should see a small popup appear next to your selection with:
   - "Add to Chat Ctrl+L"
   - "Edit Inline Ctrl+K"
   - More options button (...)

4. **Test Add to Chat**:
   - Click "Add to Chat" OR press `Ctrl+L`
   - Void sidebar should open
   - Your selected text should be available to the chat

5. **Test Edit Inline**:
   - Click "Edit Inline" OR press `Ctrl+K`
   - Void inline edit should activate
   - (This feature needs additional Void-side integration)

## Debugging

### Check if Rich Editor is Active

Open the Developer Console (`Help` → `Toggle Developer Tools`) and run:

```javascript
vscode.window.activeTextEditor?.document?.uri
```

- If it shows `scheme: "vscode-custom-editor"` → ✅ Rich text editor is active
- If it shows `scheme: "file"` → ❌ Plain text editor is active

### Check Editor Registry

From the command palette, run:

```
Rich Text Editor: Show Logs
```

Look for messages like:

```
Registered active editor: file:///path/to/sample.txt (text)
```

### Test Command Manually

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Add Selection to Void Chat"
3. If you see the command and it works → Commands are registered ✅
4. If the command is grayed out → Check `richActive` context

## Current Status

### ✅ Working in Plain Text Editor (Monaco)

- Void's selection helper popup appears
- Ctrl+L adds to chat
- Ctrl+K inline edit works
- **This is Void's built-in functionality**

### ⚠️ Needs Testing in Rich Text Editor (Webview)

- Custom selection helper popup (from webview HTML)
- `txtRichEditor.ctrlL` command
- `txtRichEditor.ctrlK` command
- **This is the new functionality we added**

## Expected Behavior

### In Rich Text Editor (Webview)

1. **Selection helper appears** - Custom HTML popup from the webview
2. **Ctrl+L pressed** → `txtRichEditor.ctrlL` → webview extracts text → opens Void sidebar
3. **Content stored** in workspace state
4. **Void reads content** via `txtRichEditor.getContentForChat` command

### In Plain Text Editor (Monaco)

1. **Selection helper appears** - Void's React-based overlay widget
2. **Ctrl+L pressed** → `void.ctrlLAction` → directly accesses Monaco model → opens Void sidebar
3. **Content added** directly to chat thread service
4. **No workspace state** needed

## Known Issues

1. **Files open in plain text by default** - Need to use "Open With..." or change priority
2. **Context keys may not be set** - `richActive` context might not be properly set when webview is active
3. **Keybinding conflicts** - Both `txtRichEditor.ctrlL` and `txtRich.void.addToChat` are bound to Ctrl+L

## Next Steps

1. **Test in actual rich text editor webview** (use "Open With...")
2. **Verify selection helper appears** in the webview
3. **Test Ctrl+L integration** end-to-end
4. **Check console for errors** in both main window and webview devtools
5. **Verify workspace state storage** after adding to chat

## Compiling After Changes

```bash
npx tsc --skipLibCheck --project extensions/txt-rich-editor/tsconfig.json
```

Or full rebuild:

```bash
node ./node_modules/gulp/bin/gulp.js compile-extensions
```

---

**If you're still seeing the plain text editor after following these steps, please share:**

1. Screenshot showing the editor (to confirm it's the webview)
2. Console errors from Developer Tools
3. Output from "Rich Text Editor: Show Logs"
