# Quick Start: Docling with Local Models

## ⚡ 5-Minute Setup

### 1️⃣ Install Python Dependencies

```bash
uv venv
uv pip install -r pyproject.toml
```

### 2️⃣ Get HuggingFace Token

🔗 **Get token**: https://huggingface.co/settings/tokens
🔗 **Accept terms**: https://huggingface.co/ds4sd/docling-layout-heron

Add to `.env`:

```
HF_TOKEN=hf_your_token_here
```

### 3️⃣ Download Models (One-Time)

```bash
# Windows
.venv\Scripts\python.exe scripts\download-docling-models.py

# macOS/Linux
.venv/bin/python scripts/download-docling-models.py
```

⏱️ Takes 5-10 minutes (~260MB download)

### 4️⃣ Launch App

```bash
npm install
node build/lib/preLaunch.js
npm run compile
.\scripts\code.bat
```

## ✅ Success Indicators

You'll see in the console:

```
[Docling Serve] ✓ Found local models at: D:\Coding\SafeAppeals2.0\.docling_models
[Docling Serve] ✓ Server ready on http://localhost:5001
```

## 🧪 Test It

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: **"RAG: Test Docling PDF Extraction"**
3. Select a PDF with tables
4. See side-by-side comparison

## 🎯 What You Get

| Before (PDF.js)    | After (Docling)            |
| ------------------ | -------------------------- |
| Basic text         | **ML-powered extraction**  |
| No table structure | **Structured tables**      |
| Poor multi-column  | **Multi-column aware**     |
| Fast (~150ms)      | Slower but accurate (~15s) |

## 🔄 Daily Workflow

**No changes needed!** Just launch SafeAppeals:

- ✅ Models auto-loaded from `.docling_models/`
- ✅ Docling Serve starts automatically
- ✅ PDFs use Docling by default
- ✅ Falls back to PDF.js if needed

## 🚨 Troubleshooting

**Models not found?**

```bash
.venv\Scripts\python.exe scripts\download-docling-models.py
```

**Token error?**

- Check `.env` has `HF_TOKEN=hf_...`
- Accept terms at https://huggingface.co/ds4sd/docling-layout-heron

**Python not found?**

```bash
uv venv
uv pip install -r pyproject.toml
```

## 📚 Full Documentation

- 📖 **Detailed guide**: [DOCLING_LOCAL_MODELS.md](./DOCLING_LOCAL_MODELS.md)
- 🔧 **Integration details**: [DOCLING_INTEGRATION.md](./DOCLING_INTEGRATION.md)
- 🔑 **HF Token guide**: [HUGGINGFACE_TOKEN.md](./HUGGINGFACE_TOKEN.md)

---

That's it! You now have production-ready, offline-capable PDF extraction with ML models. 🚀
