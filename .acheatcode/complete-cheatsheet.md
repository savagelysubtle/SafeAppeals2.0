# Complete Build & Development Cheatsheet

## 🚀 Quick Start Commands

### Essential Development Workflow

```bash
# 1. Install dependencies
npm install

# 2. Build React components (for Void features)
npm run buildreact

# 3. Compile VS Code core
npm run compile

# 4. Launch VS Code
./scripts/code.sh
or ctrl + shift + p and run "Run Dev"
# Windows: ./scripts/code.bat
```

## 📦 Build Commands

### Core Compilation

```bash
# Full VS Code compilation
npm run compile
# Equivalent to: node ./node_modules/gulp/bin/gulp.js compile

# TypeScript only (fastest)
cd src && npx tsc --skipLibCheck

# Compile with mangling (production)
npm run compile-build
# Equivalent to: node ./node_modules/gulp/bin/gulp.js compile-build-with-mangling

# Compile without mangling (development)
node ./node_modules/gulp/bin/gulp.js compile-build-without-mangling
```

### React Components (Void Features)

```bash
# Build React components once
npm run buildreact
# Equivalent to: cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js

# Watch React components (development)
npm run watchreact
# Equivalent to: cd ./src/vs/workbench/contrib/void/browser/react/ && node build.js --watch

# Watch with deemon (background)
npm run watchreactd
```

### Extensions

```bash
# Compile all extensions
node ./node_modules/gulp/bin/gulp.js compile-extensions

# Compile extensions build
npm run compile-extensions-build

# Watch extensions
npm run watch-extensions
# Equivalent to: node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js watch-extensions watch-extension-media
```

### Web Builds

```bash
# Compile for web
npm run compile-web
# Equivalent to: node ./node_modules/gulp/bin/gulp.js compile-web

# Watch web build
npm run watch-web
# Equivalent to: node ./node_modules/gulp/bin/gulp.js watch-web

# Launch web server
./scripts/code-web.sh
# Windows: ./scripts/code-web.bat
```

### CLI Builds

```bash
# Compile CLI
npm run compile-cli
# Equivalent to: gulp compile-cli

# Watch CLI
npm run watch-cli
# Equivalent to: node ./node_modules/gulp/bin/gulp.js watch-cli
```

## 🔄 Watch Mode Commands

### Parallel Watching

```bash
# Watch client and extensions together
npm run watch
# Equivalent to: npm-run-all -lp watch-client watch-extensions

# Watch with deemon (background)
npm run watchd

# Kill watch processes
npm run kill-watchd

# Restart watch processes
npm run restart-watchd
```

### Individual Watch Commands

```bash
# Watch client only
npm run watch-client
# Equivalent to: node --max-old-space-size=8192 ./node_modules/gulp/bin/gulp.js watch-client

# Watch extensions only
npm run watch-extensions

# Watch web only
npm run watch-web
```

## 🧪 Testing Commands

### Unit Tests

```bash
# Run all unit tests
npm run test-node
# Equivalent to: mocha test/unit/node/index.js --delay --ui=tdd --timeout=5000 --exit

# Run browser tests
npm run test-browser
# Equivalent to: npx playwright install && node test/unit/browser/index.js

# Run browser tests (no install)
npm run test-browser-no-install
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
npm run test-extension -- -l extension-name

# Test multiple extensions
npm run test-extension -- -l vscode-colorize-tests
npm run test-extension -- -l markdown-language-features
npm run test-extension -- -l configuration-editing
```

### Smoke Tests

```bash
# Run smoke tests
npm run smoketest
# Equivalent to: node build/lib/preLaunch.js && cd test/smoke && npm run compile && node test/index.js

# Smoke tests without compilation
npm run smoketest-no-compile
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
npm run electron
# Equivalent to: node build/lib/electron
```

## 🔧 Development Tools

### Linting & Formatting

