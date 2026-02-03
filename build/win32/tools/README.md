# Build Tools

This directory contains tools and binaries bundled with the Windows installer.

## OCR Dependencies

The installer bundles both Tesseract and Poppler for PDF/OCR processing.

### Downloading All OCR Dependencies

Before building the installer with OCR support, run both scripts:

```powershell
.\download-tesseract.ps1
.\download-poppler.ps1
```

This will download and extract the binaries to their respective subdirectories.

---

## Tesseract OCR Binaries

Tesseract is the OCR engine used for extracting text from scanned PDFs and images.

### Downloading Tesseract

```powershell
.\download-tesseract.ps1
```

This downloads Tesseract v5.4.0.20240606 from UB-Mannheim and extracts it to `tesseract/`.

**Note:** Requires 7-Zip to extract the NSIS installer. The script will attempt to install 7-Zip via winget if not found.

### Manual Download

If the script fails:

1. Go to https://github.com/UB-Mannheim/tesseract/wiki
2. Download the 64-bit installer
3. Install to a temp location and copy contents to `build/win32/tools/tesseract/`
4. Ensure `tessdata/eng.traineddata` is included for English OCR

### Required Files

The `tesseract/` directory should contain:
- `tesseract.exe` - Main OCR executable
- `tessdata/` folder with language data files (at least `eng.traineddata`)
- Various DLL dependencies
- `LICENSE-Tesseract.txt` - Apache 2.0 license

---

## Poppler Binaries

Poppler is required for PDF-to-image conversion used in OCR processing.

### Downloading Poppler

```powershell
.\download-poppler.ps1
```

This will download and extract the latest Poppler binaries to the `poppler/` subdirectory.

### Manual Download

If the script fails, you can manually download Poppler:

1. Go to https://github.com/oschwartz10612/poppler-windows/releases
2. Download the latest `Release-X.XX.X-X.zip`
3. Extract the `Library/bin` folder contents to `build/win32/tools/poppler/`

### Required Files

The `poppler/` directory should contain at minimum:
- `pdftoppm.exe` - PDF to PPM/PNG/JPEG converter
- `pdftotext.exe` - PDF to text converter
- Various DLL dependencies

---

## OCR Dependencies Installer Script

The `install-ocr-deps.ps1` script (located in `python/scripts/`) is bundled with the installer to help users install any missing system-level OCR dependencies:

- **Tesseract OCR** - Bundled with installer
- **Ghostscript** - Installed via winget (required by ocrmypdf)
- **Poppler** - Bundled with installer

When users select "Install OCR dependencies" during installation:
1. The script, Tesseract, and Poppler binaries are copied to `{app}\tools\`
2. Ghostscript is installed via winget (if not already present)
3. Tesseract and Poppler paths are added to the system/user PATH
4. `TESSDATA_PREFIX` environment variable is set for language data
