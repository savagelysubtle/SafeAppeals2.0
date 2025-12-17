# Docling Local Models Setup

## 🎯 Overview

SafeAppeals Navigator now uses **locally-downloaded Docling ML models** for enhanced PDF extraction. This means:

- ✅ **One-time download**: Download models once (~260MB)
- ✅ **No runtime auth**: HF token only needed for initial download
- ✅ **Offline capable**: Works without internet after setup
- ✅ **Better parsing**: ML-powered table detection, multi-column layout
- ✅ **Fast fallback**: PDF.js used as backup if Docling unavailable

## 📋 Quick Setup Guide

### Prerequisites

- Python 3.8+ installed
- `uv` package manager installed
- HuggingFace account (free)

### Step 1: Python Environment (One-Time)

```bash
# Create virtual environment
uv venv

# Install dependencies (includes python-dotenv)
uv pip install -r pyproject.toml
```

### Step 2: Get HuggingFace Token (One-Time)

1. **Create token**: https://huggingface.co/settings/tokens

   - Click "New token"
   - Name: "SafeAppeals-Docling"
   - Type: "Read"
   - Click "Generate"

2. **Accept model terms**: https://huggingface.co/ds4sd/docling-layout-heron

   - Click "Agree and access repository"
   - This grants access to gated Docling models

3. **Add to `.env` file**:
   ```bash
   HF_TOKEN=hf_your_token_here
   ```

### Step 3: Download Models (One-Time, ~5-10 minutes)

```bash
# Windows
.venv\Scripts\python.exe scripts\download-docling-models.py

# macOS/Linux
.venv/bin/python scripts/download-docling-models.py
```

**What happens:**

- Script reads `HF_TOKEN` from `.env`
- Downloads 3 ML models (~260MB total):
  - Layout detection (~100MB)
  - Table structure (~90MB)
  - OCR models (~70MB)
- Copies to `.docling_models/` in project root
- Models are now bundled with your app

### Step 4: Launch SafeAppeals

```bash
npm install
node build/lib/preLaunch.js
npm run compile
.\scripts\code.bat
```

**On startup, you'll see:**

```
[Docling Serve] ✓ Found local models at: D:\...\SafeAppeals2.0\.docling_models
[Docling Serve] ✓ Server ready on http://localhost:5001
```

## 🏗️ Architecture

### How It Works

```
┌─────────────────────────────────────────────────────┐
│ SafeAppeals Navigator (TypeScript/Electron)         │
│                                                     │
│  ragMainService.ts (Startup)                       │
│  ├─ Check for .docling_models/                     │
│  ├─ Set DOCLING_SERVE_ARTIFACTS_PATH env var      │
│  ├─ Spawn: python -m docling_serve run            │
│  └─ Wait for http://localhost:5001                │
│                                                     │
│  ragFileService.ts (PDF Extraction)                │
│  ├─ useDoclingForPdf = true (default)             │
│  ├─ Try Docling API (localhost:5001)              │
│  └─ Fallback to PDF.js if Docling fails           │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│ Docling Serve (Python FastAPI - subprocess)         │
│                                                     │
│  • Loads models from DOCLING_SERVE_ARTIFACTS_PATH  │
│  • No HuggingFace auth at runtime                  │
│  • Process management by ragMainService            │
│  • Auto-shutdown when SafeAppeals closes           │
└─────────────────────────────────────────────────────┘
```

### Environment Variables

**During Model Download** (scripts/download-docling-models.py):

- `HF_TOKEN` - Required for downloading gated models from HuggingFace

**During Runtime** (ragMainService.ts):

- `DOCLING_SERVE_ARTIFACTS_PATH` - Points to `.docling_models/`
- `HF_TOKEN` - Optional, only for fallback if models missing

## 📁 File Structure

```
SafeAppeals2.0/
├── .env                          # Your HF_TOKEN (gitignored)
├── .docling_models/              # Downloaded models (optional in git)
│   ├── layout/                   # Layout detection models
│   ├── table/                    # Table structure models
│   └── ocr/                      # OCR models
├── .venv/                        # Python virtual environment
├── pyproject.toml                # Python dependencies
└── scripts/
    └── download-docling-models.py  # Model download script
```

## 🔧 Configuration

### Use Docling by Default

