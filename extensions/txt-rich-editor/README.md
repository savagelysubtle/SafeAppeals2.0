# Rich Text Editor for Documents

A Microsoft Office-style ribbon interface rich text editor for .txt, .gdoc, and .docx files in VS Code.

## Features

### Ribbon Interface

- **Home Tab** with organized groups:
  - **Clipboard**: Undo/Redo
  - **Font**: Bold, Italic, Underline, Strikethrough, Font Size
  - **Paragraph**: Alignment (Left, Center, Right), Indentation
  - **Lists**: Bulleted and Numbered lists
  - **Styles**: Heading levels (H1, H2, H3), Blockquotes
  - **File**: Import/Export DOCX (desktop only)

### Document Support

- **.txt files**: Visual formatting, saves as plain text
- **.gdoc files**: Google Docs-style formatting, saves as plain text
- **.docx files**: Full DOCX import/export with formatting preservation

### DOCX Import/Export

- Import existing DOCX files with formatting
- Export rich content to DOCX format
- Available on desktop environments only (not web)

## Usage

### Opening Files

1. Right-click any `.txt`, `.gdoc`, or `.docx` file
2. Select "Open with Rich Text Editor"
3. Or use "Reopen with..." → "Rich Text Editor"

### Ribbon Controls

- **Formatting**: Select text and click formatting buttons
- **Headings**: Use the Styles dropdown to change heading levels
- **Lists**: Click bullet or number buttons to create lists
- **Alignment**: Use alignment buttons for text positioning
- **Font Size**: Select from the font size dropdown

### DOCX Operations

- **Import**: Click the Import button (📁) to load a DOCX file
- **Export**: Click the Export button (💾) to save as DOCX
- **Save**: Regular save preserves plain text content

### Keyboard Shortcuts

- `Ctrl+B`: Bold
- `Ctrl+I`: Italic
- `Ctrl+U`: Underline
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo

## Technical Details

### Storage Model

- **Visual formatting**: Displayed in editor but not persisted to file
- **Plain text**: All files save as plain text by default
- **DOCX export**: Creates separate DOCX files with formatting

### Platform Support

- **Desktop**: Full functionality including DOCX import/export
- **Web**: Visual editing only, DOCX features disabled

### Dependencies

- `mammoth`: DOCX to HTML conversion
- `html-to-docx`: HTML to DOCX conversion

## File Types

### .txt Files

- Basic rich text editing
- Visual formatting only
- Saves as plain text

### .gdoc Files

- Google Docs-style interface
- Visual formatting only
- Saves as plain text

### .docx Files

- Full DOCX support
- Import with formatting preservation
- Export with formatting
- Visual editing with DOCX compatibility

## Error Handling

- **Missing dependencies**: Graceful fallback to plain text
- **Conversion errors**: User notifications with details
- **Web environment**: DOCX features automatically disabled
- **File access**: Clear error messages for permission issues

## Development

### Building

```bash
npm run compile
```

### Watching

```bash
npm run watch
```

### Testing

1. Open test files in `TestFolder/`
2. Use "Reopen with Rich Text Editor"
3. Test formatting and DOCX operations
4. Verify plain text saving

## License

MIT License - See LICENSE file for details
