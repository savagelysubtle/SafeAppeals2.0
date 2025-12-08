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
# TypeScript only (fastest)
cd src && bunx tsc --skipLibCheck

# Full compilation
bun compile

# React components
bun buildreact
```

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
cd src && bunx tsc --skipLibCheck
```

### Watch processes stuck

```bash
bun kill-watchd
bun restart-watchd
```

## 📋 Most Used Commands

```bash
bun buildreact    # Build React components
bun compile       # Compile VS Code
bun watchd        # Watch mode (background)
./scripts/code.sh # Launch VS Code
```

## 📦 Package Management

```bash
bun install       # Install dependencies (10x faster than npm!)
bun add <pkg>     # Add a package
bun remove <pkg>  # Remove a package
```

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
