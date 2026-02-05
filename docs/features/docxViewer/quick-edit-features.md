# DOCX Viewer Quick Edit Features (Ctrl+L & Ctrl+K)

This document describes the implementation of the **Add to Chat (Ctrl+L)** and **Inline Edit (Ctrl+K)** features for the DOCX viewer, including architecture, key files, and maintenance guidance.

## Overview

| Feature | Shortcut | Purpose | Implementation |
|---------|----------|---------|----------------|
| **Add to Chat** | `Ctrl+L` | Sends selected text to the chat sidebar for discussion | Command-based, executes `void.ctrlLAction` |
| **Inline Edit** | `Ctrl+K` | Opens a popup to edit selected text with AI assistance | Webview popup + LLM call |

Both features are triggered when text is selected in the DOCX editor. A floating tooltip appears showing both options.

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOCX Viewer                              │
├──────────────────────────┬──────────────────────────────────────┤
│       Webview            │           Host (Editor Pane)          │
│   (docxViewerTiptap.js)  │       (docxViewerEditor.ts)           │
├──────────────────────────┼──────────────────────────────────────┤
│                          │                                       │
│  ┌──────────────────┐    │                                       │
│  │  Tiptap Editor   │    │                                       │
│  │  (Rich Text)     │    │                                       │
│  └────────┬─────────┘    │                                       │
│           │              │                                       │
│  ┌────────▼─────────┐    │                                       │
│  │ Selection        │    │                                       │
│  │ Tracking         │────┼──► textSelected message               │
│  └────────┬─────────┘    │                                       │
│           │              │                                       │
│  ┌────────▼─────────┐    │                                       │
│  │ Selection        │    │                                       │
│  │ Tooltip          │    │                                       │
│  │ [Ctrl+L] [Ctrl+K]│    │                                       │
│  └────────┬─────────┘    │                                       │
│           │              │                                       │
│     ┌─────┴─────┐        │                                       │
│     │           │        │                                       │
│     ▼           ▼        │                                       │
│  Ctrl+L      Ctrl+K      │                                       │
│     │           │        │                                       │
│     │    ┌──────▼──────┐ │                                       │
│     │    │Inline Edit  │ │                                       │
│     │    │Popup        │ │                                       │
│     │    │[Model ▼]    │ │                                       │
│     │    │[Instructions]│ │                                       │
│     │    │[Submit]     │ │                                       │
│     │    └──────┬──────┘ │                                       │
│     │           │        │                                       │
│     ▼           ▼        │                                       │
│  executeCommand  inlineEditRequest                               │
│     │           │        │                                       │
└─────┼───────────┼────────┼───────────────────────────────────────┘
      │           │        │
      ▼           ▼        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Host Services                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ CommandService  │    │ CloudLLMRouterService               │ │
│  │ (Ctrl+L action) │    │ (Routes to Cloud or BYOK)           │ │
│  └────────┬────────┘    └────────────────┬────────────────────┘ │
│           │                              │                       │
│           ▼                              ▼                       │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ SidebarChat     │    │ LLM Provider (Cloud/OpenAI/etc)     │ │
│  │ (adds context)  │    │                                     │ │
│  └─────────────────┘    └────────────────┬────────────────────┘ │
│                                          │                       │
│                                          ▼                       │
│                         ┌─────────────────────────────────────┐ │
│                         │ applyInlineEdit message → Webview   │ │
│                         └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

### Webview (Browser-side JavaScript)

| File | Purpose |
|------|---------|
| `src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewerTiptap.js` | Main webview script. Handles selection tracking, tooltip/popup rendering, keyboard shortcuts, and message passing. |
| `src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewer.css` | Styles for the tooltip and inline edit popup. |

### Host (TypeScript - Editor Pane)

| File | Purpose |
|------|---------|
| `src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/docxViewerEditor.ts` | Editor pane that hosts the webview. Handles messages from webview, sends LLM requests, manages model selection. |
| `src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/docxViewerInput.ts` | Editor input class. Stores selection state (`DOCXSelection`). |
| `src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/docxQuickEditActions.ts` | Registers `Action2` classes for DOCX-specific Ctrl+L and Ctrl+K keybindings. |

