# install-ocr-deps.ps1
# Installs OCR system dependencies required for PDF text extraction
# Run this script as Administrator for system-wide installation

param(
    [switch]$Force,
    [switch]$SkipPython
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SafeAppeals OCR Dependencies Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Warning: Running without administrator privileges." -ForegroundColor Yellow
    Write-Host "Some installations may fail. Consider re-running as Administrator." -ForegroundColor Yellow
    Write-Host ""
}

# Function to check if a command exists
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to install via winget
function Install-Winget {
    param($PackageId, $PackageName)

    Write-Host "Installing $PackageName..." -ForegroundColor Yellow

    try {
        $result = winget install --id $PackageId --accept-source-agreements --accept-package-agreements --silent
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] $PackageName installed successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  [FAIL] Failed to install $PackageName (exit code: $LASTEXITCODE)" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  [FAIL] Error installing $PackageName: $_" -ForegroundColor Red
        return $false
    }
}

# Check for winget
if (-not (Test-Command "winget")) {
    Write-Host "Error: winget is not available." -ForegroundColor Red
    Write-Host "Please install App Installer from the Microsoft Store." -ForegroundColor Red
    exit 1
}

Write-Host "Checking system dependencies..." -ForegroundColor Cyan
Write-Host ""

# 1. Install Tesseract OCR
Write-Host "[1/3] Tesseract OCR (Required for text extraction from images)" -ForegroundColor White

# Check for bundled Tesseract first (in tools\tesseract relative to script directory)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledTesseract = Join-Path $scriptDir "tesseract\tesseract.exe"
$systemTesseractPath = "C:\Program Files\Tesseract-OCR\tesseract.exe"

if (Test-Path $bundledTesseract) {
    Write-Host "  [OK] Tesseract is bundled with SafeAppeals at: $scriptDir\tesseract" -ForegroundColor Green
} elseif ((Test-Path $systemTesseractPath) -and -not $Force) {
    Write-Host "  [OK] Tesseract is already installed at: $systemTesseractPath" -ForegroundColor Green
} elseif (Test-Command "tesseract") {
    Write-Host "  [OK] Tesseract is available in PATH" -ForegroundColor Green
} else {
    Install-Winget -PackageId "UB-Mannheim.TesseractOCR" -PackageName "Tesseract OCR"
}

# 2. Install Ghostscript (required by ocrmypdf)
Write-Host ""
Write-Host "[2/3] Ghostscript (Required for PDF processing)" -ForegroundColor White
$gsPath = "C:\Program Files\gs\*\bin\gswin64c.exe"
$gsInstalled = Get-ChildItem -Path $gsPath -ErrorAction SilentlyContinue
if ($gsInstalled -and -not $Force) {
    Write-Host "  [OK] Ghostscript is already installed" -ForegroundColor Green
} else {
    Install-Winget -PackageId "ArtifexSoftware.GhostScript" -PackageName "Ghostscript"
}

# 3. Install Poppler (required by pdf2image for PDF to image conversion)
Write-Host ""
Write-Host "[3/3] Poppler (Required for PDF to image conversion)" -ForegroundColor White

# Check for bundled Poppler first (in tools\poppler relative to app directory)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledPoppler = Join-Path $scriptDir "poppler\pdftoppm.exe"
$systemPopplerPath = "C:\Program Files\poppler*\Library\bin\pdftoppm.exe"
$systemPopplerInstalled = Get-ChildItem -Path $systemPopplerPath -ErrorAction SilentlyContinue

if (Test-Path $bundledPoppler) {
    Write-Host "  [OK] Poppler is bundled with SafeAppeals at: $scriptDir\poppler" -ForegroundColor Green
} elseif ($systemPopplerInstalled -and -not $Force) {
    Write-Host "  [OK] Poppler is already installed system-wide" -ForegroundColor Green
} elseif (Test-Command "pdftoppm") {
    Write-Host "  [OK] Poppler is available in PATH" -ForegroundColor Green
} else {
    # Poppler is not available via winget, provide manual instructions
    Write-Host "  ! Poppler needs to be installed manually" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Download Poppler for Windows from:" -ForegroundColor White
    Write-Host "    https://github.com/oschwartz10612/poppler-windows/releases" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Installation steps:" -ForegroundColor White
    Write-Host "    1. Download the latest release ZIP file" -ForegroundColor Gray
    Write-Host "    2. Extract to C:\Program Files\poppler\" -ForegroundColor Gray
    Write-Host "    3. Add C:\Program Files\poppler\Library\bin to your PATH" -ForegroundColor Gray
    Write-Host ""
}

