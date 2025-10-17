# Quick Reference Cheatsheet

> **📚 For complete documentation, see [complete-cheatsheet.md](./complete-cheatsheet.md)**

## 🚀 Essential Commands

### Development Workflow

```bash
# 1. Build React components (Void features)
npm run buildreact

# 2. Compile VS Code core
npm run compile

# 3. Launch VS Code
./scripts/code.sh
```

### Quick Builds

```bash
# TypeScript only (fastest)
cd src && npx tsc --skipLibCheck

# Full compilation
npm run compile

# React components
npm run buildreact
```

### Watch Mode

```bash
# Watch everything (background)
npm run watchd

# Kill watch processes
npm run kill-watchd
```

## 🧪 Testing

### After Making Changes

```bash
# 1. Build React components (if changed)
npm run buildreact

# 2. Compile VS Code core
npm run compile

# 3. Reload VS Code
# Press Ctrl+Shift+P → "Developer: Reload Window"
```

### Common Tests

```bash
# Unit tests
npm run test-node

# Browser tests
npm run test-browser

# Integration tests
./scripts/test-integration.sh
```

## 🐛 Common Issues

### "Cannot find module './react/out/...'"

```bash
npm run buildreact
```

### TypeScript errors

```bash
cd src && npx tsc --skipLibCheck
```

### Watch processes stuck

```bash
npm run kill-watchd
npm run restart-watchd
```

## 📋 Most Used Commands

```bash
npm run buildreact    # Build React components
npm run compile       # Compile VS Code
npm run watchd        # Watch mode (background)
./scripts/code.sh     # Launch VS Code
```

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