### Shared Services

| File | Purpose |
|------|---------|
| `src/vs/workbench/contrib/void/browser/cloudLLMRouterService.ts` | Routes LLM requests through SafeAppeals Cloud or BYOK providers. |
| `src/vs/workbench/contrib/void/browser/sidebarActions.ts` | Contains the generic `ctrlLAction` that handles "Add to Chat" for all editor types. |
| `src/vs/workbench/contrib/void/common/voidSettingsService.ts` | Provides model selection and settings state. |

---

## Feature Details

### Ctrl+L: Add to Chat

**Flow:**

1. User selects text in DOCX editor
2. Webview detects selection via `selectionchange` event
3. Selection tooltip appears with "Add to Chat [Ctrl+L]" button
4. User clicks button or presses `Ctrl+L`
5. Webview posts `executeCommand` message with `void.ctrlLAction`
6. Host executes the command via `ICommandService`
7. `ctrlLAction` in `sidebarActions.ts` checks if active editor is DOCX
8. If DOCX with selection, adds formatted context to chat
9. If no selection, adds entire file content

**Key Code (sidebarActions.ts):**

```typescript
// Check for DOCX viewer
if (activeEditorPane instanceof DOCXViewerEditor) {
    const docxInput = activeEditorPane.getInput();
    if (docxInput?.selection) {
        // Add selected text with context
        const contextText = `From DOCX: ${docxInput.getName()}\n\n${docxInput.selection.text}`;
        chatThreadService.addHumanMessageToCurrentThread(contextText);
    }
}
```

### Ctrl+K: Inline Edit

**Flow:**

1. User selects text in DOCX editor
2. Selection tooltip appears with "Edit Inline [Ctrl+K]" button
3. User clicks button or presses `Ctrl+K`
4. Inline edit popup appears with:
   - Model selector dropdown
   - Preview of selected text
   - Instructions textarea
   - Submit button
5. **Critical:** Editor selection positions (`from`, `to`) are stored immediately
6. User enters instructions and submits
7. Webview posts `inlineEditRequest` message with:
   - `selection`: `{ text, html }`
   - `instructions`: user's edit instructions
   - `modelSelection`: `{ providerName, modelName }` or null
8. Host receives message in `handleInlineEditRequest()`
9. Host calls `cloudLLMRouterService.sendLLMMessage()` which:
   - Routes through SafeAppeals Cloud if connected
   - Falls back to BYOK if no cloud connection
10. LLM returns edited text
11. Host posts `applyInlineEdit` message with `editedText`
12. Webview receives message and:
    - Uses stored selection positions to restore selection
    - Deletes selected text
    - Inserts edited text
13. Document is marked as modified

**Key Code (docxViewerTiptap.js):**

```javascript
// Store selection when popup opens (survives async LLM call)
if (tiptapEditor && tiptapEditor.editor) {
    const { from, to } = tiptapEditor.editor.state.selection;
    pendingInlineEditSelection = { from, to };
}

// Apply edit using stored positions
case 'applyInlineEdit':
    if (pendingInlineEditSelection) {
        const { from, to } = pendingInlineEditSelection;
        tiptapEditor.editor.chain()
            .focus()
            .setTextSelection({ from, to })
            .deleteSelection()
            .insertContent(message.editedText)
            .run();
    }
```

**Key Code (docxViewerEditor.ts):**

```typescript
private async handleInlineEditRequest(
    selection: DOCXSelection,
    instructions: string,
    requestedModelSelection?: { providerName: string; modelName: string } | null
): Promise<void> {
    // Cast to proper type
    const modelSelection: ModelSelection | null = requestedModelSelection
        ? { providerName: requestedModelSelection.providerName as ProviderName, modelName: requestedModelSelection.modelName }
        : this.voidSettingsService.state.modelSelectionOfFeature['Ctrl+K'];

    // Use cloud router (supports both Cloud and BYOK)
    this.cloudLLMRouterService.sendLLMMessage({
        messagesType: 'chatMessages',
        messages: [{ role: 'user', content: userMessage }],
        separateSystemMessage: systemMessage,
        modelSelection,
        // ... callbacks
    });
}
```