In `ragFileService.ts`:

```typescript
export class RAGFileService {
	public useDoclingForPdf = true; // ✅ Docling enabled by default

	async extractContent(uri: URI): Promise<ExtractedContent> {
		if (fileExt === "pdf") {
			if (this.useDoclingForPdf) {
				return await this.extractPdfWithDocling(uri); // ML-powered
			} else {
				return await this.extractPDF(uri); // PDF.js fallback
			}
		}
		// ... other file types
	}
}
```

### Toggle Extraction Method

You can test both methods:

```
Command Palette → "RAG: Test Docling PDF Extraction"
```

This shows side-by-side comparison of:

- **Standard** (PDF.js): Fast, basic text extraction
- **Docling** (ML): Slower, enhanced table/layout detection

## 🚨 Troubleshooting

### Models Not Found on Startup

```
[Docling Serve] ✗ Local models not found at: D:\...\SafeAppeals2.0\.docling_models
[Docling Serve] Run: npm run download-docling-models
```

**Solution**: Run the model download script (Step 3 above)

### HuggingFace 401 Unauthorized

```
huggingface_hub.errors.HfHubHTTPError: 401 Client Error: Unauthorized
```

**Solutions**:

1. Check `.env` has valid `HF_TOKEN=hf_...`
2. Accept terms at https://huggingface.co/ds4sd/docling-layout-heron
3. Regenerate token if expired

### Docling Serve Won't Start

```
[Docling Serve] Python virtual environment not found
```

**Solution**:

```bash
uv venv
uv pip install -r pyproject.toml
```

### Models Downloaded but Not Found at Runtime

Check environment variable is set in `ragMainService.ts`:

```typescript
env.DOCLING_SERVE_ARTIFACTS_PATH = localModelsPath;
```

Verify path is correct:

```
D:\Coding\SafeAppeals2.0\.docling_models
```

## 💡 Best Practices

### Development

1. **Keep models local**: The `.docling_models/` folder is ~260MB

   - Commented out in `.gitignore` by default
   - Uncomment to exclude from git if space is an issue

2. **Share HF_TOKEN carefully**: Never commit `.env` to git

   - Already in `.gitignore`
   - Each developer needs their own token

3. **Model updates**: To update models, delete `.docling_models/` and re-run download script

### Production/Distribution

**Option A: Bundle Models** (Recommended)

- Include `.docling_models/` in your build
- Users don't need HF token
- Larger installer (~260MB)

**Option B: Download on First Run**

- Exclude `.docling_models/` from build
- App downloads models on first launch
- Users need HF token (friction)

## 📊 Performance Comparison

| Feature      | PDF.js (Fallback)    | Docling (ML)             |
| ------------ | -------------------- | ------------------------ |
| Speed        | ~150ms for 8 pages   | ~15s for 8 pages         |
| Tables       | Basic (no structure) | Full structure detection |
| Multi-column | Poor                 | Excellent                |
| Images       | Text only            | Vision model analysis    |
| Metadata     | Basic                | Enhanced                 |
| Setup        | None                 | One-time download        |

## 🔄 Model Update Workflow

To update to newer Docling models:

```bash
# 1. Delete old models
rm -rf .docling_models

# 2. Check for new model versions
# Visit: https://github.com/DS4SD/docling

# 3. Update pyproject.toml if needed
uv pip install --upgrade docling

# 4. Re-download models
.venv\Scripts\python.exe scripts\download-docling-models.py
```

## 📚 Additional Resources

- [Docling GitHub](https://github.com/DS4SD/docling)
- [Docling Documentation](https://ds4sd.github.io/docling/)
- [HuggingFace Tokens](https://huggingface.co/docs/hub/security-tokens)
- [Model Card: docling-layout-heron](https://huggingface.co/ds4sd/docling-layout-heron)

## 🎉 Summary

You now have:

- ✅ Local ML models for PDF extraction
- ✅ No runtime authentication required
- ✅ Offline-capable document processing
- ✅ PDF.js fallback for reliability
- ✅ One-time setup with clear instructions

The system will automatically:

- ✅ Detect local models on startup
- ✅ Start Docling Serve with local models
- ✅ Fall back to PDF.js if Docling unavailable
- ✅ Stop Docling Serve on app shutdown

Happy parsing! 🚀
