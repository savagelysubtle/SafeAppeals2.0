# Rich Text Editor Logging

The Rich Text Editor extension includes comprehensive logging similar to the Git extension, helping you diagnose issues with file operations, DOCX conversions, and Void integration.

## Viewing Logs

### Method 1: Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: **"Show Rich Text Editor Logs"**
3. Press Enter

### Method 2: Output Panel

1. Open the **Output** panel: `View > Output` or `Ctrl+Shift+U`
2. In the dropdown at the top-right of the Output panel, select **"Rich Text Editor"**

## Log Levels

The logger uses VS Code's built-in log levels:

- **Error**: Critical failures (file operations, DOCX conversion errors)
- **Warn**: Non-critical issues or fallback scenarios
- **Info**: Important events (file opens, exports, imports, activation)
- **Trace**: Detailed debugging information (file sizes, buffer lengths, HTML lengths)

## What Gets Logged

### Activation Events

```
[2024-10-13 16:27:10] Rich Text Editor extension activating...
[2024-10-13 16:27:10] Environment: Desktop
[2024-10-13 16:27:10] Initializing Monaco-based rich text editor for desktop...
[2024-10-13 16:27:10] Rich Text Editor extension activated successfully
```

### File Operations

```
[INFO] Opening file: D:\Documents\test.txt
[TRACE] File size: 1234 characters
[TRACE] Loading txt file as plain text
```

### DOCX Conversion

```
[INFO] Attempting to load DOCX file...
[TRACE] DOCX file loaded: 15234 bytes
[INFO] DOCX successfully converted to HTML
[TRACE] HTML length: 4567 characters
```

### Export/Import Operations

```
[INFO] Starting DOCX export...
[TRACE] Generated DOCX buffer: 12345 bytes
[INFO] Document exported successfully to: D:\Documents\output.docx
```

### Errors

```
[ERROR] Failed to load DOCX content: Error: Can't find end of central directory : is this a zip file ?
[ERROR] Export DOCX: No document available
[ERROR] Failed to import DOCX: ENOENT: no such file or directory
```

## Common Error Messages

### "Can't find end of central directory"

**Cause**: The file with a `.docx` extension is not a valid DOCX file (DOCX files are ZIP archives)
**Solution**: The editor automatically falls back to plain text mode

### "No document available for export"

**Cause**: Trying to export when no document is currently open
**Solution**: Open a document first, then try exporting

### "Failed to convert DOCX to HTML"

**Cause**: Corrupted or invalid DOCX file
**Solution**: Try opening the file in Microsoft Word to verify it's valid, or use Import DOCX to convert it

## Debugging Tips

1. **Enable Trace Logging**: For detailed debugging, the logger automatically includes trace-level logs when VS Code's log level is set to "Trace"

2. **Check File Operations**: When files won't open:
   - Look for `[INFO] Opening file:` to confirm the file path
   - Check `[TRACE] File size:` to ensure the file has content
   - Look for any `[ERROR]` messages with stack traces

3. **DOCX Conversion Issues**: When DOCX files won't load:
   - Verify `[TRACE] DOCX file loaded:` shows a reasonable byte count
   - Check for `[ERROR] Failed to load DOCX content` and read the error message
   - Real DOCX files should be thousands of bytes; fake ones will be much smaller

4. **Export Problems**: When exports fail:
   - Look for `[INFO] Starting DOCX export...`
   - Check if there's an error or a cancellation message
   - Verify the target directory has write permissions

## Log Persistence

Logs are stored in VS Code's output channel system and persist during your session. They are cleared when you:

- Close VS Code
- Reload the window (`Developer: Reload Window`)
- Clear the output panel manually (trash icon)

## Performance Impact

Logging has minimal performance impact:

- **Info/Warn/Error**: Negligible overhead
- **Trace**: Slightly higher but still minimal

The logger is optimized for production use and won't slow down your editing experience.

## Contributing

When reporting issues, always include relevant log output:

1. Open the Rich Text Editor logs
2. Reproduce the issue
3. Copy the relevant log entries
4. Include them in your bug report

Example:

```
[ERROR] Failed to export DOCX: TypeError: Cannot read property 'length' of undefined
    at RichTextEditorProvider.handleExportDocx (extension.ts:185)
    at ...
```
