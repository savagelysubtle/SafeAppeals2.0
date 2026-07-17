#!/bin/bash
# Build the PDF Viewer Rust WASM crate.
#
# Usage:
#   cd src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/wasm
#   bash build.sh
#
# Prerequisites:
#   - Rust toolchain with wasm32-unknown-unknown target:
#       rustup target add wasm32-unknown-unknown
#   - wasm-bindgen-cli:
#       cargo install wasm-bindgen-cli

set -e

echo "[1/4] Building Rust WASM (release)..."
cargo build --target wasm32-unknown-unknown --release

echo "[2/4] Running wasm-bindgen..."
wasm-bindgen \
    --target web \
    --out-dir pkg/ \
    target/wasm32-unknown-unknown/release/pdf_viewer.wasm

echo "[3/4] Copying artifacts to media/wasm/..."
cp pkg/pdf_viewer_bg.wasm ../media/wasm/
cp pkg/pdf_viewer.js ../media/wasm/
cp pkg/pdf_viewer.d.ts ../media/wasm/ 2>/dev/null || true

echo "[4/4] Building TypeScript bundle..."
cd ../media
node build.mjs

echo "✓ PDF Viewer WASM build complete!"
