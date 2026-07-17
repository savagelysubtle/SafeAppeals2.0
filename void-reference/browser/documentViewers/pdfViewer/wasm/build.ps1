# Build the PDF Viewer Rust WASM crate (Windows PowerShell).
#
# Usage:
#   cd src\vs\workbench\contrib\void\browser\documentViewers\pdfViewer\wasm
#   .\build.ps1
#
# Prerequisites:
#   - Rust toolchain with wasm32-unknown-unknown target:
#       rustup target add wasm32-unknown-unknown
#   - wasm-bindgen-cli:
#       cargo install wasm-bindgen-cli

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Building Rust WASM (release)..."
cargo build --target wasm32-unknown-unknown --release

Write-Host "[2/4] Running wasm-bindgen..."
if (-Not (Test-Path "pkg")) { New-Item -ItemType Directory -Path "pkg" | Out-Null }
wasm-bindgen `
    --target web `
    --out-dir pkg/ `
    target/wasm32-unknown-unknown/release/pdf_viewer.wasm

Write-Host "[3/4] Copying artifacts to media/wasm/..."
Copy-Item pkg/pdf_viewer_bg.wasm ../media/wasm/ -Force
Copy-Item pkg/pdf_viewer.js ../media/wasm/ -Force
if (Test-Path pkg/pdf_viewer.d.ts) {
    Copy-Item pkg/pdf_viewer.d.ts ../media/wasm/ -Force
}

Write-Host "[4/4] Building TypeScript bundle..."
Push-Location ../media
node build.mjs
Pop-Location

Write-Host "PDF Viewer WASM build complete!"
