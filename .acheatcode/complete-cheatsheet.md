# Complete Build & Development Cheatsheet

## 🚀 Quick Start Commands

### Essential Development Workflow

```bash
# 1. Install dependencies
bun install

# 2. Build React components (for Void features)
bun run buildreact

# 3. Compile VS Code core
bun run compile

# 4. Launch VS Code
./scripts/code.sh
or ctrl + shift + p and run "Run Dev"
# Windows: ./scripts/code.bat
```

## 📦 Build Commands

### Core Compilation

```bash
# Full VS Code compilation (includes --max-old-space-size=8192)
bun run compile

# TypeScript only (fastest - type checking only)
cd src && bunx tsc --skipLibCheck

# Compile with mangling (production)
bun run compile-build

# Compile without mangling (CI/faster)
bun run compile-build-ci

# Run any gulp task with proper Node.js flags
bun run gulp <task>
```

> ⚠️ **Important**: Always use `bun run gulp <task>` or `bun run <script>` instead of raw gulp commands.  
> Package scripts include required flags: `--max-old-space-size=8192 --disable-warning=DEP0180`

### React Components (Void Features)

```bash
# Build React components once
bun run buildreact
# Equivalent to: cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js

# Watch React components (development)
bun run watchreact
# Equivalent to: cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js --watch

# Watch with deemon (background)
bun run watchreactd
```

### Extensions

```bash
# Compile all extensions (recommended)
bun run gulp compile-extensions

# Compile extensions build (production)
bun run compile-extensions-build

# Watch extensions (includes proper flags)
bun run watch-extensions
```

### Web Builds

```bash
# Compile for web (includes proper flags)
bun run compile-web

# Watch web build
bun run watch-web

# Launch web server
./scripts/code-web.sh
# Windows: ./scripts/code-web.bat
```

### CLI Builds

```bash
# Compile CLI
bun run compile-cli

# Watch CLI (includes proper flags)
bun run watch-cli
```

## 🔄 Watch Mode Commands

### Parallel Watching

```bash
# Watch client and extensions together
bun run watch
# Equivalent to: npm-run-all -lp watch-client watch-extensions

# Watch with deemon (background)
bun run watchd

# Kill watch processes
bun run kill-watchd

# Restart watch processes
bun run restart-watchd
```

### Individual Watch Commands

```bash
# Watch client only (includes proper flags)
bun run watch-client

# Watch extensions only
bun run watch-extensions

# Watch web only
bun run watch-web
```

## 🧪 Testing Commands

### Unit Tests

```bash
# Run all unit tests
bun run test-node
# Equivalent to: mocha test/unit/node/index.js --delay --ui=tdd --timeout=5000 --exit

# Run browser tests
bun run test-browser
# Equivalent to: npx playwright install && node test/unit/browser/index.js

# Run browser tests (no install)
bun run test-browser-no-install
```

### Integration Tests

```bash
# Run integration tests
./scripts/test-integration.sh
# Windows: ./scripts/test-integration.bat

# Run web integration tests
./scripts/test-web-integration.sh
# Windows: ./scripts/test-web-integration.bat

# Run remote integration tests
./scripts/test-remote-integration.sh
# Windows: ./scripts/test-remote-integration.bat
```

### Extension Tests

```bash
# Test specific extension
bun run test-extension -- -l extension-name

# Test multiple extensions
bun run test-extension -- -l vscode-colorize-tests
bun run test-extension -- -l markdown-language-features
bun run test-extension -- -l configuration-editing
```

### Smoke Tests

```bash
# Run smoke tests
bun run smoketest
# Equivalent to: node build/lib/preLaunch.js && cd test/smoke && npm run compile && node test/index.js

# Smoke tests without compilation
bun run smoketest-no-compile
```

## 🚀 Launch Commands

### VS Code Launch

```bash
# Launch VS Code (development)
./scripts/code.sh
# Windows: ./scripts/code.bat

# Launch VS Code server
./scripts/code-server.sh
# Windows: ./scripts/code-server.bat

# Launch VS Code web
./scripts/code-web.sh
# Windows: ./scripts/code-web.bat
```

### Electron

```bash
# Launch Electron
bun run electron
# Equivalent to: node build/lib/electron
```

## 🔧 Development Tools

### Linting & Formatting

```bash
# Run ESLint
bun run eslint
# Equivalent to: node build/eslint

# Run Stylelint
bun run stylelint
# Equivalent to: node build/stylelint

# Run hygiene checks
bun run precommit
# Equivalent to: node build/hygiene.js
```

### Type Checking

