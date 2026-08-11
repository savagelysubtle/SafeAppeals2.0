# Build sa-docparse and install into extensions/safeappeals-ml/bin for Windows packaging / Run Dev.
# End-user installers should run this on the Windows build agent (binary is gitignored).
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
	throw 'cargo not found on PATH. Install Rust (rustup) before packaging DocParse.'
}

Push-Location (Join-Path $repo 'rust')
try {
	& cargo build -p docparse --release
	if ($LASTEXITCODE -ne 0) { throw "cargo build -p docparse failed ($LASTEXITCODE)" }
} finally {
	Pop-Location
}

$exeName = if ($IsWindows -or $env:OS -match 'Windows') { 'sa-docparse.exe' } else { 'sa-docparse' }
$src = Join-Path $repo "rust/target/release/$exeName"
if (-not (Test-Path $src)) {
	throw "Built binary not found: $src"
}

$destDir = Join-Path $repo 'extensions/safeappeals-ml/bin'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir $exeName
Copy-Item $src $dest -Force
Write-Host "Installed DocParse sidecar: $dest ($((Get-Item $dest).Length) bytes)"
