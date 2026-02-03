# download-tesseract.ps1
# Downloads and extracts Tesseract OCR binaries for bundling with the installer
# Run this script before building the installer to include Tesseract

param(
    [string]$OutputDir = "$PSScriptRoot\tesseract",
    [string]$Version = "5.4.0",
    [string]$BuildDate = "20240606"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Tesseract OCR Download Script"
Write-Host "========================================"
Write-Host ""

# Tesseract Windows builds from UB-Mannheim
# https://github.com/UB-Mannheim/tesseract/wiki
# Filename format: tesseract-ocr-w64-setup-{version}.{builddate}.exe
$downloadUrl = "https://github.com/UB-Mannheim/tesseract/releases/download/v$Version.$BuildDate/tesseract-ocr-w64-setup-$Version.$BuildDate.exe"
$installerFile = "$env:TEMP\tesseract-$Version.$BuildDate-setup.exe"
$extractDir = "$env:TEMP\tesseract-extract"

Write-Host "Version: $Version.$BuildDate"
Write-Host "Download URL: $downloadUrl"
Write-Host "Output Directory: $OutputDir"
Write-Host ""

# Create output directory
if (Test-Path $OutputDir) {
    Write-Host "Cleaning existing tesseract directory..."
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Download
Write-Host "Downloading Tesseract v$Version.$BuildDate..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($downloadUrl, $installerFile)
    Write-Host "  [OK] Download complete"
} catch {
    Write-Host "  [FAIL] Download failed: $_"
    exit 1
}

# Extract using 7-Zip (NSIS installers can be extracted with 7z)
Write-Host "Extracting..."
try {
    if (Test-Path $extractDir) {
        Remove-Item -Recurse -Force $extractDir
    }
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

    # Try to find 7-Zip
    $sevenZipPaths = @(
        "C:\Program Files\7-Zip\7z.exe",
        "C:\Program Files (x86)\7-Zip\7z.exe",
        "$env:ProgramFiles\7-Zip\7z.exe"
    )

    $sevenZip = $null
    foreach ($path in $sevenZipPaths) {
        if (Test-Path $path) {
            $sevenZip = $path
            break
        }
    }

    if (-not $sevenZip) {
        Write-Host "  [WARN] 7-Zip not found. Installing via winget..."
        winget install --id 7zip.7zip --accept-source-agreements --accept-package-agreements --silent
        $sevenZip = "C:\Program Files\7-Zip\7z.exe"

        if (-not (Test-Path $sevenZip)) {
            Write-Host "  [FAIL] Could not install 7-Zip"
            exit 1
        }
    }

    # Extract the NSIS installer
    & $sevenZip x $installerFile -o"$extractDir" -y | Out-Null
    Write-Host "  [OK] Extraction complete"
} catch {
    Write-Host "  [FAIL] Extraction failed: $_"
    exit 1
}

# Copy necessary files
Write-Host "Copying binaries..."
try {
    # Copy main executables and DLLs
    $filesToCopy = @(
        "tesseract.exe",
        "*.dll"
    )

    foreach ($pattern in $filesToCopy) {
        $files = Get-ChildItem -Path $extractDir -Filter $pattern -Recurse -ErrorAction SilentlyContinue
        foreach ($file in $files) {
            Copy-Item -Path $file.FullName -Destination $OutputDir -Force
        }
    }

    # Copy tessdata directory (language data)
    $tessdataSource = Get-ChildItem -Path $extractDir -Directory -Filter "tessdata" -Recurse | Select-Object -First 1
    if ($tessdataSource) {
        $tessdataDest = Join-Path $OutputDir "tessdata"
        Copy-Item -Path $tessdataSource.FullName -Destination $tessdataDest -Recurse -Force
        Write-Host "  [OK] Copied tessdata directory"
    } else {
        Write-Host "  [WARN] tessdata directory not found in extracted files"
    }

    # Count files
    $fileCount = (Get-ChildItem -Path $OutputDir -File).Count
    Write-Host "  [OK] Copied $fileCount files to $OutputDir"
} catch {
    Write-Host "  [FAIL] Copy failed: $_"
    exit 1
}

# Download license file
Write-Host "Downloading license..."
try {
    $licenseUrl = "https://raw.githubusercontent.com/tesseract-ocr/tesseract/main/LICENSE"
    $licenseDest = Join-Path $OutputDir "LICENSE-Tesseract.txt"
    $webClient.DownloadFile($licenseUrl, $licenseDest)
    Write-Host "  [OK] License downloaded"
} catch {
    Write-Host "  [WARN] Could not download license: $_"
    # Create a placeholder license file
    @"
Tesseract OCR License
=====================

Tesseract is licensed under the Apache License, Version 2.0.
See: https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE

Third-party components may have different licenses.
See the Tesseract documentation for details.
"@ | Set-Content -Path (Join-Path $OutputDir "LICENSE-Tesseract.txt")
}

# Cleanup
Write-Host "Cleaning up..."
Remove-Item -Force $installerFile -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue
Write-Host "  [OK] Cleanup complete"

# Verify
Write-Host ""
Write-Host "Verification:"
$tesseractExe = Join-Path $OutputDir "tesseract.exe"
$tessdataDir = Join-Path $OutputDir "tessdata"
$engTraineddata = Join-Path $tessdataDir "eng.traineddata"

if (Test-Path $tesseractExe) {
    Write-Host "  [OK] tesseract.exe found"
} else {
    Write-Host "  [FAIL] tesseract.exe not found!"
    exit 1
}

if (Test-Path $engTraineddata) {
    Write-Host "  [OK] eng.traineddata found"
} else {
    Write-Host "  [WARN] eng.traineddata not found - OCR may not work without language data"
}

Write-Host ""
Write-Host "========================================"
Write-Host "Tesseract binaries ready for bundling!"
Write-Host "Directory: $OutputDir"
Write-Host "========================================"