```bash
# Monaco type check
bun run monaco-compile-check
# Equivalent to: tsc -p src/tsconfig.monaco.json --noEmit

# TSEC compile check
bun run tsec-compile-check
# Equivalent to: node node_modules/tsec/bin/tsec -p src/tsconfig.tsec.json

# VSCode DTS compile check
bun run vscode-dts-compile-check
# Equivalent to: tsc -p src/tsconfig.vscode-dts.json && tsc -p src/tsconfig.vscode-proposed-dts.json
```

### Validation

```bash
# Valid layers check
bun run valid-layers-check
# Equivalent to: node build/lib/layersChecker.js

# Property init order check
bun run property-init-order-check
# Equivalent to: node build/lib/propertyInitOrderChecker.js
```

## 📦 Package Management

### Dependencies

```bash
# Install dependencies
bun install

# Pre-install hooks
bun run preinstall
# Equivalent to: node build/npm/preinstall.js

# Post-install hooks
bun run postinstall
# Equivalent to: node build/npm/postinstall.js
```

### Extensions

```bash
# Download builtin extensions
bun run download-builtin-extensions
# Equivalent to: node build/lib/builtInExtensions.js

# Download builtin extensions (CG)
bun run download-builtin-extensions-cg
# Equivalent to: node build/lib/builtInExtensionsCG.js
```

## 🎯 Common Workflows

### After Making Changes

```bash
# 1. Build React components (if changed)
bun run buildreact

# 2. Compile VS Code core
bun run compile

# 3. Reload VS Code
# Press Ctrl+Shift+P → "Developer: Reload Window"
```

### Full Development Setup

```bash
# 1. Install dependencies
bun install

# 2. Download builtin extensions
bun run download-builtin-extensions

# 3. Build React components
bun run buildreact

# 4. Start watching (background)
bun run watchd

# 5. Launch VS Code
./scripts/code.sh
```

### Production Build

```bash
# 1. Clean build
bun run compile-build

# 2. Minify VS Code
bun run minify-vscode

# 3. Build extensions
bun run compile-extensions-build
```

## 🐛 Debugging

### Common Errors & Solutions

#### "Cannot find module './react/out/...'"

```bash
# Solution: Build React components
bun run buildreact
```

#### "Property 'X' does not exist"

- Check if constructor accepts the parameter
- Add missing import or property declaration

#### "Command not found"

- Check `package.json` commands section
- Verify command is registered in extension files

#### TypeScript compilation errors

```bash
# Quick type check
cd src && bunx tsc --skipLibCheck
```

### Debug Launch Configurations

- **VS Code Internal**: Main development launch
- **Attach to Extension Host**: Debug extensions
- **Attach to Main Process**: Debug main process
- **VS Code Server (Web)**: Debug web version

## 📁 Key Directories

```
src/vs/workbench/contrib/void/     # Void-specific code
src/vs/workbench/contrib/void/browser/react/  # React components
build/                              # Build scripts
scripts/                            # Launch scripts
extensions/                         # Built-in extensions
out/                                # Compiled output
```

## ⚡ Performance Tips

### Memory Optimization

- Use `--max-old-space-size=8192` for large builds
- Watch mode uses background processes with deemon
- Kill watch processes when not needed: `bun run kill-watchd`

### Build Speed

- Use TypeScript-only compilation for quick checks: `cd src && bunx tsc --skipLibCheck`
- Use watch mode for development: `bun run watchd`
- Build React components separately: `bun run buildreact`

## 🔄 CI/CD Commands

### Core CI

```bash
# Full core CI (includes --max-old-space-size=8192)
bun run core-ci

# Core CI for pull requests
bun run core-ci-pr
```

### Extensions CI

```bash
# Full extensions CI (includes --max-old-space-size=8192)
bun run extensions-ci

# Extensions CI for pull requests
bun run extensions-ci-pr
```

## 📋 Quick Reference

### Most Used Commands

```bash
bun run buildreact    # Build React components
bun run compile       # Compile VS Code
npm run watchd        # Watch mode (background)
./scripts/code.sh     # Launch VS Code
```

### Emergency Commands

```bash
bun run kill-watchd   # Kill all watch processes
bun run restart-watchd # Restart watch processes
bun run precommit     # Run all checks
```

### Build Verification

```bash
bun run monaco-compile-check    # Type check Monaco
bun run tsec-compile-check      # Security check
bun run valid-layers-check      # Architecture check
```

---

**💡 Pro Tip**: Use `bun run watchd` for background watching and `bun run buildreact` before testing Void features!