---

## Message Protocol

### Webview → Host Messages

| Message Type | Payload | Purpose |
|--------------|---------|---------|
| `textSelected` | `{ selection: { text, html } }` | Notify host of text selection |
| `clearSelection` | none | Notify host selection was cleared |
| `executeCommand` | `{ command: string }` | Execute a VS Code command (e.g., `void.ctrlLAction`) |
| `inlineEditRequest` | `{ selection, instructions, modelSelection }` | Request AI-powered inline edit |

### Host → Webview Messages

| Message Type | Payload | Purpose |
|--------------|---------|---------|
| `updateModels` | `{ models: ModelOption[], defaultIndex: number }` | Send available models for dropdown |
| `inlineEditStarted` | `{ message: string }` | Notify edit is processing |
| `inlineEditProgress` | `{ text: string }` | Stream edit progress (optional) |
| `applyInlineEdit` | `{ editedText: string }` | Apply the edited text |
| `inlineEditError` | `{ message: string }` | Report error to user |

---

## Model Selection

The inline edit popup includes a model dropdown that:

1. **Loads on webview ready**: Host sends `updateModels` message with all available models
2. **Defaults to Ctrl+K setting**: Pre-selects the model configured for Ctrl+K feature
3. **Updates on settings change**: Listens to `voidSettingsService.onDidChangeState`
4. **Supports Cloud and BYOK**: Dropdown shows all enabled providers

**Model Flow:**

```
Settings Service → Available Models → Webview Dropdown → User Selection → LLM Request
```

---

## Styling

### Tooltip Styles (docxViewer.css)

```css
.docx-selection-tooltip {
    position: fixed;
    z-index: 10000;
    display: flex;
    gap: 4px;
    padding: 4px 8px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

### Inline Edit Popup Styles

```css
.docx-inline-edit-popup {
    position: fixed;
    z-index: 10001;
    width: 400px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.inline-edit-model-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--vscode-editorGroupHeader-tabsBackground);
}
```

---

## Maintenance Guide

### Adding New Models

Models are automatically included if they're enabled in settings. No code changes needed.

### Modifying the Popup UI

Edit `docxViewerTiptap.js`:
- HTML structure is in the `inlineEditPopup.innerHTML` template
- Styles are in `docxViewer.css`

### Changing LLM Prompts

Edit `docxViewerEditor.ts`:
- `systemMessage` variable defines the AI's role
- `userMessage` variable structures the edit request

### Adding New Actions to Tooltip

In `docxViewerTiptap.js`:
1. Add new button to `selectionTooltip.innerHTML`
2. Add click handler in `selectionTooltip.addEventListener('click', ...)`
3. Post appropriate message to host

### Debugging

**Enable Logging:**
- Webview logs: `console.log('[DOCX Webview] ...')`
- Host logs: `console.log('[DOCX Viewer] ...')`
- LLM logs: `console.log('[DOCX Inline Edit] ...')`

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| "No selection to apply edit to" | Selection cleared before LLM response | Fixed by storing `pendingInlineEditSelection` |
| "Loading models..." stuck | Settings not initialized | Added `await waitForInitState` |
| "No API key found" | Using BYOK service instead of cloud | Changed to `ICloudLLMRouterService` |

---

## Testing Checklist

- [ ] Select text → Tooltip appears
- [ ] Tooltip positioned correctly (not cut off by chat panel)
- [ ] Ctrl+L adds text to chat with context
- [ ] Ctrl+K opens popup with model dropdown
- [ ] Model dropdown shows available models
- [ ] Model dropdown defaults to Ctrl+K setting
- [ ] Submit with cloud model works
- [ ] Submit with BYOK model works
- [ ] Edit is applied to correct text position
- [ ] Document is marked as modified after edit
- [ ] Escape closes popup
- [ ] Enter submits edit

---

## Related Documentation

- [Chat System Architecture](../chat/architecture.md)
- [LLM Message Flow](../chat/message-flow.md)
- [Cloud Service Configuration](../safeAppealsCloud/README.md)
- [Model System](../modelsSystem/README.md)
