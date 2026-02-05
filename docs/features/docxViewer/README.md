# DOCX Viewer Documentation

The DOCX Viewer is a rich document editor built on Tiptap that provides Word-like editing capabilities within SafeAppealNavigator.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Quick Edit Features (Ctrl+L & Ctrl+K)](./quick-edit-features.md) | Comprehensive guide to the inline edit and add-to-chat features |
| [Floating Images Reference](./floating-images-ref.md) | Implementation notes for floating/positioned images |
| [Perplexity Research](./perplexity-research.md) | Research on DOCX parsing and rendering approaches |
| [Research Notes 2](./perp-research2.md) | Additional research and implementation notes |

## Quick Reference

### Key Features

- **Rich Text Editing** - Full WYSIWYG editing with Tiptap
- **DOCX Import/Export** - Native .docx file support
- **AI Integration** - Ctrl+L (chat) and Ctrl+K (inline edit)
- **MS Word-like UI** - Ribbon toolbar, rulers, page layout

### Primary Files

```
src/vs/workbench/contrib/void/browser/documentViewers/docxViewer/
├── media/
│   ├── docxViewerTiptap.js   # Main webview script
│   ├── docxViewer.css        # Styles
│   ├── docxRibbon.js         # Ribbon toolbar
│   ├── tiptapBundle.js       # Tiptap editor bundle
│   └── tiptapDocxBundle.js   # DOCX conversion bundle
├── docxViewerEditor.ts       # Editor pane (host)
├── docxViewerInput.ts        # Editor input class
├── docxViewerPane.ts         # Pane registration
├── docxQuickEditActions.ts   # Ctrl+L/K actions
└── docxWorkingCopy.ts        # Working copy for dirty state
```

### Related Services

- `cloudLLMRouterService.ts` - Routes LLM requests (Cloud/BYOK)
- `voidSettingsService.ts` - Model selection and settings
- `sidebarActions.ts` - Generic Ctrl+L action

## Development Workflow

1. Make changes to webview files (`.js`, `.css`)
2. Reload window (`Ctrl+Shift+P` → "Reload Window")
3. Changes appear immediately (no build needed for webview)

For TypeScript changes:
1. `bun run watch-clientd` will auto-compile
2. Reload window to see changes
