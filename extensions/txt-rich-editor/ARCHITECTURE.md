# Rich Text Editor Architecture

This document describes the production-ready architecture of the `txt-rich-editor` extension, designed as a miniature desktop publishing system within VS Code.

## Overview

The extension is built with clear boundaries between different concerns:

- **Extension Host Logic**: Command management, document conversion, AI services
- **Webview UI**: Rich text editing, page layout, visual feedback
- **Document Conversion**: Bidirectional DOCX ↔ HTML with image support
- **Page Layout Rendering**: Professional margins, rulers, zoom, page breaks

## Core Components

### 1. Command System (`src/commands/commandManager.ts`)

The **CommandManager** serves as the single source of truth for all user-visible actions. It provides:

- Unified command registry for ribbon, command palette, keybindings, and context menus
- Type-safe command definitions with metadata (icons, enablement conditions)
- Centralized command execution with logging and error handling

```typescript
interface CommandInfo {
  id: string;
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
  handler: (...args: any[]) => any;
}
```

### 2. Document Conversion (`src/conversion.ts`, `src/docxXmlHandler.ts`)

Bidirectional DOCX ↔ HTML conversion with:

- **Native XML Path**: Fast, lossless conversion using direct XML manipulation
- **Library Fallback**: Automatic fallback to `mammoth` and `html-to-docx` when XML parsing fails
- **Image Support**: Extracts and embeds images during conversion
- **Style Preservation**: Maintains formatting, headings, lists, tables, and inline styles

### 3. Typed Webview Messaging (`src/webview/messageHandler.ts`)

Request/response semantics with type safety:

```typescript
interface CommandMessage extends BaseMessage {
  type: 'execute-command';
  data: { command: string; args?: any[] };
}

async postWithResponse<T>(message: CommandMessage, timeout = 5000): Promise<T>
```

### 4. High-Performance Editor (`src/webview/editor.ts`)

Optimized `contentEditable` implementation:

- **Debounced Input**: 150ms debouncing to reduce IPC chatter
- **Undo/Redo Stacks**: Capped at 50 frames for O(1) memory usage
- **Clean Paste Handling**: Strips dangerous HTML before insertion
- **Keyboard Shortcuts**: Word-like behavior (Shift+Enter = `<br>`, Enter = `<div>`)

### 5. Decoration Manager (`src/editor/decorationManager.ts`)

60fps syntax highlighting and styling:

- **Batched Decorations**: Groups ranges by style, calls `setDecorations` once per style
- **Debounced Parsing**: 100ms debounce on document changes
- **Priority-based Rules**: Syntax highlighting with configurable priorities
- **Memory Management**: Proper disposal to prevent leaks

### 6. Page Layout System (`src/marginController.ts`, `src/webview/pageLayoutManager.js`)

Professional page layout with:

- **Margin Control**: Draggable margins with locking capability
- **Page Sizes**: Letter, A4, Legal, Tabloid (portrait/landscape)
- **Zoom Support**: 0.25× to 3× with CSS transforms
- **Ruler System**: Inch-based rulers with major/minor marks
- **Page Breaks**: Visual page break indicators

### 7. AI & Spell-Check Hooks (`src/ai/aiDispatcher.ts`)

Extensible AI and spell-check system:

- **Provider Architecture**: Pluggable AI and spell-check providers
- **Request/Response**: Typed interfaces for AI operations
- **Fallback Support**: Default providers for basic functionality
- **Extensibility**: Easy integration with external AI services

## Data Flow

```
User Action → Command System → Webview Message → Editor Action → Content Change → Extension Sync
     ↓
Command Palette / Ribbon / Context Menu / Keybinding
     ↓
Single Command Handler → Document Update → Layout Reflow → Visual Feedback
```

## Performance Optimizations

### 60fps Scrolling

- Batched decoration updates
- Debounced content parsing
- Canvas-based rulers and margins
- Virtual scrolling for large documents

### Memory Management

- Capped undo/redo stacks
- Proper disposal of decorations and event listeners
- Efficient image handling in DOCX conversion
- Debounced message handling

### Accessibility

- `role="textbox"` and `aria-multiline="true"` on editor root
- High-contrast theme support
- Keyboard navigation
- Screen reader compatibility

## File Structure

```
src/
├── commands/
│   └── commandManager.ts          # Single source of truth for commands
├── webview/
│   ├── messageHandler.ts          # Typed messaging system
│   ├── editor.ts                  # High-performance contentEditable
│   └── pageLayoutManager.js       # Canvas-based layout system
├── editor/
│   └── decorationManager.ts       # 60fps syntax highlighting
├── ai/
│   └── aiDispatcher.ts            # AI and spell-check hooks
├── docxXmlHandler.ts              # Native DOCX XML processing
├── marginController.ts            # Page layout management
├── conversion.ts                  # Document conversion with fallbacks
└── extension.ts                   # Main extension entry point
```

## Dependencies

### Core Dependencies

- `@xmldom/xmldom`: Native XML processing for DOCX
- `jszip`: DOCX file handling
- `mammoth`: DOCX to HTML conversion (fallback)
- `html-to-docx`: HTML to DOCX conversion (fallback)

### Optional Dependencies

- `puppeteer`: PDF export functionality
- `yjs`: Future real-time collaboration support

## Integration Points

### VS Code Integration

- Custom editor providers for `.txt`, `.gdoc`, `.docx` files
- Command palette integration
- Context menu support
- Keybinding system
- Status bar integration

### Void Integration

- Ctrl+L: Add selection to Void chat
- Ctrl+K: Void inline edit
- Webview bridge for web environments

## Testing Strategy

### Unit Tests

- DOCX XML round-trip testing with Jest snapshots
- Command system validation
- Message handler type safety
- Conversion accuracy testing

### Integration Tests

- End-to-end document conversion
- Webview messaging reliability
- Performance benchmarks
- Accessibility compliance

## Future Enhancements

### Real-time Collaboration

- Yjs CRDT integration
- Conflict resolution
- Presence indicators
- Version history

### Advanced Features

- Table editing
- Image manipulation
- Advanced typography
- Custom styles
- Templates

### Performance Improvements

- Web Workers for heavy processing
- Virtual scrolling for large documents
- Incremental parsing
- Caching strategies

## Deployment

### Pre-release Process

1. Unit test coverage > 80%
2. Performance benchmarks
3. Accessibility audit
4. Security review
5. OpenVSX publication

### Telemetry

- Opt-in usage analytics
- Performance metrics
- Error reporting
- Feature adoption tracking

## Conclusion

This architecture provides a solid foundation for a production-ready rich text editor that rivals desktop word processors while maintaining the flexibility and extensibility of VS Code. The clear separation of concerns, typed interfaces, and performance optimizations ensure a smooth user experience and maintainable codebase.
