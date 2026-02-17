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
# TypeScript only (fastest - for quick type checking)
cd src && bunx tsc --skipLibCheck

# Full compilation (uses --max-old-space-size=8192)
bun run compile

# Compile with mangling (production)
bun run compile-build

# Compile without mangling (CI/faster)
bun run compile-build-ci
```

### XLSX Rust Viewer (WASM)

```bash
# Compile Rust crate → WASM (via wasm-pack, outputs to media/wasm/)
bun run build-wasm
# Equivalent to: cd .../xlsxRustViewer/wasm && wasm-pack build --target web --out-dir ../media/wasm --no-typescript

# Bundle webview TypeScript → single IIFE JS (via esbuild)
bun run build-xlsx-viewer
# Equivalent to: node .../xlsxRustViewer/media/build.mjs

# Full rebuild (both steps)
bun run build-wasm && bun run build-xlsx-viewer
```

> **📝 Note**: Requires `wasm-pack` (`cargo install wasm-pack`) and the `wasm32-unknown-unknown` Rust target.

### Extensions

```bash
# Compile extensions build (recommended - includes Node.js flags)
bun run compile-extensions-build

# Run any gulp command with proper flags
bun run gulp compile-extensions
```

> ⚠️ **Note**: Always use `bun run gulp <task>` instead of raw `node ./node_modules/gulp/bin/gulp.js`
> The package.json scripts include `--max-old-space-size=8192 --disable-warning=DEP0180` which are essential for stability.

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
# Quick type check (no build)
cd src && bunx tsc --skipLibCheck

# Full compile with proper memory allocation
bun run compile
```

## ✅ Success Indicators

```
Finished compilation extensions with 0 errors
✅ Build complete!
```

## 📋 Quick Reference

### Most Used Commands

```bash
bun run buildreact         # Build React components
bun run compile            # Compile VS Code
bun run watchd             # Watch mode (background)
bun run build-wasm         # Compile Rust XLSX viewer to WASM
bun run build-xlsx-viewer  # Bundle XLSX Rust Viewer webview JS
```

### Emergency Commands

```bash
bun run kill-watchd   # Kill all watch processes
bun run restart-watchd # Restart watch processes
```

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
