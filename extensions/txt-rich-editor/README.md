# Rich Text Editor for Documents

A professional Microsoft Office-style rich text editor for VS Code with advanced document editing capabilities for `.txt`, `.gdoc`, and `.docx` files.

## Features

### 🎨 Advanced Ribbon Interface

#### Home Tab

All essential formatting tools organized into groups:

- **Clipboard**: Undo, Redo
- **Font**: Bold, Italic, Underline, Strikethrough, Font family, Font size
- **Paragraph**: Alignment (Left, Center, Right, Justify), Indentation
- **Lists**: Bulleted and numbered lists
- **Styles**: Heading levels (H1, H2, H3), Blockquotes
- **File**: Import/Export DOCX (desktop only)

#### Insert Tab 🆕

Add rich content to your documents:

- **Tables**: Insert custom tables or quick 3x3 tables
- **Illustrations**: Images, shapes, and charts
- **Links**: Hyperlinks and bookmarks
- **Text Elements**: Text boxes, dates, symbols (©, ®, ™, etc.)
- **Signatures**: Digital signature lines

#### Page Layout Tab 🆕

Control your document's appearance:

- **Page Setup**: Paper size (Letter, A4, Legal, Tabloid), orientation, margins
- **Columns**: One, two, or three column layouts
- **Page Background**: Background colors, borders, watermarks
- **Line Numbers**: Toggle line number display

#### View Tab 🆕

Customize your editing view:

- **Zoom**: Zoom in/out with presets (50%-200%)
- **Show/Hide**: Toggle rulers, gridlines, paragraph marks
- **View Modes**: Print layout, web layout, focus mode
- **Window**: Split view and full-screen options

#### Format Tab 🆕

Advanced text formatting:

- **Text Effects**: Shadows, outlines, glows
- **Color Tools**: Text color, highlight, background color
- **Spacing**: Line spacing (1.0-3.0), paragraph spacing
- **Case Conversion**: UPPERCASE, lowercase, Capitalize
- **Clear Formatting**: Remove all formatting at once

### 📏 Canvas-Based Professional Rendering

- **Top Ruler**: Shows character positions for precise alignment
- **Left Margin**: Line numbers with smooth scrolling
- **Draggable Margins**: Adjust text boundaries by dragging handles on the ruler
- **Centered Layout**: Document-style centered editor
- **Smooth Performance**: Optimized canvas rendering

### 📄 Multi-Format Support

- **`.txt` files**: Default editor with rich text capabilities
- **`.gdoc` files**: Google Docs-style formatting
- **`.docx` files**: Full DOCX import/export (desktop only)

### 💾 DOCX Import/Export

- **Native DOCX XML Parser**: Direct handling of DOCX XML structure
- **Better Format Preservation**: Maintains more formatting than traditional converters
- **Unified Interface**: DOCX files get the same beautiful ribbon UI as TXT files! 🎉
- Import existing DOCX files with formatting preservation
- Export rich content to DOCX format
- Bidirectional HTML ↔ DOCX XML conversion
- Available on desktop environments only (not web)

See [DOCX_XML_SUPPORT.md](./DOCX_XML_SUPPORT.md) for technical details and [UNIFIED_INTERFACE.md](./UNIFIED_INTERFACE.md) for the unified editor experience.

## Usage

### Opening Files

1. **Automatic**: `.txt`, `.gdoc`, and `.docx` files open automatically
2. **Manual**: Right-click → "Open with Rich Text Editor"
3. **From Explorer**: Use context menu on any text file

### Formatting Text

- **Select text** and use ribbon buttons
- **Keyboard shortcuts** for quick formatting:
  - `Ctrl+B`: Bold
  - `Ctrl+I`: Italic
  - `Ctrl+U`: Underline
  - `Ctrl+Z`: Undo
  - `Ctrl+Y`: Redo

### Working with Tables

1. Click **Insert** tab
2. Click "Quick Table" for instant 3x3 table
3. Click in cells to edit content
4. Tables are fully style-able

### Page Layout

1. Click **Page Layout** tab
2. Select paper size from dropdown
3. Choose column layout (1, 2, or 3 columns)
4. Set page background color

### View Options

1. Click **View** tab
2. Adjust zoom (50%-200%)
3. Toggle rulers and gridlines
4. Enter focus mode for distraction-free writing

