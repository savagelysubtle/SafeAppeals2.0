# Quick Reference Cheat sheet

> **📚 For complete documentation, see [complete-cheatsheet.md](./complete-cheatsheet.md)**

## 🚀 Essential Commands

### Complete Build (Production Windows)

```bash
bun run gulp setup-python && bun run buildreact && bun run compile-build-ci && bun run compile-extensions-build && bun run gulp bundle-vscode && bun run gulp vscode-win32-x64-ci && bun run gulp vscode-win32-x64-inno-updater && bun run gulp vscode-win32-x64-user-setup
```

> **📝 Note**:
>
> - `setup-python` prepares the Python virtual environment (`python/.venv`) which is bundled into the production build
> - `compile-extensions-build` compiles all extensions (themes, time-tracker, etc.) for production packaging

### Complete Build (Production macOS)

```bash
# For Apple Silicon (M1/M2/M3)
bun run gulp setup-python && bun run buildreact && bun run compile-build-ci && bun run compile-extensions-build && bun run gulp bundle-vscode && bun run gulp vscode-darwin-arm64-ci

# For Intel Macs
bun run gulp setup-python && bun run buildreact && bun run compile-build-ci && bun run compile-extensions-build && bun run gulp bundle-vscode && bun run gulp vscode-darwin-x64-ci

# Universal App (both architectures - requires building both first)
VSCODE_ARCH=universal node build/darwin/create-universal-app.js ../
```

> **📝 macOS Notes**:
>
> - Output location: `../VSCode-darwin-arm64/` or `../VSCode-darwin-x64/`
> - For distribution, the app needs to be signed and notarized (see `build/darwin/sign.js`)
> - FFmpeg must be installed via Homebrew: `brew install ffmpeg`

### Complete Build (Production Linux)

```bash
bun run gulp setup-python && bun run buildreact && bun run compile-build-ci && bun run compile-extensions-build && bun run gulp bundle-vscode && bun run gulp vscode-linux-x64-ci
```

> **📝 Linux Notes**:
>
> - Output location: `../VSCode-linux-x64/`
> - Additional architectures: `vscode-linux-arm64-ci`, `vscode-linux-armhf-ci`

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

# XLSX Rust Viewer (Rust → WASM + TS → JS bundle)
bun run build-wasm            # Compile Rust crate to WASM via wasm-pack
bun run build-xlsx-viewer     # Bundle webview TS into xlsxRustViewer.js via esbuild

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
bun run buildreact         # Build React components
bun run compile            # Compile VS Code
bun run watchd             # Watch mode (background)
bun run build-wasm         # Compile Rust XLSX viewer to WASM
bun run build-xlsx-viewer  # Bundle XLSX Rust Viewer webview JS
./scripts/code.sh          # Launch VS Code
```

## 📦 Package Management

```bash
bun run install       # Install dependencies (10x faster than npm!)
bun run add <pkg>     # Add a package
bun run remove <pkg>  # Remove a package
```

## 🔍 OCR Dependencies (Installer Build)

Before building the Windows installer with OCR support, download the bundled dependencies:

```powershell
# Download all OCR dependencies (run from repo root)
cd build/win32/tools && .\download-tesseract.ps1 && .\download-poppler.ps1

# Or run individually:
.\download-tesseract.ps1   # Downloads Tesseract OCR v5.4.0.20240606 + license
.\download-poppler.ps1     # Downloads Poppler v24.08.0
```

### Development Environment Setup

For OCR to work during development, add the tools to your PATH:

```powershell
# Add Poppler and Tesseract to PATH permanently (run once)
[Environment]::SetEnvironmentVariable("PATH", "$env:PATH;D:\Coding\SafeAppeals2.0\build\win32\tools\poppler;D:\Coding\SafeAppeals2.0\build\win32\tools\tesseract", "User")
[Environment]::SetEnvironmentVariable("TESSDATA_PREFIX", "D:\Coding\SafeAppeals2.0\build\win32\tools\tesseract\tessdata", "User")

# Restart your terminal/IDE for changes to take effect
```

> **Note**: The installer automatically adds these to PATH when users select "Install OCR dependencies" during installation.

### What Gets Bundled

![1769497244446](image/cheatsheet/1769497244446.png)![1769497248241](image/cheatsheet/1769497248241.png)
| Tool | Purpose | Directory |
|------|---------|-----------|
| **Tesseract** | OCR text extraction from images | `build/win32/tools/tesseract/` |
| **Poppler** | PDF to image conversion | `build/win32/tools/poppler/` |

### Requirements

- **7-Zip**: Required to extract Tesseract (script installs via winget if missing)
- **winget**: Required for 7-Zip auto-install

### Python OCR Dependencies

```bash
# Sync Python venv with OCR packages (from python/ directory)
cd python && uv sync
```

Packages included: `pdf2image`, `Pillow`, `pytesseract`, `ocrmypdf`

### Full Production Build with OCR

```powershell
# 1. Download OCR tools
cd build/win32/tools && .\download-tesseract.ps1 && .\download-poppler.ps1 && cd ../../..

# 2. Build installer (standard production build)
bun run gulp setup-python && bun run buildreact && bun run compile-build-ci && bun run compile-extensions-build && bun run gulp bundle-vscode && bun run gulp vscode-win32-x64-ci && bun run gulp vscode-win32-x64-inno-updater && bun run gulp vscode-win32-x64-user-setup
```

## 🎙️ Audio Transcription Dependencies

### FFmpeg & Whisper Model

Both are required for audio transcription and are bundled with the installer.

```powershell
# Download FFmpeg binaries (~150MB for Windows)
bun run download-ffmpeg

# Download Whisper model (~1.5GB)
bun run download-whisper-model
```

> **Note**: These are automatically downloaded during `node build/lib/preLaunch.js` (first-time setup) and bundled into the installer.

| Component | Size | Purpose | Location |
|-----------|------|---------|----------|
| **FFmpeg** | ~150MB | Audio format conversion (m4a/mp3 → WAV) | `resources/ffmpeg/{platform}/` |
| **Whisper Model** | ~1.5GB | AI speech-to-text transcription | `resources/models/whisper/distil-large-v3.5/` |

### Manual Installation (Development)

If not bundled, install system-wide:

```powershell
# Windows
winget install FFmpeg

# macOS
brew install ffmpeg

# Linux
sudo apt install ffmpeg
```

> **Note**: During installation, users can optionally select "Install OCR dependencies" to add Tesseract/Poppler to PATH and install Ghostscript via winget.

---

**💡 See [complete-cheatsheet.md](./complete-cheatsheet.md) for full documentation!**
