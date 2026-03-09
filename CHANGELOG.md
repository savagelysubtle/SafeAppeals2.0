# Changelog

## [2.0.0] - 2026-03-01

### Major Release — 180 commits since v1.99.3

This release marks a major milestone for Safe Appeals Navigator with complete Rust/WASM rewrites of document viewers, a full integrated web browser, a massively overhauled RAG system, audio transcription, and dozens of quality-of-life improvements.

---

### Document Viewers — Rust/WASM Rewrites

#### XLSX Viewer (Complete Rust Rewrite)
- Rewrote the entire XLSX viewer from TypeScript to Rust compiled to WASM for dramatically improved performance
- Added charts, conditional formatting, and sparklines support
- Implemented data validation, hyperlinks, named ranges, paste special, format cells, status bar, auto-fill, and auto-fit
- Added expanded formula functions
- Integrated AI Table Chart Tools for XLSX editing
- Added ribbon controller with selection tracking and style application
- New build pipeline: `build-wasm` (Rust→WASM via wasm-pack) + `build-xlsx-viewer` (TS→JS bundle via esbuild)

#### PDF Viewer (Complete Rust/WASM Rewrite)
- Rewrote the PDF viewer in Rust/WASM with full feature set
- Added annotations and AI integration
- Implemented PDF extraction capabilities with Docling integration
- Added copy with page numbers, quick edit actions, and context gathering
- Native PDF export via Electron IPC
- New build pipeline: `build-pdf-wasm` (cargo + wasm-bindgen→WASM, then TS→JS)

#### DOCX Viewer Enhancements
- Enhanced with MS Word-like features and automatic pagination support
- New ribbon interface with Tiptap extensions
- Signature line display and interaction improvements
- Working copy management and auto-save functionality
- Floating images reference and enhanced link handling
- Image handling via Base64 data URLs for persistence
- Upgraded Tiptap packages to v3.15.0

---

### Integrated Web Browser
- Enhanced Simple Browser with home button and loading indicator
- Full in-app web browsing capabilities

---

### RAG System — v2.1 Performance Overhaul
- Complete overhaul of vector search pipeline for major indexing speedup
- Implemented Micro Database Architecture for complete workspace isolation
- Advanced RAG pipeline with hybrid search and cross-encoder reranking
- New search scopes and auto-indexing features
- Persistent embeddings with local embedding support
- Context menu action for indexing workspace documents
- Rate limiting and duplicate prevention

---

### Audio Transcription
- Integrated Whisper model for speech-to-text transcription
- FFmpeg integration for audio format conversion (m4a/mp3→WAV)
- Audio recording capabilities with download scripts for FFmpeg (~150MB) and Whisper model (~1.5GB)

---

### Case Management
- Case timeline and event tracker module (KAN-57)
  - Phase 1: UI polish and jurisdiction selector
  - Phase 2: Document linking and HTML export
  - Phase 3: Enhanced timeline and calendar view with case config integration
- AI-driven file classification with case context
- File organization dashboard and services
- Print functionality across all document viewers

---

### Cloud & AI Services
- SafeAppeals Cloud backend with credits system
- Cloud LLM routing service with XML tool parsing
- Cloud web search integration with Brave Search Pro
- Context window tracking and UI indicators
- Multi-modal support for chat system
- Updated model configurations (GPT-5 series, LiteLLM sync)
- Complete migration to ANTML tool calling system
- MCP tools migration and internal MCP server architecture

---

### File Conversion
- File Converter feature with UI integration and backend services
- Python environment setup for document format conversions
- Docling integration for enhanced PDF extraction

---

### UI/UX
- Rebranded from Void to SafeAppeals across the entire UI
- Safe Appeals File Icon Theme
- Multiple custom color themes (Pastel, Grey, Red, Purple, and Black variants: Peridot, Topaz, Opal, Copper, Platinum, Sapphire, Citrine, Emerald)
- Fixed chat panel scrolling issues
- Enhanced settings and chat panels

---

### OCR Support
- Bundled Tesseract OCR v5.4.0 for text extraction from images
- Bundled Poppler v24.08.0 for PDF to image conversion
- Installer option for OCR dependency installation

---

### Build & CI
- Multi-platform GitHub Actions release workflow (Windows x64, macOS Intel, macOS Apple Silicon, Linux x64)
- WASM artifacts built as platform-agnostic pre-build step
- SHA256 checksums for all release assets
- Python venv setup integrated into build pipeline (`gulp setup-python`)

---

### Developer Experience
- Enhanced cheatsheet and build documentation
- Standardized gulp command warnings
- Watch mode improvements
- Removed obsolete migration and implementation documentation

---

### Bug Fixes
- Fixed `setEditorVisible` protected visibility across all document viewer editors
- Fixed TypeScript version and global type handling
- Fixed cloudLLMRouterService type errors
- Fixed XML parsing with partial-xml-stream-parser integration
- Fixed compilation errors for timeline PDF export
- Fixed user token access in toolsService and cloudWebSearchService
- Fixed Case Organizer chatMode to use global settings service

---

### Breaking Changes
- Old TypeScript-based XLSX viewer removed — replaced by Rust/WASM viewer
- Removed many bundled language extensions (bare-bones document editor focus)
- Requires Rust toolchain with `wasm32-unknown-unknown` target for building WASM artifacts from source

---

## [1.99.3] - Previous Release

Initial stable release based on VSCode 1.99.