# 4. Install Python dependencies (if not skipped)
if (-not $SkipPython) {
    Write-Host ""
    Write-Host "[Bonus] Installing Python OCR packages..." -ForegroundColor White

    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $pythonDir = Split-Path -Parent $scriptDir
    $venvPython = Join-Path $pythonDir ".venv\Scripts\python.exe"

    if (Test-Path $venvPython) {
        Write-Host "  Using Python venv at: $pythonDir\.venv" -ForegroundColor Gray

        # Install packages using uv if available, otherwise pip
        if (Test-Command "uv") {
            Push-Location $pythonDir
            try {
                uv sync
                Write-Host "  [OK] Python dependencies installed via uv" -ForegroundColor Green
            } catch {
                Write-Host "  [FAIL] Failed to install Python dependencies: $_" -ForegroundColor Red
            }
            Pop-Location
        } else {
            try {
                & $venvPython -m pip install pdf2image Pillow pytesseract ocrmypdf --quiet
                Write-Host "  [OK] Python dependencies installed via pip" -ForegroundColor Green
            } catch {
                Write-Host "  [FAIL] Failed to install Python dependencies: $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  ! Python venv not found at expected location" -ForegroundColor Yellow
        Write-Host "  Run 'uv sync' manually in the python directory" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify installations
$allInstalled = $true

# Check Tesseract
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledTesseract = Join-Path $scriptDir "tesseract\tesseract.exe"
$systemTesseractPath = "C:\Program Files\Tesseract-OCR\tesseract.exe"

if (Test-Path $bundledTesseract) {
    $tesseractVersion = & $bundledTesseract --version 2>&1 | Select-Object -First 1
    Write-Host "  [OK] Tesseract: Bundled - $tesseractVersion" -ForegroundColor Green
} elseif (Test-Path $systemTesseractPath) {
    $tesseractVersion = & $systemTesseractPath --version 2>&1 | Select-Object -First 1
    Write-Host "  [OK] Tesseract: $tesseractVersion" -ForegroundColor Green
} elseif (Test-Command "tesseract") {
    $tesseractVersion = & tesseract --version 2>&1 | Select-Object -First 1
    Write-Host "  [OK] Tesseract: $tesseractVersion (in PATH)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Tesseract: Not found" -ForegroundColor Red
    $allInstalled = $false
}

# Check Ghostscript
$gsExe = Get-ChildItem -Path "C:\Program Files\gs\*\bin\gswin64c.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($gsExe) {
    Write-Host "  [OK] Ghostscript: Found at $($gsExe.FullName)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] Ghostscript: Not found" -ForegroundColor Red
    $allInstalled = $false
}

# Check Poppler
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundledPoppler = Join-Path $scriptDir "poppler\pdftoppm.exe"
$popplerExe = Get-ChildItem -Path "C:\Program Files\poppler*\Library\bin\pdftoppm.exe" -ErrorAction SilentlyContinue | Select-Object -First 1

if (Test-Path $bundledPoppler) {
    Write-Host "  [OK] Poppler: Bundled at $scriptDir\poppler" -ForegroundColor Green
} elseif ($popplerExe) {
    Write-Host "  [OK] Poppler: Found at $($popplerExe.DirectoryName)" -ForegroundColor Green
} elseif (Test-Command "pdftoppm") {
    Write-Host "  [OK] Poppler: Found in PATH" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Poppler: Not found (manual installation required)" -ForegroundColor Yellow
    $allInstalled = $false
}

Write-Host ""
if ($allInstalled) {
    Write-Host "All OCR dependencies are installed!" -ForegroundColor Green
    Write-Host "You may need to restart the application for changes to take effect." -ForegroundColor Cyan
} else {
    Write-Host "Some dependencies are missing. OCR features may not work correctly." -ForegroundColor Yellow
    Write-Host "Please install missing dependencies and restart the application." -ForegroundColor Yellow
}
Write-Host ""
