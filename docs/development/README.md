# Development Documentation

This folder contains guides, setup instructions, and migration plans for developing SafeAppeals Navigator.

## Quick Start

For new developers or setting up a fresh environment:

1. **[DOCLING_QUICKSTART.md](./DOCLING_QUICKSTART.md)** - 5-minute setup for PDF extraction with local ML models
2. **[DOCLING_LOCAL_MODELS.md](./DOCLING_LOCAL_MODELS.md)** - Complete guide for offline-capable document processing
3. **[HUGGINGFACE_TOKEN.md](./HUGGINGFACE_TOKEN.md)** - How to get authentication tokens for ML models

## Migration & Updates

- **[BUN_MIGRATION_PLAN.md](./BUN_MIGRATION_PLAN.md)** - Comprehensive plan to migrate from npm to Bun for faster builds

## Development Workflow

After cloning the repository:

```bash
# Install dependencies (now with Bun!)
bun install

# Get ML models for PDF processing
.venv\Scripts\python.exe scripts\download-docling-models.py

# Build and run
node build/lib/preLaunch.js
bun run compile
.\scripts\code.bat
```

## Key Technologies

- **Bun** - Fast JavaScript runtime and package manager
- **Docling** - ML-powered PDF extraction with local models
- **Python/uv** - Virtual environment management for ML dependencies
- **HuggingFace** - Model hosting and authentication

## Troubleshooting

Common setup issues are covered in each guide. For ML model issues, see the HuggingFace token guide first.
