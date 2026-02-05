---
name: DOCX Ctrl+L/K Integration
overview: Fix the DOCX viewer's Ctrl+L (add to chat) and Ctrl+K (quick edit) functionality by adding selection tracking to the webview, creating DOCX-specific keybinding actions, and implementing a tooltip widget inside the webview.
todos:
  - id: selection-tracking
    content: Add selectionchange event listener to docxViewerTiptap.js to track text selection and send to host
    status: pending
  - id: tooltip-ui
    content: Create selection tooltip HTML/CSS in the webview that shows Ctrl+L and Ctrl+K options
    status: pending
  - id: docx-actions
    content: Create docxQuickEditActions.ts with DOCXQuickEditAction and DOCXAddToChatAction classes
    status: pending
  - id: update-ctrl-l
    content: Modify sidebarActions.ts to use docxInput.selection when adding DOCX to chat
    status: pending
  - id: handle-command
    content: Add executeCommand message handler in docxViewerEditor.ts
    status: pending
  - id: register-actions
    content: Import docxQuickEditActions.js in void.contribution.ts
    status: pending
isProject: false
---

# DOCX Viewer Ctrl+L and Ctrl+K Integration

## Problem Analysis

Three core issues prevent Ctrl+L and Ctrl+K from working in the DOCX viewer:

1. **No selection tracking in the Tiptap webview** - The active script `docxViewerTiptap.js` lacks the `selectionchange` event listener (present only in unused legacy `docxViewer.js`)
2. **Ctrl+L ignores DOCX selection** - The action in `sidebarActions.ts` (lines 247-278) adds the whole file without using the stored `docxInput.selection`
3. **No Ctrl+K action for DOCX** - Only registered for `ICodeEditor` (code files), no equivalent exists for document viewers
4. **Selection helper widget is code-editor only** - `voidSelectionHelperWidget.ts` line 130 filters for `file://` scheme, excluding webviews

## Architecture Decision

The PDF viewer handles this by creating **separate action classes** (`pdfQuickEditActions.ts`) that register their own Ctrl+L/K bindings with a check for the active editor type. We'll follow the same pattern for DOCX.

For the tooltip, since the webview cannot use `IOverlayWidget` (which requires `ICodeEditor`), we'll implement it **inside the webview** using Tiptap's selection events. The webview will render the tooltip and send messages to the host when clicked.

## Implementation Plan

### 1. Add Selection Tracking to Webview

**File**: [`src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewerTiptap.js`](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewerTiptap.js)

Add after line 413 (after the link click interceptor):

```javascript
// Selection tracking for Ctrl+L and Ctrl+K
let selectionDebounceTimer = null;
document.addEventListener('selectionchange', () => {
    if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = setTimeout(() => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            const selectedText = selection.toString().trim();
            if (selectedText.length >= 3) {
                const range = selection.getRangeAt(0);
                const clonedSelection = range.cloneContents();
                const div = document.createElement('div');
                div.appendChild(clonedSelection);
                vscode.postMessage({
                    type: 'textSelected',
                    selection: { text: selectedText, html: div.innerHTML }
                });
            }
        } else {
            vscode.postMessage({ type: 'clearSelection' });
        }
    }, 100);
});
```

### 2. Create DOCX Quick Edit Actions

**New File**: `src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/docxQuickEditActions.ts`

Create similar to [`pdfQuickEditActions.ts`](src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/pdfQuickEditActions.ts):

```typescript
// Key structure:
class DOCXQuickEditAction extends Action2 {
    // Ctrl+K - requires selection, adds to chat with context
    async run(accessor: ServicesAccessor) {
        const activeEditor = editorService.activeEditorPane;
        if (!(activeEditor instanceof DOCXViewerEditor)) return;

        const input = activeEditor.getInput();
        if (!input?.selection?.text) {
            notificationService.info('Please select text in the DOCX first');
            return;
        }
        // Add selection to chat staging with context
    }
}

class DOCXAddToChatAction extends Action2 {
    // Ctrl+L - uses selection if available, otherwise adds file
    async run(accessor: ServicesAccessor) {
        // Similar logic to PDF version
    }
}
```

