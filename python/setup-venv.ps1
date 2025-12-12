# SafeAppeals Python Environment Setup Script (Windows)
# This script creates a virtual environment and installs dependencies

$ErrorActionPreference = "Stop"

Write-Host "=== SafeAppeals Python Environment Setup ===" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check for Python
Write-Host "Checking for Python..." -ForegroundColor Yellow
$pythonCmd = $null

# Try 'py' first (Python Launcher for Windows)
try {
    $version = & py --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pythonCmd = "py"
        Write-Host "  Found: $version (using 'py')" -ForegroundColor Green
    }
} catch {}

# Try 'python' if 'py' not found
if (-not $pythonCmd) {
    try {
        $version = & python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = "python"
            Write-Host "  Found: $version (using 'python')" -ForegroundColor Green
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Host "ERROR: Python not found!" -ForegroundColor Red
    Write-Host "Please install Python 3.10+ from https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Create virtual environment
$venvPath = Join-Path $ScriptDir ".venv"
if (Test-Path $venvPath) {
    Write-Host ""
    Write-Host "Virtual environment already exists at: $venvPath" -ForegroundColor Yellow
    $response = Read-Host "Do you want to recreate it? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Write-Host "Removing existing venv..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $venvPath
    } else {
        Write-Host "Keeping existing venv. Running pip install to update dependencies..." -ForegroundColor Yellow
    }
}

if (-not (Test-Path $venvPath)) {
    Write-Host ""
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    & $pythonCmd -m venv .venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Created: $venvPath" -ForegroundColor Green
}

# Activate venv and install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow

$pipPath = Join-Path $venvPath "Scripts\pip.exe"
$pythonPath = Join-Path $venvPath "Scripts\python.exe"

# Upgrade pip first
Write-Host "  Upgrading pip..." -ForegroundColor Gray
& $pythonPath -m pip install --upgrade pip --quiet

# Install the package with dependencies
Write-Host "  Installing transmutation-codex and dependencies..." -ForegroundColor Gray
& $pipPath install -e . --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Python venv created at: $venvPath" -ForegroundColor Cyan
Write-Host "Python executable: $pythonPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "The file converter will automatically use this bundled Python." -ForegroundColor White
Write-Host ""

# Show installed packages
Write-Host "Installed packages:" -ForegroundColor Yellow
& $pipPath list