### Advanced Formatting

1. Click **Format** tab
2. Apply text colors and effects
3. Adjust line spacing
4. Convert text case
5. Clear all formatting when needed

## Feature Highlights

### Smart Document Editing 🚀

- **Tables**: Create and edit tables directly
- **Multiple Columns**: 1, 2, or 3 column layouts
- **Zoom Control**: 50% to 200% scaling
- **Focus Mode**: Hide ribbon for distraction-free writing
- **Text Effects**: Shadows, outlines, glows

### Professional Tools 🎯

- **Date/Time**: Insert current date and time
- **Symbols**: Quick access to ©, ®, ™, and more
- **Case Conversion**: UPPERCASE, lowercase, Capitalize
- **Color Tools**: Text, highlight, and background colors
- **Line Spacing**: Precise control (1.0 to 3.0)

### Canvas Rendering 🎨

- **Character Ruler**: See exact column positions
- **Line Numbers**: Auto-scrolling line count
- **Draggable Margins**: Visual margin adjustment
- **Smooth Scrolling**: Optimized for large documents

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## Technical Details

### Storage Model

- **Visual formatting**: Displayed in editor but not persisted to file
- **Plain text**: All files save as plain text by default
- **DOCX export**: Creates separate DOCX files with formatting

### Platform Support

- **Desktop**: Full functionality including DOCX import/export
- **Web**: Visual editing only, DOCX features disabled

### Architecture

- Built using VS Code's Custom Text Editor API
- HTML Canvas API for text rendering
- **Native DOCX XML Handler** for bidirectional conversion (primary)
- `mammoth` library for DOCX to HTML conversion (fallback)
- `html-to-docx` library for HTML to DOCX conversion (fallback)
- `jszip` for DOCX archive handling
- Webview-based UI with contenteditable
- Optimized rendering with requestAnimationFrame

## Limitations

- Formatting is visual only - files save as plain text
- DOCX import/export requires desktop version
- Some advanced Word features may not be preserved
- Complex shapes and charts are placeholders

## Void AI Integration 🤖

The Rich Text Editor now includes full integration with Void's AI agent capabilities!

### Features

- **Ctrl+L (Cmd+L)**: Add selection to Void chat
  - Strips formatting and sends plain text
  - Works with selections or entire document
  - Opens Void sidebar automatically

- **Ctrl+K (Cmd+K)**: AI-powered inline editing
  - Preserves rich text formatting
  - Edit specific sections with AI assistance
  - Formatting outside edit range remains intact

### Implementation

- **Desktop**: Uses Monaco editor with HTML state management
- **Web**: Uses webview with message-based Void bridge
- **Format Handling**: Plain text for chat, HTML-aware for edits

See [VOID_INTEGRATION.md](./VOID_INTEGRATION.md) for detailed documentation.

## Roadmap

Future enhancements:

- Full image insertion and manipulation
- Custom shapes and drawing tools
- Advanced chart creation
- Track changes and comments
- Spell check and grammar
- Custom templates
- More table formatting options
- Cell merging and splitting
- Enhanced HTML diff algorithm for better format preservation
- Richer Monaco decorations for HTML styling

## Error Handling & Debugging

### Built-in Logging System

The extension includes a comprehensive logging system similar to Git extension:

- **View Logs**: Run command "Show Rich Text Editor Logs" from Command Palette
- **Output Panel**: View > Output, select "Rich Text Editor"
- **Log Levels**: Error, Warning, Info, Trace
- **Logged Events**: File operations, DOCX conversions, errors with stack traces

**Common Issues:**

- **DOCX won't open**: Check logs for "Can't find end of central directory" - file may not be valid DOCX
- **Export fails**: Verify write permissions in target directory
- **Extension not loading**: Check activation logs for errors

See [LOGGING.md](./LOGGING.md) for complete documentation.

### Error Handling

- **Missing dependencies**: Graceful fallback
- **Conversion errors**: User notifications with detailed logs
- **Web environment**: DOCX features auto-disabled
- **File access**: Clear error messages with stack traces in logs

## Development

### Building

```bash
npm run compile
```

### Watching

```bash
npm run watch
```

## Contributing

This extension is part of the Void editor project. See the main repository for contribution guidelines.

## License

MIT License - See LICENSE file for details