### 3. Update Ctrl+L to Use DOCX Selection

**File**: [`src/vs/workbench/contrib/void/browser/sidebarActions.ts`](src/vs/workbench/contrib/void/browser/sidebarActions.ts)

Modify lines 247-278 to use the selection:

```typescript
if (activePane?.input instanceof DOCXViewerInput) {
    const docxInput = activePane.input as DOCXViewerInput;

    // Use selection if available
    if (docxInput.selection?.text) {
        chatThreadService.addNewStagingSelection({
            type: 'TextSelection', // New type for document text
            uri: docxInput.resource,
            language: 'docx',
            content: docxInput.selection.text,
            state: { wasAddedAsCurrentFile: false }
        });
    } else {
        // Fallback to adding the whole file
        chatThreadService.addNewStagingSelection({
            type: 'File',
            uri: docxInput.resource,
            language: 'docx',
            state: { wasAddedAsCurrentFile: false }
        });
    }
}
```

### 4. Add Selection Tooltip to Webview

**File**: [`src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewerTiptap.js`](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewerTiptap.js)

Add a floating tooltip element that appears on selection:

```javascript
// Create tooltip element
const selectionTooltip = document.createElement('div');
selectionTooltip.className = 'docx-selection-tooltip';
selectionTooltip.innerHTML = `
    <button data-action="addToChat">Add to Chat <kbd>Ctrl+L</kbd></button>
    <button data-action="editInline">Edit Inline <kbd>Ctrl+K</kbd></button>
`;
selectionTooltip.style.display = 'none';
document.body.appendChild(selectionTooltip);

// Position and show on selection
function updateTooltipPosition(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionTooltip.style.left = `${rect.right + 10}px`;
    selectionTooltip.style.top = `${rect.top}px`;
    selectionTooltip.style.display = 'flex';
}

// Handle tooltip button clicks
selectionTooltip.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'addToChat') {
        vscode.postMessage({ type: 'executeCommand', command: 'void.ctrlLAction' });
    } else if (action === 'editInline') {
        vscode.postMessage({ type: 'executeCommand', command: 'void.ctrlKAction' });
    }
    selectionTooltip.style.display = 'none';
});
```

**File**: [`src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewer.css`](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/media/docxViewer.css)

Add tooltip styles:

```css
.docx-selection-tooltip {
    position: fixed;
    z-index: 10000;
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.docx-selection-tooltip button {
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--vscode-foreground);
}

.docx-selection-tooltip button:hover {
    background: var(--vscode-list-hoverBackground);
}

.docx-selection-tooltip kbd {
    margin-left: 4px;
    padding: 1px 4px;
    background: var(--vscode-keybindingLabel-background);
    border: 1px solid var(--vscode-keybindingLabel-border);
    border-radius: 3px;
    font-size: 0.85em;
}
```

### 5. Handle Command Execution from Webview

**File**: [`src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/docxViewerEditor.ts`](src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/docxViewerEditor.ts)

Add to `handleWebviewMessage`:

```typescript
case 'executeCommand':
    const commandService = this.accessor.get(ICommandService);
    commandService.executeCommand(data.command);
    break;
```

### 6. Register the New Actions

**File**: [`src/vs/workbench/contrib/void/browser/void.contribution.ts`](src/vs/workbench/contrib/void/browser/void.contribution.ts)

Add import:

```typescript
import './documentViewers/docxViewer/docxQuickEditActions.js';
```

## Files to Modify

| File | Change |

|------|--------|

| `media/docxViewerTiptap.js` | Add selection tracking + tooltip UI |

| `media/docxViewer.css` | Add tooltip styles |

| `docxViewerEditor.ts` | Handle `executeCommand` message |

| `sidebarActions.ts` | Use DOCX selection in Ctrl+L |

| **NEW** `docxQuickEditActions.ts` | DOCX-specific Ctrl+L/K actions |

| `void.contribution.ts` | Import new actions file |

## Testing

1. Open a DOCX file in the editor
2. Select some text - tooltip should appear
3. Press Ctrl+L - selected text should be added to chat
4. Press Ctrl+K - quick edit panel should open with selection context
5. Click tooltip buttons - same behavior as keyboard shortcuts