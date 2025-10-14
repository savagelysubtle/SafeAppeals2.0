# Quick Compile Commands

## Fix and Compile

```bash
# Full extension compile
node ./node_modules/gulp/bin/gulp.js compile-extensions

# TypeScript only (faster)
npx tsc --skipLibCheck --project extensions/txt-rich-editor/tsconfig.json

# VS Code core (for Void API changes)
cd src && npx tsc --skipLibCheck
```

## After Compilation

1. **Reload Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Open file**: Right-click `.txt` → "Open With..." → "Rich Text Editor"
3. **Test integration**: Select text → `Ctrl+L`

## Common Errors

### "Property 'X' does not exist"
- Check if constructor accepts the parameter
- Add missing import or property declaration

### "Cannot find module"
- Run `npm install` in extension folder
- Check import paths

### "Command not found"
- Check `package.json` commands section
- Verify command is registered in `extension.ts`

## Success
```
Finished compilation extensions with 0 errors
```

Now reload VS Code and test!
