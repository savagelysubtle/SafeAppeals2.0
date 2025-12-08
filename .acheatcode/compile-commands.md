# Quick Compile Commands

> **📚 For complete documentation, see [complete-cheatsheet.md](./complete-cheatsheet.md)**

## 🚀 Essential Compile Commands

### React Components (Void Features)

```bash
# Build React components
bun run buildreact

# Watch React components
bun run watchreact
```

### VS Code Core

```bash
# TypeScript only (fastest)
cd src && npx tsc --skipLibCheck

# Full compilation
bun run compile

# Compile with mangling (production)
bun run compile-build
```

### Extensions

```bash
# Compile all extensions
node ./node_modules/gulp/bin/gulp.js compile-extensions

# Compile extensions build
bun run compile-extensions-build
```

## 🔄 Watch Mode

```bash
# Watch everything (background)
bun run watchd

# Kill watch processes
bun run kill-watchd

# Restart watch processes
bun run restart-watchd
```

## 🧪 After Compilation

1. **Reload Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Test features**: Use Void features in VS Code
3. **Check console**: Look for any errors

## 🐛 Common Errors & Solutions

### "Cannot find module './react/out/...'"

```bash
bun run buildreact
```

### "Property 'X' does not exist"

- Check if constructor accepts the parameter
- Add missing import or property declaration

### "Cannot find module"

- Run `bun install` in extension folder
- Check import paths

### "Command not found"

- Check `package.json` commands section
- Verify command is registered in extension files

### TypeScript compilation errors

```bash
cd src && bunx tsc --skipLibCheck
```

## ✅ Success Indicators

```
Finished compilation extensions with 0 errors
✅ Build complete!
```

## 📋 Quick Reference

### Most Used Commands

```bash
bun run buildreact    # Build React components
bun run compile       # Compile VS Code
bun run watchd        # Watch mode (background)
```

### Emergency Commands

```bash
bun run kill-watchd   # Kill all watch processes
bun run restart-watchd # Restart watch processes
```

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