```bash
# Run ESLint
npm run eslint
# Equivalent to: node build/eslint

# Run Stylelint
npm run stylelint
# Equivalent to: node build/stylelint

# Run hygiene checks
npm run precommit
# Equivalent to: node build/hygiene.js
```

### Type Checking

```bash
# Monaco type check
npm run monaco-compile-check
# Equivalent to: tsc -p src/tsconfig.monaco.json --noEmit

# TSEC compile check
npm run tsec-compile-check
# Equivalent to: node node_modules/tsec/bin/tsec -p src/tsconfig.tsec.json

# VSCode DTS compile check
npm run vscode-dts-compile-check
# Equivalent to: tsc -p src/tsconfig.vscode-dts.json && tsc -p src/tsconfig.vscode-proposed-dts.json
```

### Validation

```bash
# Valid layers check
npm run valid-layers-check
# Equivalent to: node build/lib/layersChecker.js

# Property init order check
npm run property-init-order-check
# Equivalent to: node build/lib/propertyInitOrderChecker.js
```

## 📦 Package Management

### Dependencies

```bash
# Install dependencies
npm install

# Pre-install hooks
npm run preinstall
# Equivalent to: node build/npm/preinstall.js

# Post-install hooks
npm run postinstall
# Equivalent to: node build/npm/postinstall.js
```

### Extensions

```bash
# Download builtin extensions
npm run download-builtin-extensions
# Equivalent to: node build/lib/builtInExtensions.js

# Download builtin extensions (CG)
npm run download-builtin-extensions-cg
# Equivalent to: node build/lib/builtInExtensionsCG.js
```

## 🎯 Common Workflows

### After Making Changes

```bash
# 1. Build React components (if changed)
npm run buildreact

# 2. Compile VS Code core
npm run compile

# 3. Reload VS Code
# Press Ctrl+Shift+P → "Developer: Reload Window"
```

### Full Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Download builtin extensions
npm run download-builtin-extensions

# 3. Build React components
npm run buildreact

# 4. Start watching (background)
npm run watchd

# 5. Launch VS Code
./scripts/code.sh
```

### Production Build

```bash
# 1. Clean build
npm run compile-build

# 2. Minify VS Code
npm run minify-vscode

# 3. Build extensions
npm run compile-extensions-build
```

## 🐛 Debugging

### Common Errors & Solutions

#### "Cannot find module './react/out/...'"

```bash
# Solution: Build React components
npm run buildreact
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
cd src && npx tsc --skipLibCheck
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
- Kill watch processes when not needed: `npm run kill-watchd`

### Build Speed

- Use TypeScript-only compilation for quick checks: `cd src && npx tsc --skipLibCheck`
- Use watch mode for development: `npm run watchd`
- Build React components separately: `npm run buildreact`

## 🔄 CI/CD Commands

### Core CI

```bash
npm run core-ci
# Equivalent to: node ./node_modules/gulp/bin/gulp.js core-ci

npm run core-ci-pr
# Equivalent to: node ./node_modules/gulp/bin/gulp.js core-ci-pr
```

### Extensions CI

```bash
npm run extensions-ci
# Equivalent to: node ./node_modules/gulp/bin/gulp.js extensions-ci

npm run extensions-ci-pr
# Equivalent to: node ./node_modules/gulp/bin/gulp.js extensions-ci-pr
```

## 📋 Quick Reference

### Most Used Commands

```bash
npm run buildreact    # Build React components
npm run compile       # Compile VS Code
npm run watchd        # Watch mode (background)
./scripts/code.sh     # Launch VS Code
```

### Emergency Commands

```bash
npm run kill-watchd   # Kill all watch processes
npm run restart-watchd # Restart watch processes
npm run precommit     # Run all checks
```

### Build Verification

```bash
npm run monaco-compile-check    # Type check Monaco
npm run tsec-compile-check      # Security check
npm run valid-layers-check      # Architecture check
```

---

**💡 Pro Tip**: Use `npm run watchd` for background watching and `npm run buildreact` before testing Void features!
