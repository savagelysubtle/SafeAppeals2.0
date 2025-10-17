# Quick Compile Commands

> **📚 For complete documentation, see [complete-cheatsheet.md](./complete-cheatsheet.md)**

## 🚀 Essential Compile Commands

### React Components (Void Features)

```bash
# Build React components
npm run buildreact

# Watch React components
npm run watchreact
```

### VS Code Core

```bash
# TypeScript only (fastest)
cd src && npx tsc --skipLibCheck

# Full compilation
npm run compile

# Compile with mangling (production)
npm run compile-build
```

### Extensions

```bash
# Compile all extensions
node ./node_modules/gulp/bin/gulp.js compile-extensions

# Compile extensions build
npm run compile-extensions-build
```

## 🔄 Watch Mode

```bash
# Watch everything (background)
npm run watchd

# Kill watch processes
npm run kill-watchd

# Restart watch processes
npm run restart-watchd
```

## 🧪 After Compilation

1. **Reload Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Test features**: Use Void features in VS Code
3. **Check console**: Look for any errors

## 🐛 Common Errors & Solutions

### "Cannot find module './react/out/...'"

```bash
npm run buildreact
```

### "Property 'X' does not exist"

- Check if constructor accepts the parameter
- Add missing import or property declaration

### "Cannot find module"

- Run `npm install` in extension folder
- Check import paths

### "Command not found"

- Check `package.json` commands section
- Verify command is registered in extension files

### TypeScript compilation errors

```bash
cd src && npx tsc --skipLibCheck
```

## ✅ Success Indicators

```
Finished compilation extensions with 0 errors
✅ Build complete!
```

## 📋 Quick Reference

### Most Used Commands

```bash
npm run buildreact    # Build React components
npm run compile       # Compile VS Code
npm run watchd        # Watch mode (background)
```

### Emergency Commands

```bash
npm run kill-watchd   # Kill all watch processes
npm run restart-watchd # Restart watch processes
```

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
