# Quick Reference Cheatsheet

> **📚 For complete documentation, see [complete-cheatsheet.md](./complete-cheatsheet.md)**

## 🚀 Essential Commands

### Complete Build (Production Windows)

```bash
# Using bun (faster) ⚡
bun buildreact && bun compile-build-ci && bun gulp bundle-vscode && bun gulp vscode-win32-x64-ci && bun gulp vscode-win32-x64-inno-updater && bun gulp vscode-win32-x64-user-setup

# Using npm (legacy)
npm run buildreact && npm run compile-build-ci && npm run gulp bundle-vscode && npm run gulp vscode-win32-x64-ci && npm run gulp vscode-win32-x64-inno-updater && npm run gulp vscode-win32-x64-user-setup
```

### Development Workflow

```bash
# 1. Build React components (Void features)
bun buildreact

# 2. Compile VS Code core
bun compile

# 3. Launch VS Code
./scripts/code.sh
```

### Quick Builds

```bash
# TypeScript only (fastest - type checking only)
cd src && bunx tsc --skipLibCheck

# Full compilation (includes --max-old-space-size=8192)
bun run compile

# React components
bun run buildreact

# Run any gulp command with proper Node.js flags
bun run gulp <task>
```

> ⚠️ **Important**: Use `bun run gulp <task>` instead of raw `node ./node_modules/gulp/bin/gulp.js`  
> Package scripts include required flags: `--max-old-space-size=8192 --disable-warning=DEP0180`

### Watch Mode

```bash
# Watch everything (background)
bun watchd

# Kill watch processes
bun kill-watchd
```

## 🧪 Testing

### After Making Changes

```bash
# 1. Build React components (if changed)
bun buildreact

# 2. Compile VS Code core
bun compile

# 3. Reload VS Code
# Press Ctrl+Shift+P → "Developer: Reload Window"
```

### Common Tests

```bash
# Unit tests
bun test-node

# Browser tests
bun test-browser

# Integration tests
./scripts/test-integration.sh
```

## 🐛 Common Issues

### "Cannot find module './react/out/...'"

```bash
bun buildreact
```

### TypeScript errors

```bash
# Quick type check
cd src && bunx tsc --skipLibCheck

# Full compile with proper memory
bun run compile
```

### Watch processes stuck

```bash
bun kill-watchd
bun restart-watchd
```

## 📋 Most Used Commands

```bash
bun run buildreact    # Build React components
bun run compile       # Compile VS Code
bun run watchd        # Watch mode (background)
./scripts/code.sh # Launch VS Code
```

## 📦 Package Management

```bash
bun run install       # Install dependencies (10x faster than npm!)
bun run add <pkg>     # Add a package
bun run remove <pkg>  # Remove a package
```

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
