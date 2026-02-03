# download-poppler.ps1
# Downloads and extracts Poppler binaries for bundling with the installer
# Run this script before building the installer to include Poppler

param(
    [string]$OutputDir = "$PSScriptRoot\poppler",
    [string]$Version = "24.08.0-0"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================"
Write-Host "Poppler Download Script"
Write-Host "========================================"
Write-Host ""

# Poppler Windows releases from: https://github.com/oschwartz10612/poppler-windows/releases
$downloadUrl = "https://github.com/oschwartz10612/poppler-windows/releases/download/v$Version/Release-$Version.zip"
$zipFile = "$env:TEMP\poppler-$Version.zip"
$extractDir = "$env:TEMP\poppler-extract"

Write-Host "Version: $Version"
Write-Host "Download URL: $downloadUrl"
Write-Host "Output Directory: $OutputDir"
Write-Host ""

# Create output directory
if (Test-Path $OutputDir) {
    Write-Host "Cleaning existing poppler directory..."
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Download
Write-Host "Downloading Poppler v$Version..."
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($downloadUrl, $zipFile)
    Write-Host "  [OK] Download complete"
} catch {
    Write-Host "  [FAIL] Download failed: $_"
    exit 1
}

# Extract
Write-Host "Extracting..."
try {
    if (Test-Path $extractDir) {
        Remove-Item -Recurse -Force $extractDir
    }
    Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force
    Write-Host "  [OK] Extraction complete"
} catch {
    Write-Host "  [FAIL] Extraction failed: $_"
    exit 1
}

# Copy only the necessary binaries (bin directory)
Write-Host "Copying binaries..."
try {
    $sourceDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    $binDir = Join-Path $sourceDir.FullName "Library\bin"

    if (Test-Path $binDir) {
        # Copy bin directory contents
        Copy-Item -Path "$binDir\*" -Destination $OutputDir -Recurse -Force

        # Count files
        $fileCount = (Get-ChildItem -Path $OutputDir -File).Count
        Write-Host "  [OK] Copied $fileCount files to $OutputDir"
    } else {
        Write-Host "  [FAIL] Could not find bin directory in extracted archive"
        Write-Host "    Looking for: $binDir"
        exit 1
    }
} catch {
    Write-Host "  [FAIL] Copy failed: $_"
    exit 1
}

# Cleanup
Write-Host "Cleaning up..."
Remove-Item -Force $zipFile -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue
Write-Host "  [OK] Cleanup complete"

# Verify
Write-Host ""
Write-Host "Verification:"
$pdftoppm = Join-Path $OutputDir "pdftoppm.exe"
if (Test-Path $pdftoppm) {
    Write-Host "  [OK] pdftoppm.exe found"
} else {
    Write-Host "  [FAIL] pdftoppm.exe not found!"
    exit 1
}

Write-Host ""
Write-Host "========================================"
Write-Host "Poppler binaries ready for bundling!"
Write-Host "Directory: $OutputDir"
Write-Host "========================================"
